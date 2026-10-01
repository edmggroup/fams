# FAMS+ — Setup Guide

Estimated time: 10–15 minutes. No coding experience required, and **no command line, no
clasp, no Node.js install** — everything happens in a browser. This is a completely
different (and much simpler) setup than earlier versions of FAMS+.

There are three parts:
1. Create the backend (one Google Sheet + one pasted-in script)
2. Connect the app to that backend (two lines in `index.html`)
3. Publish the app so you can open it from your phone/laptop

Complete each part **in order**, and check the ✅ checkpoint at the end of each step
before moving on — this avoids debugging two problems at once.

---

## Part 1 — Create the backend

### 1.1 Create the Sheet

1. Go to [sheets.new](https://sheets.new) — this creates a new Google Sheet in your Drive.
2. Rename it to something identifiable, e.g. **"FAMS+ — Data"**.
3. Make sure you're signed into the Google account you want FAMS+ to live in
   (e.g. **edmg.physics@gmail.com**).

### 1.2 Add the script

1. In the Sheet, go to **Extensions → Apps Script**. This opens the script editor in a
   new tab, already bound to this specific Sheet.
2. Delete any placeholder code you see (e.g. `function myFunction() {}`).
3. Open `backend/Code.gs` from this package, copy its **entire** contents, and paste it
   into the editor.
4. Save (`Ctrl+S` / `Cmd+S`, or the disk icon).

> **Important:** the script must be created via **Extensions → Apps Script** from inside
> the Sheet, not from script.google.com directly — otherwise `SpreadsheetApp.getActiveSpreadsheet()`
> won't know which Sheet to write to.

### 1.3 Set your own secret key

Near the top of the script you just pasted, find:
```js
const APP_KEY = 'change-this-to-your-own-random-string-2026';
```
Change the text between the quotes to your own random string — anything works, e.g. a
long made-up phrase. This is a shared secret that stops random visitors who stumble on
your Web App URL from reading your data or sending emails through it. You'll paste the
**exact same value** into `index.html` in Part 2 — write it down somewhere for a minute.

Also check `OFFICE_EMAIL` a few lines below and confirm it's your real office address:
```js
const OFFICE_EMAIL = 'krishnakumar.m@christuniversity.in';
```

Save again after any edits.

### 1.4 Deploy it as a Web App

1. Click **Deploy** (top right) → **New deployment**.
2. Click the gear icon next to "Select type" → choose **Web app**.
3. Set:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
4. Click **Deploy**.
5. The first time, Google will ask you to authorize the script. Click through the
   prompts — you'll likely see an "unverified app" warning, which is expected since it's
   your own private script and hasn't gone through Google's public-app review. Click
   **Advanced → Go to (project name) (unsafe) → Allow**.
6. Copy the **Web app URL**. It must end in `/exec` (not `/dev`).

### ✅ Checkpoint 1

Paste the `/exec` URL into a new browser tab. You should see plain text like:
```json
{"error":"Unknown action: undefined"}
```
That's correct — it confirms the script is live and responding. If you instead see a
Google sign-in page or "You need permission", go back to **Deploy → Manage deployments
→ edit (pencil) icon**, confirm "Who has access" is `Anyone`, and re-deploy.

**Do not continue until this checkpoint passes.**

---

## Part 2 — Connect the app to the backend

1. Open `index.html` in a text editor (Notepad is fine — right-click the file → Open with
   → Notepad; or use GitHub's built-in web editor once it's uploaded in Part 3).
2. Find this line near the top of the `<script>` section:
   ```js
   const DATA_API_URL = 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
   ```
   Replace the placeholder text **inside the quotes** with your `/exec` URL from Part 1:
   ```js
   const DATA_API_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
   ```
3. Just below it, find:
   ```js
   const APP_KEY = 'change-this-to-your-own-random-string-2026';
   ```
   Make sure this **exactly matches** the `APP_KEY` you set in `Code.gs` in step 1.3.
4. Save the file.

### ✅ Checkpoint 2

Double-click `index.html` to open it directly in your browser. You should see the
**"First-time setup — create your profile & PIN"** screen — not a "Backend not connected
yet" message. Don't create your account yet; that's easiest to do once the app is
published (Part 3), so you're not doing it twice.

---

## Part 3 — Publish it (GitHub Pages)

This gives you one permanent link you can open from any device and add to your phone's
home screen.

1. Create a free account at [github.com](https://github.com) if you don't have one.
2. Click **+ → New repository**. Name it (e.g. `fams-plus`), leave it **Public**, click
   **Create repository**.
3. Click **Add file → Upload files**.
4. Drag in `index.html`, `manifest.json`, `sw.js`, and the whole `icons/` folder —
   **all directly into the repository root, not into a subfolder.** The `backend/`
   folder does not need to go here at all — it only ever needs to exist inside the Apps
   Script editor from Part 1.

   > **This step is the single most common cause of a broken link.** If GitHub's upload
   > screen shows you dragging files "into" something, or your file list afterwards
   > shows `index.html` nested one level down (e.g. under a folder with the same name as
   > your repo), your site will 404. Check the repository's file listing right after
   > committing — `index.html` must be the top-level file you see immediately, with no
   > folder icon above it.
5. Commit the upload.
6. Go to **Settings → Pages**. Under "Build and deployment": Source = `Deploy from a
   branch`, Branch = `main`, folder = `/ (root)`. Click **Save**.
7. Wait about a minute, then check the **Actions** tab for a green checkmark on the
   "pages build and deployment" run. Your live link will then work:
   ```
   https://yourusername.github.io/fams-plus/
   ```

### ✅ Checkpoint 3 (final)

Open your published link (hard refresh with `Ctrl+Shift+R` / `Cmd+Shift+R` to bypass any
cache) and confirm the first-time setup screen loads. Create your real admin account —
your name, office email, and a 4–6 digit PIN. You should land straight on the Dashboard.
Then check your Google Sheet — a tab named **"data"** should now have rows in it
(`app-meta`, and one row per module you use). That confirms the full chain — browser →
Apps Script → Sheet — is working end to end.

### Add it to your phone's home screen

Open the link on your Android phone in Chrome → menu (⋮) → **Add to Home screen** (or
Chrome may show an "Install" banner automatically once you're logged in). FAMS+ then
opens full-screen like a normal app, with its own icon — no Play Store needed.

The home-screen install above (a PWA) is the one supported way to get an "app" —
there's no separate native Android Studio project to build or keep updated; the
install step above is the whole process, on Android and iPhone/iPad alike (on
iPhone/iPad, use Safari's Share button → **Add to Home Screen** instead, since
Safari doesn't show an automatic install prompt).

---

## Part 4 — Turn on automation (optional, recommended)

Three background jobs can run automatically once a day, straight from the Apps Script
project (no separate hosting needed):

- **Daily Drive backup** of the whole dataset to one always-current JSON file.
- **Daily deadline reminders** — an email listing anything due in the next 3 days.
- **Daily digest** — a short "here's today" email (today's classes + anything due today),
  sent only on working days and skipped automatically on holidays you've entered.

**One-time setup (~30 seconds):**
1. Open the Apps Script editor for your Sheet (same place you pasted `Code.gs`).
2. At the top of the editor, use the function dropdown and select **setUpAllTriggers**.
3. Click **Run**. The first time, you'll be asked to authorize Drive/Gmail access — click
   through the prompts the same way you did for the Web App deployment.
4. Done. You can see or adjust the exact times under the clock icon (**Triggers**) in the
   left sidebar, or re-run `setUpAllTriggers` any time — it always clears old triggers
   first, so it never ends up running twice a day.

### Sending mail as your real office address

By default, emails send from whichever Google account you deployed the script under
(e.g. edmg.physics@gmail.com). To send as your real office address instead:

1. Open Gmail as that same Google account → **Settings → Accounts and Import → Send mail
   as → Add another email address**.
2. Enter your office email (e.g. `krishnakumar.m@christuniversity.in`).
3. Approve the verification link sent to that office mailbox.

Until that's verified, FAMS+ automatically falls back to the deployment account and
**always tells you which address was actually used** (Admin & Settings → Send Test
Email) — nothing fails silently.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Backend not connected yet" screen never goes away | `DATA_API_URL` in `index.html` still has placeholder text, or the edit wasn't saved |
| 404 on your GitHub Pages link | `index.html` isn't at the repo's true top level (see the warning in step 4 of Part 3) — check the repo's file listing, not just the Pages settings |
| "Could not reach the backend" after the app loads | Apps Script deployment access isn't set to `Anyone`, or `APP_KEY` doesn't match exactly between `Code.gs` and `index.html` |
| Incorrect PIN even though you're sure it's right | PINs are case-sensitive digit strings — check Caps Lock isn't affecting a numeric keypad, or use **Admin & Settings → Change PIN** after logging in another way if you still have a session |
| Locked out after 5 wrong PIN attempts | Wait 5 minutes — this is a deliberate anti-guessing lockout, stored on that device only |
| Changes to `Code.gs` don't take effect | Editing the script alone doesn't update the live URL — go to **Deploy → Manage deployments → edit (pencil) → Deploy** again to publish a new version |
| Emails aren't arriving | Check the Apps Script **Executions** log (left sidebar) for a `MailApp`/`GmailApp` error; confirm you're not over ~100 emails/day on a personal Gmail account; try **Admin & Settings → Send Test Email** to see exactly which address it tried |
| Charts (Analytics page) don't appear | That page loads a small charting library from the internet the first time — it needs a working internet connection; everything else in FAMS+ works fine offline once loaded |

## Updating the app later

- **Frontend changes** (`index.html`, `manifest.json`, `sw.js`, icons): edit and
  re-commit on GitHub — takes effect within about a minute, or immediately with a hard
  refresh.
- **Backend changes** (`Code.gs`): edit in the Apps Script editor, then **Deploy → Manage
  deployments → edit (pencil) → Deploy** to publish a new version. The Web App URL itself
  never changes, so nothing in `index.html` needs updating when you do this.

## Your data, always exportable

**Admin & Settings → Reports** lets you download any module as a CSV file, or the entire
dataset as one JSON file, any time — independent of the automatic daily Drive backup.
Nothing in FAMS+ is ever locked into a format only this app can read.
