/**
 * FAMS Lite — backend
 *
 * One Google Sheet is the database. This script is the only thing that can
 * read or write it, and it will not answer a single question without a valid
 * session token. Deploy as a web app: "Execute as me", "Anyone" access.
 * Access is safe because the PIN gate lives in here, not in the page.
 *
 * Storage layout, in a sheet named "Store" with two columns, key and value:
 *   config       { pinHash, pinSalt, secret, academicYear, version }
 *   index        { version, categories[], works[], events[] }   <- home bundle
 *   work:<id>    { records: [...] }                             <- loaded on demand
 *   bin          { items: [...] }                               <- 30 day recycle bin
 *   log          [ ... last 500 actions ... ]
 */

var SHEET_NAME = 'Store';
var TOKEN_DAYS = 30;
var MAX_ATTEMPTS = 5;
var LOCKOUT_MINUTES = 15;
var BIN_DAYS = 30;
var LOG_LIMIT = 500;

/* ------------------------------------------------------------------ *
 * Entry points
 * ------------------------------------------------------------------ */

function doGet() {
  return json({ ok: true, app: 'fams-lite', ready: !!readFresh('config') });
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json({ ok: false, error: 'Could not read the request.' });
  }

  try {
    var action = req.action;

    // Open actions: no token needed.
    if (action === 'status') return json({ ok: true, ready: !!readFresh('config') });
    if (action === 'firstRun') return json(firstRun(req));
    if (action === 'unlock') return json(unlock(req));

    // Everything below needs a valid session.
    requireToken(req.token);

    switch (action) {
      case 'sync':          return json(sync(req));
      case 'getWork':       return json(getWork(req));
      case 'saveRecord':    return json(saveRecord(req));
      case 'deleteRecord':  return json(deleteRecord(req));
      case 'saveWork':      return json(saveWork(req));
      case 'deleteWork':    return json(deleteWork(req));
      case 'reorderWorks':  return json(reorderWorks(req));
      case 'saveCategory':  return json(saveCategory(req));
      case 'deleteCategory':return json(deleteCategory(req));
      case 'listBin':       return json({ ok: true, bin: pruneBin().items });
      case 'restore':       return json(restore(req));
      case 'purgeBin':      return json(purgeBin());
      case 'listLog':       return json({ ok: true, log: readKey('log') || [] });
      case 'changePin':     return json(changePin(req));
      default:              return json({ ok: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return json({ ok: false, error: String((err && err.message) || err) });
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ *
 * Key/value store over the sheet
 * ------------------------------------------------------------------ */

function sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function rowOf(key) {
  var sh = sheet();
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var keys = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === key) return i + 2;
  }
  return 0;
}

function readKey(key) {
  // The index bundle is read on nearly every request, so it is cached.
  var cache = CacheService.getScriptCache();
  if (key === 'index' || key === 'config') {
    var hit = cache.get(key);
    if (hit) {
      try { return JSON.parse(hit); } catch (e) { /* fall through to the sheet */ }
    }
  }
  var row = rowOf(key);
  if (!row) return null;
  var raw = sheet().getRange(row, 2).getValue();
  if (raw === '' || raw === null) return null;
  var value;
  try { value = JSON.parse(raw); } catch (e) { return null; }
  if (key === 'index' || key === 'config') {
    try { cache.put(key, JSON.stringify(value), 21600); } catch (e) { /* too big to cache */ }
  }
  return value;
}

/**
 * Reads straight from the sheet, ignoring the cache. Anything that decides
 * whether the workspace exists must use this: the cache holds a copy for six
 * hours, so a config deleted by hand would otherwise still look present.
 */
function readFresh(key) {
  var row = rowOf(key);
  if (!row) {
    try { CacheService.getScriptCache().remove(key); } catch (e) {}
    return null;
  }
  var raw = sheet().getRange(row, 2).getValue();
  if (raw === '' || raw === null) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function writeKey(key, value) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet();
    var row = rowOf(key);
    var raw = JSON.stringify(value);
    if (!row) {
      sh.appendRow([key, raw]);
    } else {
      sh.getRange(row, 2).setValue(raw);
    }
    if (key === 'index' || key === 'config') {
      try { CacheService.getScriptCache().put(key, raw, 21600); } catch (e) {}
    }
  } finally {
    lock.releaseLock();
  }
  return value;
}

function dropKey(key) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var row = rowOf(key);
    if (row) sheet().deleteRow(row);
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ *
 * PIN, lockout, session tokens
 * ------------------------------------------------------------------ */

function sha256(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes);
}

