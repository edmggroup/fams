# FAMS+ — Faculty Activity Management System

Dr. Krishna Kumar M · Department of Physics and Electronics · CHRIST (Deemed to be University), Bengaluru

A complete rebuild of FAMS+ on a much simpler, more reliable architecture: one Google
Sheet as the database, one small Apps Script file exposing a plain JSON API, and one
static `index.html` file as the entire frontend — hosted for free on GitHub Pages and
installable to your phone's home screen as an app (PWA).

**Start here: [`SETUP.md`](./SETUP.md)** — a step-by-step guide, no coding experience or
command line required, ~10–15 minutes.

## Why this version is different

Earlier versions of FAMS+ used Google Apps Script's `HtmlService` +
`google.script.run` bridge, a generic schema-driven database engine, and `clasp` for
deployment from the command line. That architecture turned out to be fragile in
practice — silent data-loss bugs in the browser↔script bridge, a two-step
push-then-redeploy process that was easy to forget, and confusing multi-file project
layout.

This version instead uses:
- A **plain HTTP JSON API** (`doGet`/`doPost` in `backend/Code.gs`) instead of
  `google.script.run` — a `fetch()` call either gets real JSON back or a real network
  error, with no silent-failure mode in between.
- **One key→value Sheet** instead of a generic multi-sheet entity engine — every module
  (Teaching, Research, Mentoring, …) just stores its own JSON array under one named key.
  Simpler to reason about, simpler to back up, simpler to debug by just opening the
  Sheet.
- **One deployment** for the backend and **direct GitHub Pages hosting** for the
  frontend — no `clasp`, no separate redeploy step to forget. Edit `Code.gs` in the
  browser-based Apps Script editor and hit Deploy; edit `index.html` and commit to
  GitHub. Nothing else to keep in sync.
- A **PIN-only login** (no separate Faculty ID needed — this is a single-faculty app)
  with a plain 4-digit PIN field and a lockout after repeated wrong attempts.

## What's included

Every module from the original 32-requirement scope is here: Timetable (with a real
weekly grid view, per-session Theory/Laboratory type + batch number, and a Subject
Hours Summary showing hours taken vs. hours remaining for the term), Leave/OD,
Holidays, Class Log (with per-class topic notes and an optional embedded student
attendance list), Invigilation Duty, Question Bank, Evaluations, Internal Marks (CIA-1 /
Mid Sem / CIA-3, with bulk Excel import and an Analytics chart), Lab Timetable & Lab
Exams, Extra Classes, Plans (formerly "Targets & Progress"), Publications,
Collaborations, Research Events, Peer Review, Researcher Network, Projects & Grants,
In-Charges and Committees (each with its members entered directly inline as part of the
record — batch, class, section, whatever's relevant — no separate linked module to
manage; this is also where mentoring and class-teacher/responsibility roles live now —
see below), Meetings, Action Items, Reminders, and Office Follow-ups (reached via
"quick add" buttons on the Dashboard, not their own nav tab — see below), plus a Work
Diary, a Dashboard (compact hero with live clock + quote, one-tap quick-add buttons for
every day-to-day module, one consolidated stat strip, today's schedule, upcoming
deadlines, progress, and recent activity — every item links straight through to the
record it came from),
Analytics (compact, consistently-sized Chart.js charts across your data), a unified
Calendar, Reports & export (CSV, Excel, Word, PDF, and plain text — filterable by week,
month, semester, academic year, or the whole dataset — see below), Mail Merge (its own
nav button), an Activity Log (see below), and an Administrator screen (profile, PIN
change, current academic term with full term-history preservation, test email, a
data-management shortcut to jump into any menu's records, trigger setup instructions).

### Class Rosters — a class's student list, entered once, reused everywhere

Timetable's "All entries" list now has a **👥 Class Roster** button on every class — and
the same **👥** button now also sits directly on each populated cell of the weekly grid
itself, not just in the list below it, so it's just as reachable from the view you
actually look at day to day. Click it once to build that class's student list (Name, Reg
No, Email, Phone) — matched **by Subject Code first when both entries have one** (falling
back to matching by Subject text otherwise), plus Section, so if the same class meets more
than once a week (e.g. Monday and Wednesday) both Timetable slots reliably share the one
roster even if the Subject text itself was typed slightly differently between the two
entries — Subject Code is short and stable, so it's the more trustworthy match. Clicking
the button again from either slot just reopens the same roster for editing rather than
starting a second one.

Building the list by hand one row at a time isn't the only option any more: the Students
subtable on the roster's own Add/Edit form now has an **⬆ Import from Excel** button right
next to "+ Add Student" — pick a spreadsheet with Name/Reg. No./Email/Phone columns (any
order, matched by column header the same way Bulk Import already matches columns
elsewhere) and every row lands in the table in one go, skipping rows that duplicate a Reg.
No. already in the list or that are entirely blank. It works the same way on any other
module's subtable shaped like a student list, not just Class Rosters.

Two places now pull from that roster instead of asking for the same names again:

- **Internal Marks (CIA)** — a new **👥 Import from Class Roster** button next to Bulk
  Import. Pick a roster (optionally stamp an Academic Year), and one Internal Marks row
  is created per student — Reg No, Name, Subject, Subject Code, and Section already
  filled in, marks left blank for you to enter. Running it again later (say, after adding
  a late-joining student to the roster) only adds the new name — anyone already imported
  is skipped, not duplicated.
- **Class Log** — its "Students" attendance subtable gets a **📋 Load from Class Roster**
  button right underneath it on the Add/Edit form. Fill in Subject and Section, click it,
  and every roster student is added as a row (mark each Present/Absent from there) —
  anyone you've already added by hand is left alone, not overwritten.

This same "📋 Load from Class Roster" button will automatically show up next to any
*other* module's subtable field shaped like a student list (a Name + Reg No column, on a
module that also has its own Subject field) — it isn't hardcoded to Class Log specifically.

### Every Add/Edit form is now wider, laid out in columns instead of one long scroll

The Add/Edit drawer is now wider (up to ~820px instead of 520px) and every form inside it
— Researcher Network's 20+ fields included — lays its fields out as a responsive
multi-column grid instead of one field per row. A field that genuinely needs the full
width (a paragraph/notes box, a Members-style table, a checklist) still spans the whole
row; everything else — Name, Email, Priority, Country, and so on — sits two or three to a
row, so a long form fits mostly in one screen instead of a long single-column scroll. This
applies to every module automatically (it's the same generic form engine every Add/Edit
screen already shares), and still narrows back down to one column on a phone-width screen.

### "Mark Complete" on Action Items, Reminders, Office Follow-ups, and Meetings now asks for a closing comment

Closing out an open item is now its own **✅ Mark Complete** (or **✅ Mark Resolved**)
button on the list row, instead of just flipping its Status dropdown in the edit form. It
requires a short closing comment — how it was resolved, what came out of the meeting —
before it'll save; that comment is saved straight into the record's own Notes tab, so
there's always a record of *why* something was closed, not just *that* it was. The button
disappears once an item is already at its terminal status (Done/Resolved/Completed), and a
Cancelled meeting doesn't offer it either.

A follow-up audit checked every module with a clear open→done status field and found 8
more that had a Status dropdown but no one-click way to close it out the same way:
**Evaluations, Plans, Publications** (✅ Mark Published), **Collaborations, Peer Review &
Editorial, Projects & Grants, In-Charges, and Committees** all now get the same ✅
Mark Complete button and closing-comment prompt. A few modules were deliberately left
without it: **Leave/OD** (Applied/Approved/Rejected are two different terminal outcomes,
not one "done" value a single button can capture), **Class Log** and **Timetable**
(these record a class's state — Held/Cancelled/Rescheduled, or a recurring slot's own
status — rather than a pending task working toward completion), and the legacy
**Responsibilities** module (no status field at all).

