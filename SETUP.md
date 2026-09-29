# Setup

About 15 minutes, no coding and no command line. Do the steps in order.

---

## 1. Make the database

1. Go to <https://sheets.google.com> and create a blank spreadsheet.
2. Name it something like `FAMS data`.
3. Leave it empty. The script builds the sheet it needs on first use.

## 2. Add the backend

1. In that spreadsheet, open **Extensions ▸ Apps Script**.
2. Delete whatever is in `Code.gs`.
3. Open `backend/Code.gs` from this folder, copy all of it, and paste it in.
4. Click the save icon.

## 3. Deploy it

1. Click **Deploy ▸ New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Fill in:
   - Description: `FAMS`
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**.
5. Google asks you to authorise it. Choose your account, then **Advanced ▸ Go to
   (unsafe)** and **Allow**. This warning appears because the script is yours and
   unpublished, not because anything is wrong.
6. Copy the **Web app URL**. It ends in `/exec`.

"Anyone" sounds alarming and is worth understanding: it means anyone may *send a
request* to the script, but the script answers nothing without your PIN, and it
locks out after five wrong tries. Your data is never in the website itself.

## 4. Put the site on GitHub Pages

1. Go to <https://github.com/new> and create a repository. Public is fine, since
   no data of yours is in it. Name it, for example, `fams`.
2. On the new repository page, click **uploading an existing file**.
3. Drag in everything from this folder: `index.html`, `sw.js`, `manifest.json`,
   the `icons` folder, and the `assets` folder. The `backend` folder and the two
   `.md` files are optional, and harmless either way.
4. Click **Commit changes**.
5. Go to **Settings ▸ Pages**. Under "Branch", pick `main` and `/ (root)`, then
   **Save**.
6. Wait about a minute. The page shows your address, which looks like
   `https://<your-name>.github.io/fams/`.

## 5. First run

1. Open your GitHub Pages address.
2. Paste the web app URL from step 3 and press **Continue**.
3. Choose your 4-digit PIN and press **Create workspace**.

Your 14 works are already there: three teaching, four research, and the 13
responsibility areas from your existing FAMS+ sheet, grouped under
Administrative.

## 6. Install it on your phone

- **iPhone:** open the address in Safari, tap Share, then **Add to Home Screen**.
- **Android:** open it in Chrome, tap the menu, then **Install app**.

After that it opens like an app, with no browser bar, and works offline.

---

## Day to day

- **Adding a work:** tap **Admin** in the top bar, then "Add a work to …". Give
  it a name, pick an icon, and set its fields. Tick **timeline** on any date
  field you want in the Upcoming strip on the home page. A cover image is
  optional: paste any direct image link and the card shows it.
- **Your name in the banner:** Settings, under "Your details".
- **Reordering:** the arrows in **Admin** set the order the cards appear in.
- **Year end:** **archive** a work rather than deleting it. It leaves the home
  page and its records stay whole.
- **Deleting:** you must type the work's name. It goes to the recycle bin for 30
  days, and **Admin ▸ Recycle bin** restores it with its records.
- **Locking:** **Settings ▸ Lock this device** clears the session and the local
  copy on that device only.

## If something goes wrong

**"Session expired"** — normal after 30 days, or after you change the PIN. Enter
the PIN again.

**Changes are not appearing on another device** — that device still has its
cached copy and picks up changes when you next open it. Pull down to refresh, or
lock and unlock.

**"Too many wrong attempts"** — wait 15 minutes. If you have forgotten the PIN,
open the Apps Script project, then **Project Settings ▸ Script Properties**, and
delete the `attempts` and `lockUntil` properties to clear the lockout. To reset
the PIN itself, delete the `config` row in the `Store` sheet and reload the
site, which starts first run again. Your works and records survive this.

**You edited `Code.gs` and nothing changed** — Apps Script serves the last
deployed version. Use **Deploy ▸ Manage deployments ▸ edit ▸ Version: New
version ▸ Deploy**.

**The site looks stale after I update `index.html`** — the service worker serves
the cached copy first and updates in the background, so the new version appears
the second time you open it.

## Backups

Everything is in your spreadsheet, in a sheet named `Store`, one row per key.
**File ▸ Version history** in Sheets is a full backup you already have.
**File ▸ Download ▸ Microsoft Excel** takes a copy off Google.