function hashPin(pin, salt) {
  return sha256(salt + '|' + String(pin) + '|fams-lite');
}

function randomString(len) {
  var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var out = '';
  for (var i = 0; i < (len || 32); i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

/** Creates the config, the seeded index, and sets the PIN. Runs once. */
function firstRun(req) {
  if (readFresh('config')) return { ok: false, error: 'Already set up. Use changePin instead.' };
  var pin = String(req.pin || '');
  if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'The PIN must be exactly 4 digits.' };

  var salt = randomString(24);
  writeKey('config', {
    pinHash: hashPin(pin, salt),
    pinSalt: salt,
    secret: randomString(48),
    academicYear: req.academicYear || '2026-27',
    version: 1
  });
  writeKey('index', seedIndex());
  writeKey('bin', { items: [] });
  writeKey('log', []);
  logAction('setup', 'Workspace created');
  return { ok: true };
}

function attemptState() {
  var props = PropertiesService.getScriptProperties();
  return {
    attempts: Number(props.getProperty('attempts') || 0),
    lockUntil: Number(props.getProperty('lockUntil') || 0)
  };
}

function unlock(req) {
  var config = readKey('config');
  if (!config) return { ok: false, error: 'Not set up yet.', needsSetup: true };

  var state = attemptState();
  var now = Date.now();
  if (state.lockUntil > now) {
    return { ok: false, error: 'Too many wrong attempts. Try again in '
      + Math.ceil((state.lockUntil - now) / 60000) + ' minutes.', locked: true };
  }

  var props = PropertiesService.getScriptProperties();
  var given = String(req.pin || '');
  if (hashPin(given, config.pinSalt) !== config.pinHash) {
    var attempts = state.attempts + 1;
    props.setProperty('attempts', String(attempts));
    if (attempts >= MAX_ATTEMPTS) {
      props.setProperty('lockUntil', String(now + LOCKOUT_MINUTES * 60000));
      props.setProperty('attempts', '0');
      logAction('locked', 'Locked out after ' + MAX_ATTEMPTS + ' wrong PIN attempts');
      return { ok: false, error: 'Too many wrong attempts. Locked for '
        + LOCKOUT_MINUTES + ' minutes.', locked: true };
    }
    return { ok: false, error: 'Wrong PIN. ' + (MAX_ATTEMPTS - attempts) + ' attempts left.' };
  }

  props.setProperty('attempts', '0');
  props.deleteProperty('lockUntil');
  return { ok: true, token: mintToken(config), index: readKey('index') };
}

function mintToken(config) {
  var payload = Utilities.base64EncodeWebSafe(JSON.stringify({
    exp: Date.now() + TOKEN_DAYS * 86400000,
    n: randomString(8)
  }));
  var sig = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payload, config.secret)
  );
  return payload + '.' + sig;
}

function requireToken(token) {
  var config = readKey('config');
  if (!config) throw new Error('Not set up yet.');
  var parts = String(token || '').split('.');
  if (parts.length !== 2) throw new Error('Session expired. Enter your PIN again.');
  var expected = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(parts[0], config.secret)
  );
  if (parts[1] !== expected) throw new Error('Session expired. Enter your PIN again.');
  var payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  } catch (e) {
    throw new Error('Session expired. Enter your PIN again.');
  }
  if (!payload.exp || payload.exp < Date.now()) {
    throw new Error('Session expired. Enter your PIN again.');
  }
  return true;
}

function changePin(req) {
  var config = readKey('config');
  var pin = String(req.newPin || '');
  if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'The PIN must be exactly 4 digits.' };
  if (hashPin(String(req.currentPin || ''), config.pinSalt) !== config.pinHash) {
    return { ok: false, error: 'Current PIN is wrong.' };
  }
  var salt = randomString(24);
  config.pinSalt = salt;
  config.pinHash = hashPin(pin, salt);
  config.secret = randomString(48); // invalidates every existing session
  writeKey('config', config);
  logAction('pin', 'PIN changed');
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Sync
 * ------------------------------------------------------------------ */

/** The cheapest call in the app: usually just a version comparison. */
function sync(req) {
  var index = readKey('index');
  if (req.version && Number(req.version) === Number(index.version)) {
    return { ok: true, same: true, version: index.version };
  }
  return { ok: true, same: false, index: index };
}

