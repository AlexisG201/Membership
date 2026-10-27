# U.S.S. A.L.E.X.I.S. Member Registration

**A.L.E.X.I.S.** stands for **A**daptive **L**earning, **E**ducation, and e**X**perimental **I**ntelligence for **S**ociety.

A fun sign-up page for everyone Alexis has taught. Members fill in a short form, get a clearance code such as
`007-BIM-T-DELTA`, and download a futuristic member card. Registrations are saved in a Google Sheet.
The page is in English only.

```
alexis-registration/
  index.html             The page. GitHub Pages serves this file.
  assets.js              The A.L.E.X.I.S. logo and country flags used on the card. Must sit next to index.html.
  apps-script/
    Code.gs              The backend. You paste it into Google Apps Script (it does not run on GitHub).
    appsscript.json      Optional settings, only needed if you use the clasp tool.
  README.md              This file.
```

## How the pieces fit

```
Member's browser  --->  index.html on GitHub Pages  --->  Google Apps Script (Code.gs)  --->  Google Sheet
                        (form + card drawing)             (checks, saves, makes the code)     (the database)
```

GitHub Pages can only host files, so the page lives there and the saving is done by a small Google
Apps Script web app. Your Google Sheet stays exactly where it is.

---

## Setup, step by step

Do the parts in this order. It takes about 15 minutes.

### Part 1. Get your Google Sheet ID

1. Open the Google Sheet that stores registrations.
2. Look at the address bar. The ID is the long text between `/d/` and `/edit`:
   `https://docs.google.com/spreadsheets/d/`**`1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789`**`/edit`
3. Copy it. The script uses the first tab of the sheet.

Optional: rename cell B1 from `PIN` to `PIN_Hash`, because that column no longer holds PINs.
The script adds the two new headers (`Relationship`, `Standing`) in columns N and O by itself.

### Part 2. Put the backend on Google

1. Go to <https://script.google.com> and open your existing project, or choose **New project**.
2. Click `Code.gs` in the left list. Select everything in it and delete it.
3. Open `apps-script/Code.gs` from this repo, copy everything, and paste it into the editor.
   If the project also has an `Index.html` file, delete it. The old version needs it, this one does not.
4. Click the **gear icon** (Project Settings). Scroll to **Script properties**, click **Add script property**:
   - Property: `SHEET_ID`
   - Value: the ID from Part 1
   - Click **Save script properties**.
5. Go back to the editor (the `< >` icon). In the function drop-down at the top choose `checkSetup`,
   then click **Run**. Google asks you to authorise it. If you see "Google hasn't verified this app",
   click **Advanced**, then **Go to (project name) (unsafe)**. That warning appears because you wrote the
   script yourself. When the log says `OK. Sheet ...`, the connection works.
6. Click **Deploy**, then **New deployment**. Click the gear next to "Select type" and choose **Web app**.
   - Description: `v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** and copy the **Web app URL**. It ends in `/exec`.
7. Test it: paste that URL into a new browser tab. You should see `{"ok":true,"service":"alexis-registration",...}`.

### Part 3. Connect the page to the backend

1. Open `index.html` in any text editor.
2. Near the top of the second `<script>` section, find:
   ```js
   API_URL: 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE',
   ```
3. Replace the text between the quotes with your Web app URL. Save the file.
4. Double-click `index.html` to open it in your browser (keep `assets.js` in the same folder). The status block
   on the left should say **Roster online**. If it says **Demo mode**, the URL has not been pasted in yet.
   If it says **Roster offline**, see Troubleshooting below.
5. Register once as a test. A new row should appear in your Google Sheet. Delete the test row afterwards.

### Part 4. Publish on GitHub Pages

Easiest way, no command line:

1. On github.com click **New repository**. Name it, for example, `alexis-registration`. Choose **Public**. Click **Create repository**.
2. Click **uploading an existing file**. Drag in **`index.html`, `assets.js`**, `README.md` and the whole `apps-script`
   folder. Click **Commit changes**. Without `assets.js` the card has no logo or flag.
3. Go to **Settings**, then **Pages**. Under "Build and deployment" set Source to **Deploy from a branch**,
   Branch to **main** and folder to **/ (root)**. Click **Save**.
4. After a minute your page is live at `https://YOUR-USERNAME.github.io/alexis-registration/`.

