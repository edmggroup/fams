/**
 * FAMS+ — Faculty Activity Management System — Google Sheets backend
 * -------------------------------------------------------------------
 * Turns a Google Sheet (living in your own Drive) into the live database
 * for the app, and sends email notifications (daily digest, deadline
 * reminders, mail merge, direct emails) via Gmail.
 *
 * This backend is deliberately simple: ONE sheet, ONE key→value table.
 * Every module in the app (Teaching, Research, Mentoring, etc.) just
 * stores its own named JSON array under one key ('timetable', 'mentees',
 * 'publications', ...) — there is no per-module sheet, no schema table,
 * no generic entity engine. This is what makes the whole system reliable
 * and easy to deploy: fewer moving parts, nothing to keep in sync.
 *
 * SETUP (one-time, ~5 minutes) — see SETUP.md for the full walkthrough.
 * Short version:
 * 1. Create a new Google Sheet (sheets.new).
 * 2. Extensions > Apps Script, paste this whole file in, save.
 * 3. Deploy > New deployment > Web app > Execute as "Me" > Access "Anyone".
 * 4. Copy the Web app URL (ends in /exec) into index.html's DATA_API_URL.
 * 5. Copy APP_KEY below into index.html's APP_KEY constant — they must match.
 *
 * EMAIL QUOTA: Gmail accounts can send ~100 emails/day this way (Google
 * Workspace accounts get more). That's normally plenty for one faculty
 * member's notifications. If it's ever exceeded, notifications silently
 * stop for the rest of the day but the app itself keeps working.
 *
 * FILE LAYOUT (everything below is grouped in this order):
 *   1. Configuration        — every value you're likely to want to change lives here
 *   2. HTTP entry points     — doGet / doPost, the only functions the app actually calls
 *   3. Auth                  — the shared-key check
 *   4. Sheet & cache helpers — low-level read/write plumbing
 *   5. Email template        — the shared "Hello, ... Regards," structure every email uses
 *   6. Email notifications   — mail merge / direct send / deadline digest
 *   7. Manual test tool      — run directly from the Apps Script editor, not the app
 *   8. Daily automatic backup
 *   9. Daily deadline reminders
 *   10. Daily working-day digest email
 */


/* ============================================================
   1. CONFIGURATION — everything you're likely to want to change
   ============================================================ */

const SHEET_NAME = 'data';

// A shared secret so random visitors who stumble on your Web App URL can't
// read/write data or send emails through it. Change this to your own
// random string, and copy the SAME value into index.html's APP_KEY constant.
const APP_KEY = 'change-this-to-your-own-random-string-2026';

// Optional short prefix added to every notification email's subject line.
// Leave as '' for no prefix. Left blank on purpose — the faculty member
// types their own subject line for every email sent from the app, so no
// app-name prefix is added on top of it.
const APP_NAME = '';

// Faculty's real office email — every email FAMS+ sends is attempted from
// this address as a Gmail "Send As" alias first (see SETUP.md §6); if that
// alias isn't verified yet, it falls back to sending as the Google account
// this script is deployed under, and always reports which address was used
// so nothing fails silently.
const OFFICE_EMAIL = 'krishnakumar.m@christuniversity.in';

const SYSTEM_SIGN_OFF = 'FAMS+ — Faculty Activity Management System\nDr. Krishna Kumar M, Department of Physics and Electronics\nCHRIST (Deemed to be University), Bengaluru';

// How long a cached read is considered fresh. Any write immediately clears
// the cache, so this only affects back-to-back reads — it never serves
// stale data across a save. Keep this short; it's a speed boost only.
const CACHE_TTL_SECONDS = 25;

const DAILY_BACKUP_FILE_NAME = 'fams-plus-daily-backup.json';
const CACHE_KEY = 'all_rows_v1';

// Which working days the daily digest / deadline reminders run on.
// 0=Sunday .. 6=Saturday.
const WORKING_DAYS = [1, 2, 3, 4, 5]; // Mon–Fri