function bumpVersion(index) {
  index.version = Number(index.version || 0) + 1;
  return index;
}

/* ------------------------------------------------------------------ *
 * Works and categories
 * ------------------------------------------------------------------ */

function saveWork(req) {
  var index = readKey('index');
  var work = req.work || {};
  if (!String(work.name || '').trim()) return { ok: false, error: 'The work needs a name.' };

  var existing = null;
  for (var i = 0; i < index.works.length; i++) {
    if (index.works[i].id === work.id) { existing = index.works[i]; break; }
  }

  if (existing) {
    work.order = (work.order === undefined) ? existing.order : work.order;
    index.works[index.works.indexOf(existing)] = work;
    logAction('work.edit', 'Edited work "' + work.name + '"');
  } else {
    work.id = work.id || 'w_' + randomString(10);
    work.order = index.works.length;
    work.status = work.status || 'Active';
    work.fields = work.fields || defaultFields();
    index.works.push(work);
    writeKey('work:' + work.id, { records: [] });
    logAction('work.add', 'Added work "' + work.name + '"');
  }

  rebuildEvents(index);
  writeKey('index', bumpVersion(index));
  return { ok: true, index: index };
}

function deleteWork(req) {
  var index = readKey('index');
  var id = req.id;
  var work = null;
  for (var i = 0; i < index.works.length; i++) {
    if (index.works[i].id === id) { work = index.works[i]; break; }
  }
  if (!work) return { ok: false, error: 'That work no longer exists.' };

  if (req.mode === 'archive') {
    work.status = 'Completed';
    work.archivedAt = new Date().toISOString();
    work.note = req.note || '';
    logAction('work.archive', 'Archived work "' + work.name + '"');
  } else {
    if (String(req.confirmName || '').trim() !== String(work.name).trim()) {
      return { ok: false, error: 'Type the work\'s name exactly to confirm the delete.' };
    }
    var payload = readKey('work:' + id) || { records: [] };
    var bin = pruneBin();
    bin.items.push({
      binId: 'b_' + randomString(8),
      deletedAt: new Date().toISOString(),
      work: work,
      records: payload.records
    });
    writeKey('bin', bin);
    dropKey('work:' + id);
    index.works.splice(index.works.indexOf(work), 1);
    logAction('work.delete', 'Deleted work "' + work.name + '" with '
      + payload.records.length + ' records (recoverable for ' + BIN_DAYS + ' days)');
  }

  rebuildEvents(index);
  writeKey('index', bumpVersion(index));
  return { ok: true, index: index };
}

function reorderWorks(req) {
  var index = readKey('index');
  var order = req.ids || [];
  index.works.forEach(function (w) {
    var at = order.indexOf(w.id);
    if (at !== -1) w.order = at;
  });
  index.works.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  writeKey('index', bumpVersion(index));
  logAction('work.reorder', 'Reordered works');
  return { ok: true, index: index };
}

function saveCategory(req) {
  var index = readKey('index');
  var cat = req.category || {};
  if (!String(cat.name || '').trim()) return { ok: false, error: 'The category needs a name.' };
  var found = -1;
  for (var i = 0; i < index.categories.length; i++) {
    if (index.categories[i].id === cat.id) { found = i; break; }
  }
  if (found === -1) {
    cat.id = cat.id || 'c_' + randomString(8);
    cat.order = index.categories.length;
    index.categories.push(cat);
    logAction('cat.add', 'Added category "' + cat.name + '"');
  } else {
    cat.order = index.categories[found].order;
    index.categories[found] = cat;
    logAction('cat.edit', 'Edited category "' + cat.name + '"');
  }
  writeKey('index', bumpVersion(index));
  return { ok: true, index: index };
}

function deleteCategory(req) {
  var index = readKey('index');
  var inUse = index.works.filter(function (w) { return w.categoryId === req.id; });
  if (inUse.length) {
    return { ok: false, error: inUse.length + ' work(s) still use this category. '
      + 'Move them first, then delete it.' };
  }
  index.categories = index.categories.filter(function (c) { return c.id !== req.id; });
  writeKey('index', bumpVersion(index));
  logAction('cat.delete', 'Deleted a category');
  return { ok: true, index: index };
}

/* ------------------------------------------------------------------ *
 * Records
 * ------------------------------------------------------------------ */