### Roles & Responsibilities has been redesigned — create your own responsibilities, each with its own menus

Clicking **Roles & Responsibilities** now opens onto **Responsibility Areas** — a menu of
your own, where you create one record per area of work (UG Research, Science Forum,
Service Learning, Placements, IQAC Criterion, or anything else you're assigned). Each
record has a Name, an Icon, a Nature of Work (Academic Programme, Event Coordination,
Student Management, Committee Work, Financial Tracking, Documentation, Mentoring, Project
Management, or Other), an Academic Year, a Status, and a Description. The list itself
stays compact no matter how many you add — it shows only **#, Name, Academic Year** and
the row's action buttons, which now sit on one row (Edit, Notes, ✅ Mark Completed, ➕ Add
a Menu, 🔁 Renew, Delete) since trimming the list down to three data columns leaves them
the room; on a narrow window they wrap onto a second line rather than forcing horizontal
scrolling, but never force it. Icon, Nature of Work and Status are still fully editable,
and shown on that responsibility's own dialog (below) — they just don't need a whole
column each in the list.

The flexible part: click **➕ Add a Menu** on any Responsibility Area's row (or from its own
dialog — see below), and it opens the existing **Custom Menus** form pre-attached to that
responsibility — build whatever fields that particular responsibility actually needs (a
student roster, a budget tracker, an event log, a documentation checklist — literally any
of the field types Custom Menus already supports).

**Each responsibility is one menu; its attached menus are its sub-menus.** Once a
responsibility has at least one menu attached, it shows up as a single, flat entry in the
Roles & Responsibilities nav — click it and a small dialog opens with that responsibility's
Nature of Work / Academic Year / Status / Description at the top, and a row of buttons
underneath, one per attached menu. Click one of those buttons to go straight into that
menu's own normal list screen (add/edit/delete records exactly as in any other menu).
Attaching three menus to "UG Research" gives you one "UG Research" entry in the nav whose
dialog has three sub-menu buttons; attaching one to "Service Learning" gives a one-button
dialog. Nothing about what a responsibility "is" is hardcoded — that's the whole point —
and the main nav dropdown itself never grows past one line per responsibility, no matter
how many menus are attached underneath.

That same dialog also has the responsibility's own **Edit / Notes / ✅ Mark Completed for
this Year / ➕ Add a Menu / 🔁 Renew / Delete** actions, so managing a responsibility and
opening its work are both one click from the same place.

**Year-to-year variance:** every Responsibility Area has a Status (Active / On Hold /
Completed). Two ways to close one out at year-end:

- **✅ Mark Completed for this Year** — asks for a short wrap-up note (outcomes, handover
  info), then removes that responsibility's nav entry (and dialog) to keep things
  uncluttered. Nothing is deleted — every menu and record under it stays exactly as it
  was, and stays reachable via Reports or Admin & Settings ▸ Data Management's "Jump to
  menu" (or by switching its Status back to Active).
- **🔁 Renew** — for a responsibility that starts fresh each year (a new cohort, a new
  budget cycle): creates a new Responsibility Area record for the next academic year
  (guesses the next year from the current one, e.g. "2026-27" → "2027-28") and marks the
  current one Completed. You then attach fresh menus to the new one with "➕ Add a Menu" —
  last year's data stays exactly where it is, untouched.
- For a responsibility that just **continues** year over year without needing a clean
  break (e.g. UG Research spanning multiple cohorts), skip Renew — instead give its
  attached menu a "Group the list by" field (e.g. "Batch" or "Year") the same way UG
  Research already does, so every year's students live in the same menu, grouped.

Also new: Meetings, Reminders, and Action Items' **"Related To — Menu"** picker now covers
every real menu in the app (previously limited to Roles & Responsibilities + custom
menus) — so a follow-up can be attached to a class, an exam, a project, a committee, a
responsibility's own custom menu, or anything else, not just a narrow subset.

**In-Charges and Committees no longer have their own entries under Roles &
Responsibilities** — removed from that nav section on request, since Responsibility Areas
now covers the same ground more flexibly. This is purely a nav change: both menus and
every record already in them are completely untouched, and stay fully reachable via Admin
& Settings ▸ Data Management's "Jump to menu", via Reports, and as a "Related To" target
on Meetings/Reminders/Action Items. If you'd rather have In-Charges or Committees back as
their own menu, they're one line to restore in `index.html` — see the comment beside
`NAV_CATEGORIES['admin-duties']`.

**Every dialog box across the whole app reads shorter now.** Every field label that used
to have an example or explanation crammed into it — in parentheses or after a dash (e.g.
"Academic Year (e.g. 2026-27 — optional; use…)", "Duration (hours)", "Owner — who this is
assigned to") — is now just the plain short label ("Academic Year", "Duration", "Owner").
Nothing is lost: a small **"?" help button** appears next to any label that has more to
say — click it to reveal that one field's guidance right under the input, click again (or
just move on) to hide it. This also fixed a real usability bug: list views build their
column headers straight from these same field labels, so the old long labels were
literally what forced some lists (Action Items in particular) into horizontal scrolling —
short labels fix both the dialog boxes and the list headers at once.

### A real navigation memory leak was found and fixed

A performance pass across the whole app turned up one genuine bug: two click/keyboard
listeners that close an open nav dropdown were being re-attached on every single
navigation (`wireShell()` runs on every render — every menu click, every save, every
login) to `document` itself, which never gets rebuilt the way the rest of the top bar
does. They never got removed, so a long working session — hundreds of navigations —
was quietly accumulating hundreds of duplicate listeners, all doing the same check on
every click and keypress for the rest of the page's life. They're now wired once, the
first time the shell loads, instead of once per navigation — same behavior, no leak.

### Research menus now capture the details connected to that kind of work, not just a name and a date