Command line instead:

```bash
cd alexis-registration
git init -b main
git add .
git commit -m "A.L.E.X.I.S. registration"
git remote add origin https://github.com/YOUR-USERNAME/alexis-registration.git
git push -u origin main
```

The repository contains no secrets. The Sheet ID and the PIN key live in the Google script's
properties, not in these files.

### Changing the backend later

Editing `Code.gs` and pressing save is **not enough**. The live web app keeps running the old version until you:
**Deploy, then Manage deployments, click the pencil, set Version to "New version", then Deploy.**
The URL stays the same, so `index.html` does not change.

---

## The member card

The card is drawn in the member's browser (2400 x 3600 pixels, PNG with transparent corners) and downloaded
from there. It shows, top to bottom:

| On the card | Comes from |
|---|---|
| A.L.E.X.I.S. logo with "Live, Learn & Prosper" ring text, and the full name | `assets.js` and `index.html` |
| Round photo with a glowing ring | The photo the member picks. Without one, the card shows their initials. The photo never leaves their device |
| Name | Full name, in capitals. A long name moves onto two lines |
| Two title lines | Academic Level on top (for example `LIEUTENANT COMMANDER`), Primary Role below (for example `CHIEF TACTICAL OFFICER`) |
| Member Since | Year of registration |
| SEC-CODE | The clearance code |
| Flag | The country, if it is one of the 25 flags in `assets.js` (Taiwan, Malaysia, Indonesia, Vietnam, Thailand, Philippines, Singapore, Japan, South Korea, Hong Kong, Macau, China, India, United States, Canada, United Kingdom, Australia, Germany, France, New Zealand, Myanmar, Cambodia, Mongolia, Brunei, Laos). Any other country is shown as a text label |
| Motto | The motto the member picked |

Department and university are saved in the Sheet and built into the SEC-CODE, but they are not printed on the card.

**The logo.** The owl logo inside `assets.js` comes from the logo file Alexis supplied (the round emblem only). The
"Live, Learn & Prosper" ring text around it is drawn by the page in a Eurostile-style font (Michroma), so it stays sharp.
To change the wording, edit the `arcText(...)` line in `index.html`. To swap in another logo: add a file named
`logo.png` next to `index.html`, then in `index.html` change `LOGO_URL: ''` to `LOGO_URL: 'logo.png'`. This works on
the GitHub Pages site. If the file cannot be loaded, the built-in logo is used.

**Your own card.** The card prints whatever is in the Sheet row. To give yourself a special card (for example
`Fleet Admiral` / `Laureate`, `Member Since 2018`, or a different SEC-CODE), register once, then edit your own row in
the Sheet (columns D, E, F and K), then register again with the same name, university and PIN to fetch the updated card.

---

## What gets saved

| Sheet column | Content |
|---|---|
| Member_ID | Next free number (highest existing + 1) |
| PIN_Hash | Keyed hash of the PIN, never the PIN itself |
| Full_Name, Country, Department, University | As typed |
| Primary_Role | Taken from **Relationship** (table below) |
| Academic_Level | Taken from **Standing** (table below) |
| Member_Since | Year of registration |
| Personal_Motto | One of four choices |
| Photo_URL | Always empty. Photos stay on the member's device and are only used to draw the card |
| Status | `Active` |
| SEC_CODE | e.g. `007-BIM-T-DELTA` |
| Relationship, Standing | The raw choices, kept so you can analyse them later |

### Relationship gives Primary_Role

| Relationship | Primary_Role |
|---|---|
| RA | Vulcan Science Academy Fellow |
| TA | Chief Tactical Officer |
| Mentored | Starfleet Academy Cadet |
| International | Federation Diplomatic Envoy |
| Exchange | Federation Exchange Officer |
| EMBA | Civilian Enterprise Consultant |

### Standing gives Academic_Level

| Standing | Academic_Level |
|---|---|
| Freshman | Ensign |
| Sophomore | Lieutenant Junior |
| Junior | Lieutenant |
| Senior | Lieutenant Commander |
| Graduate | Commander |
| Bachelor | Starfleet Graduate |
| Master | Senior Staff Officer |
| PhD | Federation Scientist |
| Industry | Commodore |