/* ============================================================
   2. HTTP ENTRY POINTS — the only functions the web app calls
   ============================================================ */

function doGet(e) {
  if (!checkKey_(e.parameter.key_check)) return jsonOut_({ error: 'Unauthorized' });
  const action = e.parameter.action;

  if (action === 'get') {
    const map = getAllRowsCached_();
    const v = map[e.parameter.key];
    return jsonOut_({ key: e.parameter.key, value: (v !== undefined && v !== '') ? v : null });
  }

  if (action === 'getAll') {
    // Reads the sheet ONCE (or serves from cache) and returns every requested
    // key in a single response — this is what makes load time fast instead
    // of one round-trip (and one sheet read) per collection.
    const keys = (e.parameter.keys || '').split(',').filter(Boolean);
    const map = getAllRowsCached_();
    const result = {};
    keys.forEach(function (k) {
      const v = map[k];
      result[k] = (v !== undefined && v !== '') ? v : null;
    });
    return jsonOut_({ values: result });
  }

  return jsonOut_({ error: 'Unknown action: ' + action });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ error: 'Invalid JSON body' });
  }

  if (!checkKey_(body.appKey)) return jsonOut_({ error: 'Unauthorized' });

  if (body.action === 'notify') {
    try {
      sendNotification_(body.type, body.payload || {});
      return jsonOut_({ ok: true });
    } catch (err) {
      return jsonOut_({ ok: false, error: String(err) });
    }
  }

  if (body.action === 'testEmail') {
    try {
      if (!body.to) return jsonOut_({ ok: false, error: 'No recipient email provided' });
      sendAs_(body.to, subjectFor_('Test email'),
        emailBody_('If you received this, email notifications are working correctly for this deployment. This was sent at ' + new Date().toString() + '.', SYSTEM_SIGN_OFF)
      );
      return jsonOut_({ ok: true, remainingQuota: MailApp.getRemainingDailyQuota(), sentAs: lastSendAsUsed_ });
    } catch (err) {
      return jsonOut_({ ok: false, error: String(err), remainingQuota: MailApp.getRemainingDailyQuota() });
    }
  }

  if (body.action === 'mailMerge') {
    try {
      const results = runMailMerge_(body.recipients || [], body.subject || '', body.bodyTemplate || '');
      return jsonOut_({ ok: true, results: results, remainingQuota: MailApp.getRemainingDailyQuota() });
    } catch (err) {
      return jsonOut_({ ok: false, error: String(err) });
    }
  }

  const sheet = getSheet_();
  if (!body.key) return jsonOut_({ error: 'Missing key' });

  if (body.action === 'delete') {
    deleteKey_(sheet, body.key);
    invalidateCache_();
    return jsonOut_({ ok: true, deleted: body.key });
  }

  setValue_(sheet, body.key, body.value);
  invalidateCache_();
  return jsonOut_({ ok: true, key: body.key });
}


/* ============================================================
   3. AUTH
   ============================================================ */

function checkKey_(providedKey) {
  return providedKey === APP_KEY;
}


/* ============================================================
   4. SHEET & CACHE HELPERS — low-level read/write plumbing
   ============================================================ */

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['key', 'value']);
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('@'); // keys are always plain text
  }
  return sheet;
}

function getAllRowsCached_() {
  const cache = CacheService.getScriptCache();
  try {
    const cached = cache.get(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    // Cache miss or corrupt cache entry — fall through to a real read.
  }
  const sheet = getSheet_();
  const rows = sheet.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < rows.length; i++) {
    map[rows[i][0]] = rows[i][1];
  }
  try {
    // CacheService caps each value at 100KB. If the data grows past that,
    // this silently fails and every read just falls back to a normal
    // (still correct, just not cache-accelerated) sheet read.
    cache.put(CACHE_KEY, JSON.stringify(map), CACHE_TTL_SECONDS);
  } catch (err) { /* too large to cache — fine, reads just go straight to the sheet */ }
  return map;
}