function getWork(req) {
  var payload = readKey('work:' + req.id);
  if (!payload) return { ok: true, records: [] };
  return { ok: true, records: payload.records || [] };
}

function saveRecord(req) {
  var key = 'work:' + req.workId;
  var payload = readKey(key) || { records: [] };
  var rec = req.record || {};
  var found = -1;
  for (var i = 0; i < payload.records.length; i++) {
    if (payload.records[i].id === rec.id) { found = i; break; }
  }
  if (found === -1) {
    rec.id = rec.id || 'r_' + randomString(10);
    rec.createdAt = new Date().toISOString();
    payload.records.push(rec);
  } else {
    rec.updatedAt = new Date().toISOString();
    payload.records[found] = rec;
  }
  writeKey(key, payload);

  var index = readKey('index');
  rebuildEvents(index, req.workId, payload.records);
  writeKey('index', bumpVersion(index));
  logAction('record.save', 'Saved a record in ' + workName(index, req.workId));
  return { ok: true, record: rec, index: index };
}

function deleteRecord(req) {
  var key = 'work:' + req.workId;
  var payload = readKey(key) || { records: [] };
  payload.records = payload.records.filter(function (r) { return r.id !== req.recordId; });
  writeKey(key, payload);

  var index = readKey('index');
  rebuildEvents(index, req.workId, payload.records);
  writeKey('index', bumpVersion(index));
  logAction('record.delete', 'Deleted a record from ' + workName(index, req.workId));
  return { ok: true, index: index };
}

function workName(index, id) {
  for (var i = 0; i < index.works.length; i++) {
    if (index.works[i].id === id) return index.works[i].name;
  }
  return 'a work';
}

/* ------------------------------------------------------------------ *
 * Event derivation — what feeds the home page's upcoming strip
 * ------------------------------------------------------------------ */

/**
 * Any field flagged timeline:true becomes an event. Passing workId and its
 * records rebuilds only that work's events; calling it bare rebuilds all,
 * which is what a work or category change needs.
 */
function rebuildEvents(index, workId, records) {
  index.events = index.events || [];

  if (workId) {
    index.events = index.events.filter(function (ev) { return ev.workId !== workId; });
    var work = null;
    for (var i = 0; i < index.works.length; i++) {
      if (index.works[i].id === workId) { work = index.works[i]; break; }
    }
    if (work) index.events = index.events.concat(eventsFor(work, records || []));
  } else {
    var all = [];
    index.works.forEach(function (w) {
      var payload = readKey('work:' + w.id);
      all = all.concat(eventsFor(w, (payload && payload.records) || []));
    });
    index.events = all;
  }

  index.events.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
  return index;
}

function eventsFor(work, records) {
  var dated = (work.fields || []).filter(function (f) {
    return f.timeline && (f.type === 'date' || f.type === 'datetime');
  });
  if (!dated.length) return [];

  var out = [];
  records.forEach(function (rec) {
    dated.forEach(function (f) {
      var value = rec[f.key];
      if (!value) return;
      out.push({
        workId: work.id,
        workName: work.name,
        categoryId: work.categoryId,
        recordId: rec.id,
        date: String(value).slice(0, 10),
        label: f.label,
        title: rec[work.titleField] || rec.title || f.label,
        done: rec.done === true || rec.status === 'Done' || rec.status === 'Completed'
      });
    });
  });
  return out;
}

/* ------------------------------------------------------------------ *
 * Recycle bin
 * ------------------------------------------------------------------ */

function pruneBin() {
  var bin = readKey('bin') || { items: [] };
  var cutoff = Date.now() - BIN_DAYS * 86400000;
  var kept = bin.items.filter(function (it) {
    return new Date(it.deletedAt).getTime() > cutoff;
  });
  if (kept.length !== bin.items.length) {
    bin.items = kept;
    writeKey('bin', bin);
  }
  return bin;
}

function restore(req) {
  var bin = pruneBin();
  var item = null;
  for (var i = 0; i < bin.items.length; i++) {
    if (bin.items[i].binId === req.binId) { item = bin.items[i]; break; }
  }
  if (!item) return { ok: false, error: 'That deleted work is no longer in the bin.' };

  var index = readKey('index');
  var work = item.work;
  work.order = index.works.length;
  index.works.push(work);
  writeKey('work:' + work.id, { records: item.records || [] });
  bin.items.splice(bin.items.indexOf(item), 1);
  writeKey('bin', bin);

  rebuildEvents(index, work.id, item.records || []);
  writeKey('index', bumpVersion(index));
  logAction('work.restore', 'Restored work "' + work.name + '"');
  return { ok: true, index: index };
}