**Conferences, Workshops** picked up a full set of the fields a real conference actually
involves: a **Type** (Conference/Workshop/Seminar/FDP/Symposium/Webinar/Other), **Venue**,
**Mode** (In-Person/Online/Hybrid), **Organized By**, **Abstract Deadline**, **Paper /
Abstract Title** (if you're presenting), **Website**, and **Registration Fee**, alongside
the Event Name/Role/Date/Time fields already there. The list itself stays exactly as
compact as before — Event Name, Event Date, Type, Role — the new fields live on the
dialog box, not the list header, the same "detail in the dialog, not in the list" split
used everywhere else in this round. **Plans, Publications, Collaborations,** and **Peer
Review & Editorial** got the same treatment: Plans gained a Category, Priority, Linked To,
and Expected Outcome; Publications gained Publication Date, Indexing, Impact Factor,
Volume/Issue, Pages, and ISSN/ISBN; Collaborations gained a Type, Start Date, Website, and
Outputs; Peer Review gained a Review Deadline, Indexing, and Review Portal Link — again,
all on the dialog, none of it widening the list.

### Action Items: "Related To" instead of a single "Meeting" link, and Action comes first

Action Items used to only ever link to a Meeting, and that Meeting field was the very
first thing the Add form asked for. It's now the same general **Related To — Menu /
Related To — Specific Record** pair Meetings and Reminders already use — an action item
can be raised against anything (a project, a committee, a responsibility's own custom
menu, a meeting, or nothing at all) — and **Action** is the first field on the form, since
that's usually what you type first. Meetings' **☑️ Action Required** button still raises
one pre-linked back to that meeting, same as before. Any action item that was already
linked to a meeting keeps that link automatically (a one-time, invisible data migration).

### Office Follow-ups: "Subject" renamed to "Name of the Work"

Same field, clearer label — it's asking what the piece of work is, not an email subject
line.

### Timetable's own Subject field stays plain free text

Every OTHER module that asks for a Subject (Class Log, Question Bank, Internal Marks
(CIA), Extra Classes) offers Timetable's existing subjects as a suggestion dropdown while
you type. Timetable's own Subject field does **not** — Timetable is where a subject is
born, so its first entry has nothing to suggest from yet, and forcing a dropdown there
would only ever offer subjects that already exist.

### A few built-in menus were renamed

"Researcher Network" → **Researcher's Database**; "Peer review / editorial" → **Peer
Review & Editorial**; "Research events" → **Conferences, Workshops**; the "Research"
section header → **Research Plans**; "Projects & grants" → **Projects & Grants**; "Lab
timetable" → **Lab Timetable**; "Lab exams" → **Lab Exams**; "Extra / additional classes"
→ **Extra / Additional Classes**. Purely cosmetic — nothing about the underlying data or
fields changed, and every one of these can still be renamed again from Admin & Settings ▸
Menu Names if you'd prefer something else.

### Mentoring and Class-Teacher responsibilities now live under In-Charges

Mentees, Mentoring Meetings, and the old standalone Responsibilities module are gone as
separate menus — In-Charges already models exactly the same shape ("a role, with a
roster of people attached to it"), so add a role there instead: e.g. a "Student
Mentoring" or "Class Teacher — Section A" In-Charge record, with your mentees/students
entered as members directly on it. Existing data isn't lost — on first load after
updating, any previously-saved Mentees and Responsibilities records are automatically
folded into new In-Charges records for you, one time only.

### Academic term history

Admin & Settings → Academic Term lets you set the academic year, semester, and term
start/end dates. **Save** corrects the current term in place; **Start New Term**
archives the current term into a preserved history list and makes your new entry the
current one — so nothing from a past semester is ever lost, it's just no longer the
"live" term shown across the app. The current term is reflected everywhere (top
navigation, Dashboard, Reports) automatically.

### Reports, filterable by period

Every report and export — CSV, Excel, Word, PDF, plain text, and the full
multi-module exports — can be scoped to the current week, current month, any specific
past or present academic term/semester, a whole academic year, or the entire dataset,
via a Period selector on the Reports screen.

### Bulk add via Excel/CSV

Every module that lists people (Researcher Network) — the Timetable — and Internal
Marks (CIA-1 / Mid Sem / CIA-3) has a **⬆ Bulk Import** button next to "+ Add". It
downloads a blank template matching that module's exact columns, or accepts a filled-in
`.xlsx`/`.xls`/`.csv` file, shows a preview of what it parsed (with any skipped rows
explained), and imports everything in one go. Parsing happens entirely in the browser
(via SheetJS) — nothing is uploaded anywhere except the final records, saved to your own
backend the normal way. (Members embedded inside In-Charges and Committees are entered
as inline rows on that record instead, since they're not a separate module.) A subtable
field itself — the "list within a form" shape used by Class Rosters' Students, UG
Research's Semester Marks, and similar — has its own matching **⬆ Import from Excel**
right on the subtable (see Class Rosters, above), since a whole nested mini-table isn't
representable as flat spreadsheet columns the same way the rest of a record is.

### Reports in CSV, Excel, Word, PDF, or plain text

**Reports** offers five export formats per module — CSV, Excel (`.xlsx`), Word (`.doc`,
opens natively in Microsoft Word), PDF (via your browser's print dialog / the native
print bridge in the Android app), and plain text — plus one-click "export everything" in
any of Excel, Word, PDF, or Text covering every module in a single file, on top of the
full JSON backup.

### Admin-configurable custom menus

Need a whole menu FAMS+ doesn't have built in — a departmental register, a grants
tracker, anything? **Admin & Settings → 🧩 Manage Custom Menus** lets you add one
yourself, no coding required: a name, an icon, which tab it lives under, and a list of
fields (one per line: `Label|type|options|required`). It appears in the navigation
immediately and gets every generic-engine feature for free — search, add/edit, bulk
import, bulk email, bulk delete, notes, activity log, and every report format. Each
custom menu keeps its own separate storage key, so adding one never touches any other
menu's data or code — safe to add anytime, even after the app is in daily use. Editing
an existing custom menu's name, icon, tab, or field list (from its own list — click
**Edit** on that definition, same as editing any other record) takes effect immediately,
no page reload needed.

Starting from a blank field list isn't the only option: the Add form (only when creating
a brand-new custom menu — never on one you're editing) offers a **"Start from a
template"** picker with 7 ready-made starting points for the kind of sub-menu a
Responsibility Area's "➕ Add a Menu" most often needs — 🗒️ Minutes / Meeting Notes,
🔗 Links & Resources, 📝 Work Done / Activity Log, 📄 Reports, ✅ Status Tracker,
🎓 Student In-Charges, and 🙋 Volunteers. Picking one fills in the Name, Icon, and Fields
box for you — everything stays fully editable before you save, and the Student
In-Charges / Volunteers templates already include Email and Phone fields, so they
automatically pick up the same one-click ✉️/💬 buttons every other menu with an Email
field gets, for free.

### Data management, from Admin & Settings

Every menu already supports deleting (and later restoring) individual or
bulk-selected records right from its own list — the 🗑 action on each row, or
select multiple rows and use "Delete Selected". **Administrator → 🗑️ Data
Management** adds a quick way to jump straight into any menu's records from one
place, plus a dedicated clear action for the Activity Log — the one place in the
app that's read-only everywhere else, since it's a history trail rather than a
menu of records you'd otherwise edit or delete from directly.

### Link Meetings/Reminders/Action Items to any menu or record in the app

Meetings, Reminders, and Action Items all have a two-step **"Related To"** picker: choose
a menu, then choose the specific record in it — a student, a project, a committee, a
class, an exam, whatever's relevant. The "menu" choice covers every real menu in the app
(Timetable, Class Log, In-Charges, Committees, Holidays, your own custom menus, and so
on) — only the two internal registries (Custom Menus & Fields itself, and the read-only
Activity Log) are left out, since neither holds the kind of "specific record" this field
is for. The list view shows the resolved name directly (not just a raw ID), and it works
the same way for records added after the fact, so linking stays useful as your data grows.
Both Action Items and Reminders now also have their own **Description** field — a short
free-text box for a brief on the task itself, separate from the one-line Action/Title —
since not everything fits in a single line.

That link now shows up from the other side, too: every record's own Add/Edit drawer has a
**🔗 Linked** tab, right next to Notes, listing every Meeting, Reminder, and Action Item
whose "Related To" currently points at THIS record — click **Open →** on any of them to
jump straight there. It's a live lookup, not a stored copy: change a Reminder's "Related
To" from one record to another and it disappears from the first record's Linked tab and
appears on the new one the next time either is opened — nothing needs to be manually
"moved," since there was never a separate copy to go stale in the first place.

The **Notes** tab (a running, timestamped log for the complete details of a record — not
just the one-line title) has always been on every module's Add/Edit drawer this same way,
but it — like Linked — only appears once a record actually has an id to attach notes to,
so it was simply absent on a brand-new, unsaved record with nothing telling you it was
coming. Every module's Add form now says so explicitly ("Save this record first, then you
can add notes"), so Action Items, Reminders, and everything else make it clear where the
space for complete details went, instead of looking like it's missing entirely.

### Quick Notes — a quiet scratchpad on the Dashboard

A small **🗒️ Quick Notes** card sits in the Dashboard's priority grid (see "Dashboard
priority grid" below), fifth in line right after the three Open lists — not off in a
narrow fixed sidebar. The entry box is a full-size, multi-line textarea (not a single-line
field) sized to jot down a short list of points, not just one line. Start a line with
"1. " and press **Enter** — it continues automatically with "2. ", "3. ", and so on;
pressing Enter again on an empty numbered line ends the list instead of piling up empty
points. Plain **Shift+Enter** just adds a blank line, and **Ctrl/Cmd+Enter** (or the
**Add** button) saves the note from anywhere in the box. It's for the kind of thing you
want to jot down right now and sort out later. Click a note to open it properly, where an
**Assign To — Menu / Specific Record** pair — the same "Related To" fields
Meetings/Reminders/Action Items use — lets you attach it to a specific class, committee,
project, or any other record whenever you figure out where it belongs; once assigned, it
shows up on that record's own 🔗 Linked tab automatically, and drops off this card — it
has "moved" to that record, the same "any menu changing must move to the new place"
principle the 🔗 Linked tab itself is built on. Quick Notes also has its own full menu
(reachable via "View all →" on the card, or Admin & Settings ▸ Data Management), which
still lists every note — assigned or not — with the usual search, edit, delete, and
restore, in case you ever want the complete history in one place.

### Refreshing the page no longer signs you out

Signing in now stays signed in across an ordinary page refresh or reload — previously
every reload landed back on the PIN screen, even mid-session, which had gotten more
noticeable now that the app does more work in the background right after login (see Class
Log auto-sync, below). Signing out is now the only thing that actually ends the session;
closing the tab or browser, or relaunching the installed app fresh, still requires the PIN
again, same as before.

### Bulk actions are faster — one save instead of many

The backend is a simple key-value store: saving any change to a menu re-sends that menu's
entire collection, not just the one changed record. That's invisible for a single edit,
but a handful of actions used to change many records in a row — Bulk Delete on a
multi-selected list, "Set Status for whole group", importing a Class Roster into Internal
Marks, and the Class Log auto-sync — were each doing one full save per record, so
selecting 20 rows and bulk-deleting them meant 20 separate round-trips to the backend, one
after another. Those four spots now build every change in memory first and save once, so
the same 20-row delete is one round-trip instead of 20 — noticeably faster the more
records are involved, with no change in what any of them actually do.

### Email straight from any record

Any module with an email field (Researcher Network) has a **✉️ Email** action on
each row, and every list can multi-select rows (via the checkbox column) to **Email
Selected** or **Delete Selected** in bulk. Emails are composed in-app and sent through
your own backend — the same official address configured for Mail Merge and the daily
digest (see `backend/Code.gs`'s `OFFICE_EMAIL`) — not a `mailto:` link to your device's
default mail app.

### Activity Log

Every create, edit, delete, restore, and email-sent action across every module is
recorded to a read-only **Activity Log** (under the Tools tab in the top navigation) — who did what,
to which record, and when. It's exportable through Reports like any other module and
included in the full JSON backup.

### Dashboard: 30-day Upcoming, everything links somewhere, and a Latest Updates ticker

The Dashboard's stat-card strip now includes an **Open Office Follow-ups** card (it was
missing before) and every card — Today's Classes, Meetings This Week, Open Action Items,
Open Reminders, Open Office Follow-ups, Pending Leave/OD, Hours Spent This Week — is a
link straight to that module. "Upcoming" now looks 30 days ahead instead of 7 (a week was
too short a horizon to plan around). The Progress rings and the Deadlines-by-Area chips
are links too, and the two chart cards ("This Week's Teaching Load", "Time Spent") each
carry a "View Timetable →" / "View Work Diary →" shortcut in their header — the "click it,
go to the real thing" idea now covers the whole Dashboard, not just a few rows. The static
"Recent Activity" card is gone, replaced by a small **📰 Latest Updates** panel on the
right — up to 10 of the most recently added/changed records app-wide, auto-scrolling
(pauses on hover so a title can actually be clicked), title-only, each linking straight to
its module.

### Dashboard: Open Action Items / Open Reminders / Open Office Follow-ups boxes

Below the Today's Schedule / Upcoming (next 30 days) row, the Dashboard now shows three
more boxes in the same list style — a title on the left, its due date right-aligned and
colour-coded by how soon/overdue it is: **☑️ Open Action Items**, **🔔 Open Reminders**,
and **📮 Open Office Follow-ups**. Each lists the actual open (not-yet-Done/Resolved)
records for that module, up to 10, newest-due first, with a count badge in the header;
every row links to the module. Previously only a bare count was visible in the stat-card
strip above — now you can see what's actually open without leaving the Dashboard.

### Researcher Network: a full contact-management profile, not just a name and email

The Add/Edit form is now organized into sections, matching how you'd actually build up a
researcher's profile over time:

- **👤 Basic Information** — Name (the only required field), Designation, Institution,
  Priority (High/Medium/Low, or leave it "— Not set —"), Organization Type (University,
  Industry, Government, National Lab, Research Institute, Non-Profit, Other), City,
  Country (a full country picker), Email, Phone, and Focus Area.
- **🔗 Links & Profiles** — Profile/Paper Link, Google Scholar, ORCID, LinkedIn,
  Twitter/X, ResearchGate, Lab/Group Website, and Other Website/Social Link — as many or
  as few as you have.
- **Usage / Purpose** — a checklist of why you're tracking this contact (Collaboration,
  Invite for Talk/Seminar, MoU/Partnership, PhD/Postdoc Recruitment, Grant/Project
  Partner, Student Exchange, Consultation/Advisory, Conference/Networking, Reviewer/
  Editorial, Other) — check as many as apply.
- **📝 Classification & Notes** — Source (how you found them), Tags, Notable Inventions/
  Patents/Achievements, and free-text Notes.

Save the researcher first, and three more tabs open up on their record (alongside the
existing Notes tab), each its own small running log:

- **📄 Papers** — title, journal/conference, year, and a link, one row per publication.
- **📞 Contact History** — date, mode (Email/Call/Video Call/In-Person/Conference/Other),
  and notes, one row per interaction.
- **🇮🇳 Visits to India** — from/to dates, purpose or institution visited, and notes.

Every entry across all three can be removed with its own ✕. A **📄 Export Profile (PDF)**
button on the edit drawer prints the whole profile — every filled-in field, plus the full
Papers/Contact History/Visits to India logs — as a single document, through the same
print-to-PDF path as every other PDF export in the app.

### Leave & Holidays, Meetings, Action Items, Reminders, and Office Follow-ups: no nav entry

Leave & Holidays no longer has its own dropdown in the top navigation — like Meetings,
Action Items, Reminders, and Office Follow-ups already did, it's reached only through the
Dashboard's quick-add buttons (**🗓️ Apply Leave/OD**, **🏖️ Add Holiday**) and deep links
(the "Pending Leave/OD" stat card, Deadlines-by-Area chips, Calendar, Reports). One fewer
tab competing for space in the main nav row.

### Calendar: Day / Week / Month / Year

The Calendar screen now has a view switcher — **Day**, **Week**, **Month** (the original
grid), and **Year** (12 month tiles with an item count each, click one to open it in Month
view) — with Prev/Today/Next all adjusting to whichever view is active. Any day cell in
Month or Week view opens straight into Day view for that date.

### Reports: pick any month, or a fully custom date range

The Period picker on **Reports** now has two more options alongside This Week / This
Month / each Semester / each Academic Year: **Pick a month…** (any month, not just the
current one) and **Custom date range…** (an explicit From/To pair) — each reveals its own
input(s) only once selected, and every export on the page (CSV/Excel/Word/PDF/Text, single
module or the full report) respects whichever period is active.

### Meetings: Time, Venue, Minutes quick-edit, and one-click "Action Required"

Meetings now has **Time** and **Venue** fields (previously only Date). Every saved Time
value displays as a 12-hour clock with AM/PM everywhere it's shown — list views, exports,
the Timetable weekly grid, and the Dashboard's Today's Schedule (the underlying
`<input type="time">` picker itself still follows the browser/OS's own display
convention — that part isn't something a web page can override). Each Meeting row also
gets two quick actions next to Edit/Notes/Delete: **📝 Minutes** (a lightweight popup to
jot minutes without opening the full edit form) and **☑️ Action Required** (raises a new
Action Item, already linked back to that meeting, in one click).

### A real bug fix: fast Cancel → Add could freeze the form

Found while testing the features above: closing a form (Cancel, or Save) clears the
drawer's content in a short animation-timed delay: if a *new* form was opened again
within that same ~220ms window (e.g. clicking Cancel on one record, then immediately
"+ Add" for a new one — easy to do quickly, and exactly what the automated tests do),
the delayed clear would fire on the *new* form's content instead of the old one's,
silently emptying it and leaving the drawer stuck open with no way to save. Fixed by
cancelling that delayed clear whenever a new drawer opens — a real, previously-invisible
bug, not something introduced by any change in this round.

### Outgoing email: no more "FAMS+:" prefix, and how to send as your own address

Every email FAMS+ sends now uses exactly the subject you type — the automatic "FAMS+: "
prefix that used to be added on top has been removed (`backend/Code.gs`'s `APP_NAME`
constant is now `''`; leave it that way, or set your own short prefix if you'd like one
back). Getting mail to actually *send from* `krishnakumar.m@christuniversity.in` instead
of the Google account the script is deployed under (e.g. `edmg.physics@gmail.com`) isn't
something a code change alone can force — Gmail only allows sending "from" an address
that's been added and verified as a **Send As** alias on that Google account. See
"Sending mail as your real office address" in `SETUP.md` for the one-time, ~1-minute
steps; until that's done, FAMS+ automatically falls back to the deployment account and
always tells you which address was actually used (Admin & settings → Send Test Email),
so nothing about it is silent or guessed.

### Menu Names: rename any built-in menu from Admin & settings

A new **🏷️ Menu Names** card (Admin & settings) lists every built-in menu with a text box
next to it — type a new name and **Save Menu Names** to rename it everywhere that menu's
name shows up (navigation, page header, forms). Clearing a box (or leaving it as typed-in
default) resets that one menu back to its original name. Custom menus already have their
own rename path (just edit the menu's own Label in Custom Menus & Fields), so they're
left out of this list on purpose.

### Timetable: real hours instead of "1 per entry", Subject Code visible, batches kept separate

The **Subject Hours Summary** table used to count every Timetable slot and every Class Log
"Held" entry as exactly 1 hour, even when a slot actually ran longer or shorter — it now
uses each slot's real Start/End Time. Rows are also kept separate by Section and Batch
Number, so two different lab batches (or sections) of the very same subject and subject
code no longer get merged into one row. The weekly grid now shows each class's **Subject
Code** right under its name, and a Laboratory session's **Batch Number** alongside its
section/venue. In the "All entries" list, **Day** now comes after Start/End Time rather
than before it.

### Subject / Subject Code stay mapped everywhere they're re-entered

Timetable is the one place that defines which subjects (and their codes) exist. Anywhere
else that asks for a Subject and/or Subject Code — Class Log, Question Bank, Internal
Marks (CIA), Extra/Additional Classes — now offers the same names as suggestions while
typing, and filling in just one side (Subject *or* Subject Code) auto-fills the other
from Timetable's list when you save, as long as that other side is still blank. It never
overwrites something you typed yourself.

### Class Log now logs itself for you, unless a class is cancelled or the day's a holiday

Every time you log in, it checks today's Timetable against Class Log and — for each class
actually scheduled to happen today — automatically adds a "Held" Class Log entry for it,
so a class you taught never simply goes unrecorded because logging it by hand slipped your
mind. This runs in the background, quietly, after the dashboard is already on screen — it
never delays the login screen or anything else from appearing, even if a particular sync
is slow (an earlier version of this awaited it before the very first screen could render
at all, which on a slow connection could leave the login screen not appearing for a long
time, or not at all; that's now fixed — login always appears immediately). It skips a
class automatically when:

- that Timetable slot itself is marked Cancelled or Rescheduled for the term (the weekly
  slot doesn't run at all, not just today),
- today is a marked **Holiday**, or
- today falls inside an **Approved Leave/OD** — the class didn't happen, so it isn't
  auto-marked Held.

It only ever creates a Class Log entry once per class per day — reopening the app later
the same day (or any day after) never creates a duplicate, and once a class's entry
exists, this never touches it again, whether it was auto-created or you added/edited it
yourself. So if you manually mark one specific day's class Cancelled by hand (distinct
from cancelling the whole weekly slot in Timetable), that stays exactly as you set it —
auto-sync leaves it alone from then on. Auto-created entries carry the same "🔗 Auto"
badge Work Diary's own auto-entries use (see below) and leave **Topic Covered** as a
placeholder for you to fill in — everything else about them (attendance, topic, even
Status) is freely editable afterward, same as any Class Log entry you'd add by hand. Since
a "Held" auto-entry is a normal Class Log record like any other, it also feeds Work Diary
and Time Spent automatically, the same as one you logged yourself (see below).

### Work Diary now fills itself in from everywhere else with a real duration

Marking a Class Log entry "Held", or saving a Meeting, Invigilation Duty, Extra/
Additional Class, Lab Exam or Research Event with a real duration, now automatically
creates (and keeps up to date) a matching entry in the Work Diary — tagged with a small
"🔗 Auto" badge so it's clear where it came from. Editing or un-marking the source record
updates or removes that same Work Diary entry rather than creating a duplicate. This also
means **Time Spent by Activity** (Dashboard and Analytics) now reads from the Work Diary
alone instead of re-scanning every source separately, so nothing gets double-counted.

Manually adding or editing a Work Diary entry yourself no longer lets its Date be set in
the future — a diary logs work you've already done, so the date picker won't offer
tomorrow or later, and saving one anyway is rejected with a clear message. This only
applies to entries you type in by hand; the auto-logged entries described above (which
mirror another record's own date, including a future-dated one you're planning ahead for)
are untouched.

### From Time / To Time, everywhere there's real duration to log

Meetings, Invigilation Duty, Extra/Additional Classes, Lab Exams, Research Events and the
Lab Timetable all now have **From Time** and **To Time** fields (12-hour display, like
everywhere else in the app). When both are filled in, the real elapsed time between them
is what counts toward Time Spent and the auto-logged Work Diary entry above — the older
manual "Duration (hours)" field on each of these is still there as a fallback for when
you'd rather just type a total.

### Login screen: wider card, and the PIN caret starts on the left

The sign-in card is a bit wider, and the PIN box's blinking cursor now starts at the left
edge instead of sitting oddly in the middle of the box before you've typed anything.

### New Updates: a separate menu for external news, right on the Dashboard

The Dashboard's ticker is renamed **New Updates** and is now its own separate menu —
a Title, and an optional Link — instead of reusing the app's own activity feed. Add
items via the **📰 Add New Update** quick-add button (right after 🏖️ Add Holiday), or
the ticker's own **Manage →** link for the full list (edit/delete, same as any other
menu). The Link is optional — a title-only update saves fine and just shows as plain
text; when a real `http(s)://` link is given, clicking the title opens it in a new tab.
With only a few updates, the ticker shows them as a plain static list; once there are
enough to actually need scrolling, it becomes the auto-scrolling marquee (a handful of
items used to get duplicated for the scroll-loop trick even when there was nothing to
scroll, which made a single update look like it was listed twice — fixed).

### Academics: Lab timetable/Lab exams no longer get their own "Laboratory" section

The Academics dropdown no longer has a separate "Laboratory" group. **Lab timetable**
now lives under **Teaching**, right alongside the regular Timetable and Class log, and
**Lab exams** (still 🔬) now lives under **Exams**, alongside Invigilation duty,
Question bank, Evaluation, and Internal Marks — one less section to look through.

### Today's Schedule now shows the whole day, not just classes

The Dashboard's Today's Schedule card used to only show Timetable classes. It now also
pulls in any Meeting, Invigilation Duty, Extra/Additional Class, Lab Exam or Research
Event dated today — sorted chronologically by From Time alongside your classes, each
still linking to its own menu.

### UG Research and similar grouped lists: actual marks visible, plus a real "Filter by Batch"

A fixed-row subtable (like UG Research's Semester Marks) used to show only *which*
semesters had something filled in ("2 / 6 Semester Marks, Sem-1, Sem-2") in the list
view — now it shows the actual values too (e.g. "Sem-1: 85/Pass, Sem-2: 78/Pass"), so
marks are visible without opening each student's record. Any grouped list (by Batch, by
month, …) with more than one group also gets a **Filter by Batch/month** dropdown above
the table — picking a batch shows *only* that batch's students (everyone else drops out
of view, not just scrolled past), so UG Research can genuinely be viewed one batch at a
time. Picking "— All —" goes back to the full list, grouped by batch as before.

*(If you'd also like separate "Max Marks" per semester on UG Research's Semester Marks —
today it's just Marks + Status — that's a quick edit to that field's own spec in Admin &
settings → Custom Menus & Fields → UG Research: change `Semester Marks|subtable|Marks,
Status:select:Pass;Fail|Sem-1;Sem-2;Sem-3;Sem-4;Sem-5;Sem-6` to `Semester Marks|subtable|
Marks,Max Marks,Status:select:Pass;Fail|Sem-1;Sem-2;Sem-3;Sem-4;Sem-5;Sem-6` — a new "Max
Marks" box then appears on every semester row, editable per student. Always spell the
semester list out in full like that — don't shorten it to "Sem-1;…;Sem-6" — see the fix
below for why.)*

### Fix: existing marks disappearing from Semester Marks (both list and individual view)

If a fixed-row spec's last part ever ends up typed as a shorthand range — literally
`Sem-1;…;Sem-6` or `Sem-1;...;Sem-6` instead of every semester spelled out
(`Sem-1;Sem-2;Sem-3;Sem-4;Sem-5;Sem-6`) — the app used to treat "…" as its own row name,
so only Sem-1 and Sem-6 (plus a nonsense "…" row) actually existed on screen; Sem-2
through Sem-5's already-saved marks were still safely stored, just no longer rendered
anywhere — not in the student's own record, not in the list view. That shorthand now
auto-expands back into the full run automatically, so a spec like that behaves the way it
reads, and the same matching that renders a semester's row now also tolerates minor
spacing/case differences in older saved data rather than requiring an exact text match.
Nothing needs to be re-entered — reopening (or just viewing) an existing UG Research
record now shows every semester's marks again.

### Two Dashboard charts are small pie charts

"This Week's Teaching Load" and "Time Spent" both switched from bar charts to pie
charts, with a legend below each so every slice is still labeled, and shrunk to a
small fixed-height card so they don't dominate the page. They're two of the twelve
cards in the priority grid (see below).

### Dashboard priority grid — an explicit 3-column layout, in a set order

Everything below the Dashboard's stat strip is one 3-column grid, filled row by row in
a specific priority order: **Today's Schedule, Open Action Items, Open Reminders, Open
Office Follow-ups, Quick Notes, New Updates, Research Updates** — then the remaining
cards (Upcoming, Progress, Deadlines by Area, and the two mini charts) continue filling
out the grid after that. That's 12 cards across 4 rows of 3. This replaced an earlier
version that spread the same information across several separately-sized grid-2/grid-3
blocks plus a masonry-style side section — the explicit 3-column grid puts everything
on one consistent structure instead, with the most operationally useful cards (what's
happening today, what's still open) placed first. On a laptop-width screen it falls
back to 2 columns, and on a phone to 1, so it stays usable at every size; a card that's
shorter than its row neighbor just sits at the top of its cell rather than being
stretched to match.

### Research Updates — a scrolling ticker sourced from Plans, Conferences/Workshops, and Projects & Grants

A new **🔬 Research Updates** card in the priority grid works exactly like the 📰 New
Updates ticker above it — a vertically auto-scrolling list (pauses on hover so an entry
can actually be clicked), each row linking straight to its own record. Where New
Updates pulls from that separate menu, Research Updates pulls from three research
sources that carry a real date: **Plans** (by target date), **Conferences, Workshops**
(by event date), and **Projects & Grants** (by end date) — sorted with the latest date
first, so it reads as one combined feed of what's been entered across those three
menus recently, not a strict to-do list. Publications, Collaborations, Peer Review, and
Researcher's Database aren't included in this particular ticker.

### Fix: a past Extra Class no longer gets stuck showing as "Overdue"

Invigilation Duty, Mentee Meetings, Lab Exams, and Extra/Additional Classes don't have a
"Done"/completed status the way Action Items, Reminders, Meetings, and the rest do — they're
calendar-style entries that either happened or didn't, not a task someone still owes. The
Dashboard's "Overdue" warning and the "Deadlines by Area" chips used to treat a past date on
any of these exactly like an unfinished task, so one that had already happened stayed flagged
"Overdue" forever, with no status to change and no way to clear it — reported directly by an
Extra Class that kept showing up that way. Those four now drop out of the Overdue reckoning
once their date passes instead of getting stuck there; they still show up normally in
"Upcoming" and "Deadlines by Area" while their date is still ahead. Everything that does have
a real completion status (Action Items, Reminders, Meetings, Evaluations, Plans, Leave/OD,
Office Follow-ups, Projects/Grants) is unaffected and still shows up as genuinely overdue when
it should.

### Every save is now instant — the network round trip happens in the background

Clicking Save on any record used to mean watching a "Saving…" button for however long the
round trip to Apps Script took (routinely a second or more, sometimes several) before the form
would close and the list would update. That wait is gone: the screen updates immediately — the
new/edited row appears, the form closes, the Dashboard refreshes — and the actual write to your
Google Sheet happens right afterward, in the background. This isn't a storage-format change
(the backend was already a plain JSON key-value store); it's simply not making you wait on it
anymore. A small indicator next to the clock in the top bar — **● All changes saved** — turns to
**Saving…** while a background write is in flight and to **Not saved — retrying…** if your
connection drops, so a real problem is still visible instead of hidden behind the instant UI;
a dropped connection is retried automatically (with increasing delays) until it goes through,
and closing or reloading the tab while something is still pending now asks you to confirm first
rather than silently losing it. Saves to the same record/list are still sent to the backend in
the order you made them, never out of order, even though the screen itself no longer waits.

### Dashboard: nine quick-add buttons became one "+ Quick Add" menu

The hero banner used to show nine separate buttons side by side (Log Work Diary, Add Class, Add
Meeting, Add Action Item, Add Reminder, Add Office Follow-up, Apply Leave/OD, Add Holiday, Add
New Update) — all competing for attention above the fold on every single visit. They're now
behind one **➕ Quick Add** button; clicking it opens the same nine destinations as a clean
dropdown list, and clicking anywhere else (or pressing Escape) closes it. Nothing about what
each one does has changed, only how many things are visible on the Dashboard at a glance.

### Every menu's list rows: nine possible buttons became "Edit" and one "⋮" menu

A row could show up to nine action buttons at once depending on the module — Edit, Notes,
Minutes, Action Required, Mark Complete, Add a Menu, Renew, Class Roster, Email, WhatsApp,
Delete — all in a line, wrapping onto a second row on anything but a wide screen. Every list
(every built-in menu, every custom menu, Timetable's own list view) now shows just **Edit** and
a **⋮** button; "⋮" opens the rest as a small dropdown anchored to that row, positioned so it's
never cut off even in a long scrolling table. Nothing about what any individual action does
changed — Notes still opens Notes, Delete still asks to confirm first, and so on.

### Dashboard: "Upcoming", "Progress", and "Deadlines by Area" are now tucked behind "Show more insights"

The priority grid's first seven cards (Today's Schedule, Open Action Items, Open Reminders, Open
Office Follow-ups, Quick Notes, New Updates, Research Updates — the order requested earlier) and
the two small charts stay visible as before. The three cards after them in that grid — Upcoming
(next 30 days), Progress, and Deadlines by Area — start collapsed behind a **📊 Show more
insights** button at the bottom, since they're useful but not things that need to be visible on
every single visit. One click reveals all three; nothing is removed, and the two Chart.js mini
charts are completely unaffected either way.

### Faster typing in every menu's search box

Typing into any module's "Search…" box used to re-filter and completely re-render that whole
table on every single keystroke. On a module with a lot of records, that's real, visible lag per
letter typed. Search now waits until typing actually pauses (180ms) before re-rendering —
exactly the same filtering, just not redone on every keystroke.

### A few data-entry dates now default to today

Class Log's Date, Mentoring Meetings' Date, and Office Follow-ups' Submitted Date now default to
today when you open "Add" — the same treatment Work Diary's Date already had, since all three
describe something you're logging right after it happened (a class that was held, a meeting that
was just had, a submission you just made), not something being scheduled ahead. Dates that
genuinely are about the future — Meetings, Leave/OD, Invigilation Duty, Office Follow-ups' own
Follow-up Date, every Due Date and Deadline — deliberately keep no default, since defaulting
those to today would usually be wrong and easy to miss changing.

## Design

FAMS+ has its own mark — an inline SVG logo (graduation cap + orbital ring, for
"faculty" and "physics/electronics") rather than a generic icon, used consistently on
the login/setup screens, top navigation bar, browser tab favicon, and every PWA/home-screen icon
(`icons/`, generated from the same source file in `assets/logo-mark.svg` — edit that
one file and regenerate if you ever want to restyle it).

The Dashboard is the most "designed" screen: a compact navy hero banner with a
time-of-day greeting, a one-line motivational quote (in the same warm gold accent used
on the login screen), and a live IST clock, one-tap quick-add buttons, a single
consolidated row of stat cards (today's classes, open action items, open reminders,
pending leave/OD, meetings this week, hours logged this week — no numbers repeated in a
second block), colour-coded overdue and upcoming items, two progress rings (action items
closed, classes logged this week), and a recent-activity feed — every row across the
Dashboard (overdue items, today's schedule, upcoming deadlines, recent activity) links
straight through to the menu the item actually lives in. Every functional area of the
app — Teaching, Exams, Mentoring, Research, Projects, and so on — has its own accent
colour, applied consistently across the navigation icons, dashboard stat cards, and
Analytics charts, so it's visually obvious which part of the app you're in at a glance.
All dates and times are shown in IST (GMT+5:30), 12-hour format, regardless of the
device's own timezone setting. The login and first-time-setup screens carry the same
navy/gold branding, department context, and a daily motivational quote.

Every module shares one generic, searchable list + add/edit/notes/delete screen driven
by a plain data description — adding a brand-new module is a matter of adding one entry
to the `MODULES` object near the top of `index.html`'s `<script>` section (for a
developer touching the code), or, for everyday use, just filling in the **Administrator
→ Custom Menus** form (see above) — either way, not a whole new screen to write. Every
"Save"/"Send"/"Import"/"Delete" action across the app guards against a fast double-click
or double-Enter firing it twice — the button disables itself the instant it's clicked,
so an accidental double-submit can never create two records instead of one.

The app uses the full browser window (no boxed-in max-width), with a one-click
fullscreen toggle in the top bar. Navigation is a horizontal bar across the top rather
than a permanent side panel, kept deliberately short so it stays on one line: **Dashboard**,
**Work Diary**, and **Calendar** are always-visible standalone buttons (used every day,
so they skip the dropdown click); **Leave & Holidays** is its own dropdown tab; then
**Academics** (Teaching — incl. Lab timetable, Exams — incl. Lab exams, Extra Classes), **Research** (Research,
Projects), and **Roles & Responsibilities** (Responsibility Areas, plus one entry per
responsibility that has a menu attached — see "Roles & Responsibilities has been
redesigned" above) — click a tab to open a dropdown of that category's modules; then
**Reports**, another standalone button.
**Administrator** (Analytics, Activity Log, Custom Menus, Mail Merge, Admin & Settings)
sits apart from the rest, anchored to the far right end of the row, since it's an
admin-control destination rather than an everyday menu item. Meetings, Action Items,
Reminders, and Office Follow-ups are intentionally NOT in this row at all — with four
"Add ___" quick-add buttons on the Dashboard's hero (alongside Log Work Diary and Add
Class) they'd otherwise push the nav onto a second line, so they live there instead,
plus a deep link from the Dashboard's Overdue/Today/Upcoming/Recent Activity rows once
a record exists. Every "Add new" and "Bulk Import" flow opens in a right-side sliding
panel rather than a full-page navigation. The app always opens to the PIN entry screen
(it never silently stays logged in across a fresh open) and always lands on the
Dashboard right after you sign in.

The login and first-time-setup screens use a full-page navy gradient backdrop with a
tiled academic-motif pattern (faint line-art graduation caps, open books, atom orbits
and lab flasks — an inline SVG data-URI, no external image request), large orbit-ring
accents (echoing the logo's graduation-cap-and-orbit mark), and a huge, low-opacity
"FAMS+ / Faculty Activity Management System" watermark sitting behind the card — the
white auth card, department context, and daily motivational quote sit on top of all of
it. The whole app (headings, body text, buttons, forms, every menu) uses Plus Jakarta
Sans rather than Inter — a more distinctive, professional typeface — with IBM Plex Mono
kept for numeric/monospace bits (clock, PIN dots, codes). Top-nav dropdown menus no
longer show a visible scrollbar even when a category's item list is tall enough to
scroll (the scroll behavior is preserved, just the scrollbar chrome is hidden).

Academic Term history ("Previous terms" under Admin & settings → Academic Term) can now
be edited or deleted in place, each gated behind re-entering your PIN in a confirmation
dialog first (Cancel/Escape/click-outside all back out safely). "Start New Term" also no
longer archives a duplicate row if you click it again without actually changing the
Academic Year/Semester/dates first — it shows a "Nothing to archive" message instead —
and any duplicate previous-term rows already saved from that older behavior are
automatically collapsed to one on the next app load.

Body text color was darkened app-wide (`--text`, `--text-dim`, `--text-faint`) for better
contrast/legibility against Plus Jakarta Sans, which reads lighter than Inter did at the
same color.

**Time Spent is no longer just the Work Diary.** The Dashboard's "Time Spent" chart and
stat card, and Analytics' "Time Spent by Activity" chart, now combine hours from
everywhere real time is recorded: Work Diary's own hoursSpent (by its own category);
classes actually held (Class Log rows marked "Held"), with the exact duration
auto-computed from the matching Timetable slot's Start/End Time — no typing required, it
just works once a class is logged as Held; and a new optional "Duration (hours)" field on
Meetings, Invigilation Duty, Extra/Additional Classes, Lab Exams and Research Events —
opt-in per record (leave it blank and it simply isn't counted, nothing is guessed). Also
fixed a real, pre-existing bug this surfaced: any `type="number"` field without an
explicit `step` attribute defaults to whole numbers only under HTML5 validation, so
entering a decimal (e.g. "1.5" hours) silently blocked the Save button from doing
anything — no error shown, nothing saved. Every number field across the app (Work Diary
hours, CIA marks, grant amounts, the new Duration fields, etc.) now sets `step="any"` so
decimals always save correctly.

**Custom Menus can now have a "subtable" field** — a repeating mini-table embedded in
each record, the same mechanism the built-in In-charges "Members" list and Class Log
"Students" list already use. This is what a menu like "UG Research" needs for
per-semester marks, a supervisor field, and a Present Status (Active/Discontinued/
Completed) — none of that requires code changes, it's all defined from Admin & settings
→ 🧩 Manage Custom Menus, in the same Fields box as any other field, one line per field:

```
Reg No|text||required
Name|text||required
Section|text
Batch|text
Supervisor|text
Present Status|select|Active,Discontinued,Completed
Semester Marks|subtable|Marks,Status:select:Pass;Fail|Sem-1;Sem-2;Sem-3;Sem-4;Sem-5;Sem-6
```

The `subtable` line's third part (normally "options") instead lists that field's own
sub-columns, comma-separated — each one is a plain text cell by default, or a dropdown
cell with `Sub-column Label:select:Option A;Option B`. There are two row modes:

- **Free-form** (leave the 4th part blank, or write `required`) — the mini-table starts
  empty with a **+ Add Row** / **✕** per-row remove, same as In-charges' Members list.
- **Fixed rows** (the 4th part is a semicolon-separated list of row names, like
  `Sem-1;Sem-2;Sem-3;Sem-4;Sem-5;Sem-6` above) — every record gets exactly one guaranteed,
  pre-labelled slot per name, always, with no +Add/✕Remove. This is what "UG Research"
  needs for marks: one Marks entry per semester, for all 6 semesters, from day one —
  never a freely-typed or accidentally-duplicated row. The list view shows a "filled /
  total" badge (e.g. "2 / 6 Semester Marks") so you can see progress at a glance; opening
  Edit always shows all 6 rows, blank ones simply waiting to be filled in.

To make a menu like this one of "UG Research"'s own — instead of its own separate
top-level entry — set the same form's **"Attach to a Responsibility Area"** field to your
"UG Research" Responsibility Area (see "Roles & Responsibilities has been redesigned"
above). The quickest way: from the Responsibility Areas list, click **➕ Add a Menu** on
the UG Research row — that opens this exact form with the attachment already pre-filled.

**Group the list by a field** — also set from the same custom-menu editor, in the
"Group the list by" box (type the exact field Label, e.g. `Batch`). Every record sharing
that value is then clustered under one heading in the list view instead of repeating the
value on every single row — exactly the "batch-wise, shown once at the top of the group"
layout UG Research needs for 30+ students across a handful of batches. Each group heading
also gets:
- **+ Add to this group** — opens a new blank record with that group's own field value
  already filled in, so a brand-new student lands in the right batch without retyping it.
- **📤 Export this group** — a CSV of just that group's records (marks, status, everything).
- **Set … for whole group…** — if the menu also has a Status-style dropdown field (like
  "Present Status"), a one-click bulk update applies a new status to every record in that
  group at once (e.g. marking a whole batch "Discontinued" after they graduate).

Work Diary uses the same clustering engine, grouped by calendar month instead of a field
— "one month's entries together, then the next month starts" — with its own **📤 Export
this group** per month.

## File layout

| File | Purpose |
|---|---|
| `backend/Code.gs` | The entire backend — paste this into Extensions → Apps Script inside your Google Sheet. HTTP API, email (digest/reminders/mail-merge), daily Drive backup, daily deadline reminders. |
| `index.html` | The entire frontend — one file, no build step. Open it directly or host it on GitHub Pages. |
| `manifest.json` | PWA manifest — lets the app be installed to a phone's home screen. |
| `sw.js` | Minimal service worker — caches the app shell so it still opens with a flaky connection. |
| `icons/` | App icons for the home-screen install (192px, 512px, maskable, Apple touch icon). |
| `assets/logo-mark.svg` | Source of the FAMS+ mark — every other icon (PWA, favicon) is generated from this one file. |
| `SETUP.md` | Full step-by-step deployment walkthrough. |

## Installing as an app (PWA) — no Android Studio, no APK

FAMS+ installs straight from the browser as a real app icon on your phone's home
screen — this is now the one supported way to get an "app", replacing the earlier
native Android Studio project (dropped: it meant a separate build, a signing
keystore to keep safe forever, and a manual reinstall for every update — none of
which the installable web app needs).

- **Android / Chrome / Edge:** open the site, then either tap the **⬇ Install**
  button in the top bar (it only appears once the browser says the app is
  installable) or use the browser's own menu → **Add to Home screen** / **Install
  app**. It opens full-screen, with its own icon, no address bar.
- **iPhone / iPad (Safari):** Safari doesn't support the automatic install prompt,
  so the **⬇ Install** button won't appear there — instead use the Share button →
  **Add to Home Screen**. Same result: a home-screen icon that opens full-screen.
- **Updates:** there's nothing to reinstall. Reopening the installed app always
  fetches the latest `index.html` (see `sw.js`'s network-first strategy below), so
  publishing a change to GitHub Pages is enough — everyone's installed copy picks
  it up the next time they open it.
- `manifest.json` names the app and its icons; `sw.js` caches just enough of the
  app shell that it still opens on a flaky connection, without ever serving stale
  data (every request to the Apps Script backend always goes straight to the
  network, never through the cache).

## Your data

Everything lives in a Google Sheet you own — one tab named **"data"**, two columns
(`key`, `value`). You can open it directly at any time. Nothing is locked into a
proprietary format: **Reports** (its own top-level nav button) exports any module as CSV, or
everything at once as JSON, whenever you like.