function invalidateCache_() {
  try { CacheService.getScriptCache().remove(CACHE_KEY); } catch (err) { /* no-op */ }
}

function findRow_(sheet, key) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === key) return i + 1; // 1-indexed sheet row
  }
  return -1;
}

function getValue_(sheet, key) {
  const row = findRow_(sheet, key);
  if (row === -1) return null;
  const val = sheet.getRange(row, 2).getValue();
  return val === '' ? null : val;
}

function setValue_(sheet, key, value) {
  const row = findRow_(sheet, key);
  if (row === -1) {
    sheet.appendRow([key, value]);
  } else {
    sheet.getRange(row, 2).setValue(value);
  }
}

function deleteKey_(sheet, key) {
  const row = findRow_(sheet, key);
  if (row !== -1) sheet.deleteRow(row);
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getCollection_(key) {
  const raw = getValue_(getSheet_(), key);
  try { return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
}


/* ============================================================
   5. EMAIL TEMPLATE
   ============================================================ */

function subjectFor_(text) {
  return APP_NAME ? (APP_NAME + ': ' + text) : text;
}

function emailBody_(message, signOff, greeting) {
  return (greeting || 'Hello,') + '\n\n' + message + '\n\nRegards,\n' + signOff;
}

// Tries to send as the real office email (a verified Gmail "Send As" alias)
// first; if that alias isn't verified yet, falls back to sending as
// whichever Google account this script is deployed under. Either way it
// records which address was actually used, so nothing fails silently —
// see SETUP.md §6 for how to verify the alias.
var lastSendAsUsed_ = '';
function sendAs_(to, subject, body) {
  try {
    const aliases = GmailApp.getAliases();
    if (aliases.indexOf(OFFICE_EMAIL) !== -1) {
      GmailApp.sendEmail(to, subject, body, { from: OFFICE_EMAIL });
      lastSendAsUsed_ = OFFICE_EMAIL;
      return;
    }
  } catch (err) { /* fall through to default send */ }
  MailApp.sendEmail(to, subject, body);
  lastSendAsUsed_ = Session.getActiveUser().getEmail() || '(deployment account)';
}


/* ============================================================
   6. EMAIL NOTIFICATIONS — mail merge, direct send, deadline digest
   ============================================================ */

const NOTIFICATION_HANDLERS = {
  // A generic "send one email now" action, used by every module's
  // "Email this person" / "WhatsApp" button flow for the email half.
  directEmail: function (p) {
    if (!p.to) return;
    sendAs_(p.to, subjectFor_(p.subject || 'Message from FAMS+'), emailBody_(p.message || '', SYSTEM_SIGN_OFF, p.greeting));
  }
};

function sendNotification_(type, p) {
  const handler = NOTIFICATION_HANDLERS[type];
  if (handler) handler(p);
}

// Mail merge: sends the same templated message to a list of recipients,
// substituting {{field}} placeholders per-recipient. Returns a per-recipient
// result list so the UI can show exactly who succeeded/failed and why.
function runMailMerge_(recipients, subject, bodyTemplate) {
  const results = [];
  recipients.forEach(function (r) {
    if (!r.email) { results.push({ email: '', name: r.name || '', ok: false, error: 'No email address' }); return; }
    try {
      let subj = subject, body = bodyTemplate;
      Object.keys(r).forEach(function (k) {
        const re = new RegExp('\\{\\{' + k + '\\}\\}', 'g');
        subj = subj.replace(re, r[k] == null ? '' : String(r[k]));
        body = body.replace(re, r[k] == null ? '' : String(r[k]));
      });
      sendAs_(r.email, subjectFor_(subj), body);
      results.push({ email: r.email, name: r.name || '', ok: true });
    } catch (err) {
      results.push({ email: r.email, name: r.name || '', ok: false, error: String(err) });
    }
  });
  return results;
}


/* ============================================================
   7. MANUAL TEST TOOL
   ------------------------------------------------------------
   Not called by the app at all — this is here so you can select
   "testMail" from the function dropdown at the top of the Apps
   Script editor and click Run, as a quick sanity check that this
   script is allowed to send email at all, independent of the app.
   ============================================================ */

function testMail() {
  sendAs_(OFFICE_EMAIL, 'FAMS+ Test', emailBody_('If you receive this, Apps Script email is working. Sent as: ' + lastSendAsUsed_, SYSTEM_SIGN_OFF));
}


/* ============================================================
   8. DAILY AUTOMATIC BACKUP
   ------------------------------------------------------------
   dailyBackup_() writes every collection currently stored in the
   sheet to ONE Drive file (DAILY_BACKUP_FILE_NAME), overwriting
   it each time — so Drive never accumulates a new file per day,
   just one always-current snapshot.

   ONE-TIME SETUP (~30 seconds):
     1. In the Apps Script editor, select "setUpDailyBackupTrigger"
        from the function dropdown at the top.
     2. Click Run. Approve the authorization prompt if asked.
     3. Done — it now runs automatically once a day from here on.
   ============================================================ */

function dailyBackup_() {
  const map = getAllRowsCached_();
  const content = JSON.stringify({ backedUpAt: new Date().toISOString(), data: map }, null, 2);
  const existing = DriveApp.getFilesByName(DAILY_BACKUP_FILE_NAME);
  if (existing.hasNext()) {
    existing.next().setContent(content);
  } else {
    DriveApp.createFile(DAILY_BACKUP_FILE_NAME, content, MimeType.PLAIN_TEXT);
  }
}

function setUpDailyBackupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyBackup_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyBackup_').timeBased().everyDays(1).atHour(23).create();
}


/* ============================================================
   9. DAILY DEADLINE REMINDERS
   ------------------------------------------------------------
   Emails a summary of anything due within the next 3 days across
   every module that has a date field — leave, exams, meetings,
   action items, reminders, project deadlines, and more. Nothing
   is sent if there's nothing due.

   Same one-time setup as the daily backup above, selecting
   "setUpDailyReminderTrigger" instead.
   ============================================================ */

// [ collectionKey, dateField, statusField, "done" values to skip, label ]
const DEADLINE_SOURCES = [
  ['leave-records', 'fromDate', 'status', ['Rejected'], 'Leave/OD'],
  ['invigilation-duties', 'date', null, [], 'Invigilation Duty'],
  ['evaluations', 'deadline', 'status', ['Completed'], 'Evaluation'],
  ['mentee-meetings', 'date', null, [], 'Mentoring Meeting'],
  ['lab-exams', 'date', null, [], 'Lab Exam'],
  ['extra-classes', 'date', null, [], 'Extra Class'],
  ['research-targets', 'targetDate', 'status', ['Completed'], 'Research Target'],
  ['project-grants', 'endDate', 'status', ['Closed', 'Completed'], 'Project/Grant deadline'],
  ['committees', null, null, [], ''], // no date field, skipped
  ['meetings', 'date', 'status', ['Completed'], 'Meeting'],
  ['action-items', 'dueDate', 'status', ['Done'], 'Action Item'],
  ['reminders', 'dueDate', 'status', ['Done'], 'Reminder'],
  ['office-followups', 'followUpDate', 'status', ['Resolved'], 'Office Follow-up']
];

function dailyDeadlineReminders_() {
  const today = new Date();
  const windowEnd = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
  const todayStr = today.toISOString().slice(0, 10);
  const windowEndStr = windowEnd.toISOString().slice(0, 10);
  const inWindow = function (d) { return d && d >= todayStr && d <= windowEndStr; };

  const lines = [];
  DEADLINE_SOURCES.forEach(function (src) {
    const key = src[0], dateField = src[1], statusField = src[2], doneValues = src[3], label = src[4];
    if (!dateField) return;
    getCollection_(key).forEach(function (item) {
      if (item.deleted) return;
      const d = item[dateField];
      if (!inWindow(d)) return;
      if (statusField && doneValues.indexOf(item[statusField]) !== -1) return;
      const title = item.title || item.subject || item.description || item.eventName || item.examName || '(untitled)';
      lines.push(label + ': "' + title + '" — ' + d);
    });
  });

  if (lines.length === 0) return;
  const message = lines.length + ' item(s) due in the next 3 days:\n\n' + lines.map(function (l) { return '- ' + l; }).join('\n') + '\n\nOpen FAMS+ to see full details.';
  sendAs_(OFFICE_EMAIL, subjectFor_('Upcoming deadlines — next 3 days'), emailBody_(message, SYSTEM_SIGN_OFF));
}

function setUpDailyReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyDeadlineReminders_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyDeadlineReminders_').timeBased().everyDays(1).atHour(7).create();
}