function purgeBin() {
  writeKey('bin', { items: [] });
  logAction('bin.purge', 'Emptied the recycle bin');
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Activity log
 * ------------------------------------------------------------------ */

function logAction(kind, message) {
  try {
    var log = readKey('log') || [];
    log.unshift({ at: new Date().toISOString(), kind: kind, message: message });
    if (log.length > LOG_LIMIT) log = log.slice(0, LOG_LIMIT);
    writeKey('log', log);
  } catch (e) { /* the log is never allowed to break a real action */ }
}

/* ------------------------------------------------------------------ *
 * Starting over
 * ------------------------------------------------------------------ */

/**
 * Run this from the Apps Script editor (pick it in the function dropdown and
 * press Run) to wipe the workspace and start from first run again. Deleting
 * the Store sheet by hand is not enough on its own, because the script keeps
 * a six hour cache and the lockout counter separately.
 */
function resetWorkspace() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (sh) ss.deleteSheet(sh);
  sheet(); // recreate it empty, with its header row

  try {
    var cache = CacheService.getScriptCache();
    cache.remove('config');
    cache.remove('index');
  } catch (e) {}

  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('attempts');
  props.deleteProperty('lockUntil');

  return 'Workspace cleared. Open the site, use "Change the backend URL" or add '
    + '?reset to the address, then set a new PIN.';
}

/* ------------------------------------------------------------------ *
 * Seed — the 14 works from the FAMS+ inventory
 * ------------------------------------------------------------------ */

function defaultFields() {
  return [
    { key: 'title',  label: 'Title',  type: 'text',     timeline: false, required: true },
    { key: 'due',    label: 'Due',    type: 'date',     timeline: true },
    { key: 'status',  label: 'Status', type: 'select',   timeline: false,
      options: ['Open', 'In progress', 'Done'] },
    { key: 'notes',  label: 'Notes',  type: 'longtext', timeline: false }
  ];
}

