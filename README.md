# FAMS

A private academic workspace: your works as cards, every deadline on one home
page, hosted free on GitHub Pages and installable as an app.

**Start with [SETUP.md](./SETUP.md).** About 15 minutes, no coding.

## Shape of it

```
index.html        the entire site, one file, no framework and no build step
sw.js             caches the shell so repeat opens paint instantly and work offline
manifest.json     makes it installable on a phone
icons/ assets/    app icons and logo
backend/Code.gs   paste into Apps Script; the only thing that touches your data
SETUP.md          step by step
```

## How it holds together

Your Google Sheet is the database. The Apps Script web app is the only thing
that can read it, and it answers nothing without a valid session, which only
your 4-digit PIN produces. Five wrong tries locks it for 15 minutes, which is
what makes four digits safe.

The GitHub Pages site holds no data at all. It is an empty shell that asks for
the PIN and then draws whatever the backend sends. Anyone who finds the URL sees
a PIN box and nothing else, which is why a public repo is fine.

## Why it feels instant

The first unlock on a new device takes a second or two, because Apps Script is
not fast. Every open after that paints from a copy held on your device, before
any network call happens, and then confirms quietly in the background. If
nothing changed, nothing on screen moves. If something did, only what changed is
redrawn, so your scroll position and anything half-typed survive.

Each work's records load when you open that work, not on the home page, so the
home page stays the same size whether you have 50 records or 5,000.

## Works

Seeded with 14: three teaching, four research, and the 13 responsibility areas
carried over from FAMS+. All of them are editable from **manage** — add, rename,
recolour, reorder, hide, archive, or delete, including inventing new ones with
their own fields. Nothing about a work is written into the code.

Tick **timeline** on any date field and that date joins the Upcoming strip on the
home page. That one rule is what keeps the reminder system working for works
that do not exist yet.

## Safety without a second PIN

One PIN covers everything, so the guardrails are placed where they cost you
nothing: archive is offered first at year end, deleting needs the work's name
typed out, deletions sit in a recycle bin for 30 days, and every change is
written to an activity log. Your Sheet's own version history sits underneath all
of it.