To change a title, edit it in **both** `ROLE_MAP` / `LEVEL_MAP` in `Code.gs` and `RELATIONSHIPS` / `STANDINGS`
in `index.html`, then redeploy the backend as described above.

### The clearance code: `NNN-DEPT-I-AFFIL`

- `NNN` is the member number.
- `DEPT` comes from the department text: `BIM` international management or business, `COM` management, business,
  finance, accounting, marketing, economics, `ENG` engineering, computing, maths, physics, `ART` humanities, design,
  languages, media, arts, otherwise `GEN`. The first matching rule wins. Chinese department names work too.
- `I` is the first letter of the last word of a Latin name (`Alexis Tan` gives `T`) or the first character of a
  Chinese name.
- `AFFIL` is `DELTA` for YunTech (including 雲林科技大學), otherwise `GAMMA`. `ALPHA` and `OMEGA` are reserved for
  manual admin override: the page never produces them, you type them into the `SEC_CODE` cell yourself
  (for example `001-BIM-G-ALPHA` on the founder's card).

The rules are in `deptBlock_`, `initial_` and `affiliation_` in `Code.gs`.

## How PINs and repeat visits work

- The PIN must be exactly 4 digits. It is stored only as a hash made with a secret key that lives in the script
  properties (created automatically the first time someone registers).
- If the same name at the same university registers again with the **same PIN**, they get their existing card back.
  This also makes a double click or a timed-out request harmless.
- Same name and university with a **different PIN** is refused, so nobody can overwrite or impersonate a member.
- Honest limit: a 4-digit PIN has only 10,000 possibilities. The hash stops casual snooping in the sheet, not a
  determined attacker who has both the sheet and the script key. It is fine for a fun club. Do not let members
  reuse a real banking or phone PIN.

## If the sheet already has rows from the old version

The old version stored PINs as plain numbers. Open the Apps Script editor, choose `migratePlainPins` in the
function drop-down and click **Run** once. It converts those PINs to hashes (and puts back leading zeros that
Google Sheets removed). It is safe to run twice.

## Privacy

- The sheet holds names, schools and countries. Keep the sheet itself private. Do not share its link publicly.
- The web app is public but write-only: it never returns the roster. It only returns a member's own record when
  name, university and PIN all match. Someone can discover that a name is registered by trying, but sees nothing else.
- Because this collects personal data from students, tell members what is saved. The page says so near the top.

## Trying the page without saving anything

Add `?demo` to the page address (for example `index.html?demo`). The page then runs with a pretend backend and
shows **Demo mode** in red. Nothing is sent or saved. This is also what you see until `API_URL` is filled in.

## Troubleshooting

| What you see | Likely cause and fix |
|---|---|
| Status says **Demo mode** | `API_URL` still has the placeholder text. Paste your `/exec` URL (Part 3). |
| Status says **Roster offline** | The URL is wrong, or the deployment's "Who has access" is not **Anyone**. Open the URL in a browser tab; you should see `{"ok":true...}`. |
| "The roster sent an unexpected reply" | Same cause: access is not **Anyone**, so Google returns a sign-in page. Redeploy with access set to Anyone. |
| Registering works but my edits to `Code.gs` have no effect | You saved but did not deploy a new version. See "Changing the backend later". |
| "The roster rejected one of the answers" | A field is empty, too long, or starts with `=`, `+`, `-` or `@`. Check the form. |
| The card has no logo, or no flag for a listed country | `assets.js` is missing or not next to `index.html`. Upload it too. |
| Card looks plain or uses different letters | The page loads fonts from Google Fonts. Offline or blocked networks fall back to system fonts. |
| Card download does nothing on a phone | Press and hold the card image and choose **Save image**. |

## Credits and notes

The look of the card follows Alexis's own design, and the page around it uses the same silver, navy and light-blue
sci-fi style. This is an unofficial fan-made project for fun. It is not affiliated with Star Trek or any school, and the
member card is not an ID document.
Fonts: Antonio, Exo 2, Orbitron, Michroma and Noto Sans TC (SIL Open Font License), loaded from Google Fonts.
Flags: flag-icons (MIT licence).