/* ============================================================
   10. DAILY WORKING-DAY DIGEST EMAIL
   ------------------------------------------------------------
   A short "here's today" summary — today's timetable slots, and
   anything due today specifically — sent only on working days
   (WORKING_DAYS above), skipping weekends and any date listed in
   the Holidays module automatically.

   Same one-time setup, selecting "setUpDailyDigestTrigger".
   ============================================================ */

function isWorkingDayToday_() {
  const day = new Date().getDay();
  if (WORKING_DAYS.indexOf(day) === -1) return false;
  const todayStr = new Date().toISOString().slice(0, 10);
  const isHoliday = getCollection_('holidays').some(function (h) { return h.date === todayStr && !h.deleted; });
  return !isHoliday;
}

const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dailyDigest_() {
  if (!isWorkingDayToday_()) return;
  const todayStr = new Date().toISOString().slice(0, 10);
  const dow = DOW_NAMES[new Date().getDay()];

  const classesToday = getCollection_('timetable')
    .filter(function (t) { return !t.deleted && t.day === dow; })
    .sort(function (a, b) { return (a.startTime || '').localeCompare(b.startTime || ''); });

  const dueToday = [];
  DEADLINE_SOURCES.forEach(function (src) {
    const key = src[0], dateField = src[1], statusField = src[2], doneValues = src[3], label = src[4];
    if (!dateField) return;
    getCollection_(key).forEach(function (item) {
      if (item.deleted) return;
      if (item[dateField] !== todayStr) return;
      if (statusField && doneValues.indexOf(item[statusField]) !== -1) return;
      const title = item.title || item.subject || item.description || item.eventName || item.examName || '(untitled)';
      dueToday.push(label + ': "' + title + '"');
    });
  });

  const lines = [];
  lines.push('Today is ' + todayStr + ' (' + dow + ').');
  lines.push('');
  if (classesToday.length) {
    lines.push('Today\'s classes:');
    classesToday.forEach(function (c) { lines.push('- ' + (c.startTime || '') + '–' + (c.endTime || '') + ' ' + (c.subject || '') + ' (' + (c.section || '') + ', ' + (c.venue || '') + ')'); });
  } else {
    lines.push('No classes scheduled today.');
  }
  lines.push('');
  if (dueToday.length) {
    lines.push('Due today:');
    dueToday.forEach(function (l) { lines.push('- ' + l); });
  } else {
    lines.push('Nothing else due today.');
  }
  lines.push('');
  lines.push('Open FAMS+ for full details.');

  sendAs_(OFFICE_EMAIL, subjectFor_('Daily digest — ' + todayStr), emailBody_(lines.join('\n'), SYSTEM_SIGN_OFF));
}

function setUpDailyDigestTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyDigest_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyDigest_').timeBased().everyDays(1).atHour(7).nearMinute(30).create();
}

// Convenience: run all three setup functions in one click from the Apps
// Script editor's function dropdown, instead of running each separately.
function setUpAllTriggers() {
  setUpDailyBackupTrigger();
  setUpDailyReminderTrigger();
  setUpDailyDigestTrigger();
}