function seedIndex() {
  var cats = [
    { id: 'cat_teach',  name: 'Teaching',       color: '#EF9F27', order: 0 },
    { id: 'cat_res',    name: 'Research',       color: '#1D9E75', order: 1 },
    { id: 'cat_admin',  name: 'Administrative', color: '#7F77DD', order: 2 }
  ];

  function work(name, catId, summary, fields, titleField, groupBy) {
    return {
      id: 'w_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      name: name,
      categoryId: catId,
      summary: summary || '',
      status: 'Active',
      academicYear: '2026-27',
      hidden: false,
      titleField: titleField || 'title',
      groupBy: groupBy || '',
      fields: fields || defaultFields()
    };
  }

  var F = {
    text: function (k, l, o) { return merge({ key: k, label: l, type: 'text' }, o); },
    longtext: function (k, l, o) { return merge({ key: k, label: l, type: 'longtext' }, o); },
    date: function (k, l, o) { return merge({ key: k, label: l, type: 'date' }, o); },
    number: function (k, l, o) { return merge({ key: k, label: l, type: 'number' }, o); },
    amount: function (k, l, o) { return merge({ key: k, label: l, type: 'amount' }, o); },
    select: function (k, l, opts, o) {
      return merge({ key: k, label: l, type: 'select', options: opts }, o);
    },
    email: function (k, l, o) { return merge({ key: k, label: l, type: 'email' }, o); },
    link: function (k, l, o) { return merge({ key: k, label: l, type: 'link' }, o); },
    people: function (k, l, o) { return merge({ key: k, label: l, type: 'people' }, o); }
  };

  function merge(base, extra) {
    if (extra) for (var k in extra) base[k] = extra[k];
    return base;
  }

  var works = [
    work('Timetable', 'cat_teach', 'Theory and lab sessions, hours remaining', [
      F.text('subject', 'Subject', { required: true }),
      F.select('kind', 'Type', ['Theory', 'Laboratory']),
      F.select('day', 'Day', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']),
      F.text('slot', 'Time slot'),
      F.text('classGroup', 'Class or batch'),
      F.number('hoursTotal', 'Hours for the term'),
      F.number('hoursTaken', 'Hours taken')
    ], 'subject', 'kind'),

    work('Class log', 'cat_teach', 'Topics covered, rosters, extra classes', [
      F.date('date', 'Date'),
      F.text('subject', 'Subject', { required: true }),
      F.text('topic', 'Topic'),
      F.select('kind', 'Class type', ['Regular', 'Extra', 'Remedial']),
      F.people('attendance', 'Attendance'),
      F.longtext('notes', 'Notes')
    ], 'topic', 'subject'),

    work('Examinations', 'cat_teach', 'Invigilation, question bank, evaluation, CIA marks', [
      F.select('kind', 'Kind of work',
        ['Invigilation', 'Question bank', 'Evaluation', 'Internal marks', 'Lab exam']),
      F.text('subject', 'Subject'),
      F.text('paper', 'Paper or exam'),
      F.date('due', 'Due', { timeline: true }),
      F.select('status', 'Status', ['Open', 'In progress', 'Done']),
      F.number('count', 'Scripts or items'),
      F.longtext('notes', 'Notes')
    ], 'paper', 'kind'),

    work('Publications', 'cat_res', 'Papers and their status', [
      F.text('title', 'Title', { required: true }),
      F.text('journal', 'Journal or venue'),
      F.select('stage', 'Stage',
        ['Draft', 'Submitted', 'Under review', 'Revision', 'Accepted', 'Published']),
      F.date('nextDate', 'Next deadline', { timeline: true }),
      F.text('authors', 'Authors'),
      F.link('doi', 'DOI or link'),
      F.longtext('notes', 'Notes')
    ], 'title', 'stage'),

    work('Projects and grants', 'cat_res', 'Funded work and milestones', [
      F.text('title', 'Project', { required: true }),
      F.text('agency', 'Funding agency'),
      F.amount('amount', 'Sanctioned amount'),
      F.select('stage', 'Stage', ['Proposed', 'Submitted', 'Sanctioned', 'Ongoing', 'Closed']),
      F.date('milestone', 'Next milestone', { timeline: true }),
      F.date('endDate', 'End date', { timeline: true }),
      F.longtext('notes', 'Notes')
    ], 'title', 'stage'),

    work('Conferences and service', 'cat_res', 'Events, peer review, collaborations', [
      F.select('kind', 'Kind', ['Conference', 'Workshop', 'Peer review', 'Editorial', 'Collaboration']),
      F.text('title', 'Name', { required: true }),
      F.text('host', 'Host or journal'),
      F.date('due', 'Date or deadline', { timeline: true }),
      F.select('status', 'Status', ['Open', 'In progress', 'Done']),
      F.longtext('notes', 'Notes')
    ], 'title', 'kind'),

    work('Researchers', 'cat_res', 'Contact database', [
      F.text('name', 'Name', { required: true }),
      F.text('affiliation', 'Affiliation'),
      F.select('sector', 'Sector',
        ['University', 'Industry', 'Government', 'National lab', 'Research institute', 'Other']),
      F.text('city', 'City'),
      F.email('email', 'Email'),
      F.link('profile', 'Profile link'),
      F.longtext('notes', 'Notes')
    ], 'name', 'sector')
  ];

  // The 13 responsibility areas, from the seed sheet in the uploaded app.
  var areas = [
    ['UG research', 'Academic programme'],
    ['Service learning', 'Academic programme'],
    ['ITEP', 'Academic programme'],
    ['Science forum', 'Event coordination'],
    ['Frontiers in Nano', 'Event coordination'],
    ['Daksh', 'Event coordination'],
    ['SAINTS 2027', 'Event coordination'],
    ['Placements', 'Student management'],
    ['Class teachership', 'Student management'],
    ['Student mentoring', 'Mentoring'],
    ['ESPRo', 'Project management'],
    ['CSA and CSP', 'Committee work'],
    ['IQAC criterion', 'Documentation']
  ];

  areas.forEach(function (a) {
    works.push(work(a[0], 'cat_admin', a[1], [
      F.text('title', 'Item', { required: true }),
      F.date('due', 'Due', { timeline: true }),
      F.select('status', 'Status', ['Open', 'In progress', 'Done']),
      F.people('people', 'People'),
      F.longtext('notes', 'Notes')
    ], 'title', ''));
  });

  works.forEach(function (w, i) { w.order = i; });

  return { version: 1, categories: cats, works: works, events: [] };
}
