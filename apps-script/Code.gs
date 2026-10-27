/**
 * U.S.S. A.L.E.X.I.S. member registration: Google Apps Script backend.
 *
 * The web page (index.html, hosted on GitHub Pages) sends registrations here.
 * This script checks them, saves one row per member in a Google Sheet, and
 * sends back the member's details so the page can draw their card.
 *
 * ONE-TIME SETUP (details in the README):
 *   1. Project Settings > Script properties > add   SHEET_ID = <your Google Sheet ID>
 *   2. Deploy > New deployment > Web app
 *        Execute as: Me      Who has access: Anyone
 *   3. Paste the web app URL (ends in /exec) into index.html (CONFIG.API_URL).
 *
 * Nothing secret is written in this file, so it is safe to keep in a public repo.
 */

// ---------------------------------------------------------------------------
// Sheet layout. Columns A to M are the original 13; N and O are new.
// The PIN column now holds a keyed hash, never the PIN itself.
// ---------------------------------------------------------------------------
var HEADERS = [
  'Member_ID', 'PIN_Hash', 'Full_Name', 'Primary_Role', 'Academic_Level', 'Member_Since',
  'Personal_Motto', 'Country', 'Photo_URL', 'Status', 'SEC_CODE', 'Department', 'University',
  'Relationship', 'Standing'
];
var COL = { ID: 0, PIN: 1, NAME: 2, ROLE: 3, LEVEL: 4, SINCE: 5, MOTTO: 6, COUNTRY: 7, PHOTO: 8,
            STATUS: 9, SEC: 10, DEPT: 11, UNI: 12, REL: 13, STANDING: 14 };

// Relationship -> Primary_Role. Keep in sync with RELATIONSHIPS in index.html.
var ROLE_MAP = {
  'RA':            'Vulcan Science Academy Fellow',   // alternative: 'Chief Science Officer'
  'TA':            'Chief Tactical Officer',
  'Mentored':      'Starfleet Academy Cadet',
  'International': 'Federation Diplomatic Envoy',
  'Exchange':      'Federation Exchange Officer',
  'EMBA':          'Civilian Enterprise Consultant'
};
var DEFAULT_ROLE = 'Starfleet Academy Cadet';

// Standing -> Academic_Level. Keep in sync with STANDINGS in index.html.
var LEVEL_MAP = {
  'Freshman':  'Ensign',
  'Sophomore': 'Lieutenant Junior',
  'Junior':    'Lieutenant',
  'Senior':    'Lieutenant Commander',
  'Graduate':  'Commander',
  'Bachelor':  'Starfleet Graduate',
  'Master':    'Senior Staff Officer',
  'PhD':       'Federation Scientist',
  'Industry':  'Commodore'
};
var DEFAULT_LEVEL = 'Ensign';

var MOTTOS = [
  'Engage and innovate.',
  'Adapt, Explore, and Overcome.',
  'Knowledge is the ultimate frontier.',
  'Highly illogical, yet highly interesting.'
];

// ---------------------------------------------------------------------------
// Web app entry points
// ---------------------------------------------------------------------------

/** Health check. Open the web app URL in a browser: you should see {"ok":true,...}. */
function doGet() {
  return json_({ ok: true, service: 'alexis-registration', time: new Date().toISOString() });
}

/** Receives a registration from the web page. */
function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (data.action !== 'register') return json_({ ok: false, error: 'invalid_input', field: 'action' });
    return json_(register_(data));
  } catch (err) {
    console.error('doPost failed: ' + err + (err && err.stack ? '\n' + err.stack : ''));
    return json_({ ok: false, error: 'server' });
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

function register_(data) {
  if (data.website) return { ok: false, error: 'invalid_input', field: 'website' };   // honeypot: bots fill this in

  var v = validate_(data);
  if (v.error) return { ok: false, error: 'invalid_input', field: v.error };
  var c = v.clean;

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { ok: false, error: 'busy' }; }
  try {
    var sheet = getSheet_();
    ensureHeader_(sheet);

    var last = sheet.getLastRow();
    var rows = last > 1 ? sheet.getRange(2, 1, last - 1, HEADERS.length).getValues() : [];

    var nameKey = norm_(c.fullName), uniKey = norm_(c.university);
    var pinHash = hmac_(nameKey + '|' + c.pin);

    // Same name at the same university already registered?
    for (var i = 0; i < rows.length; i++) {
      if (norm_(rows[i][COL.NAME]) === nameKey && norm_(rows[i][COL.UNI]) === uniKey) {
        if (String(rows[i][COL.PIN]) === pinHash) {
          return { ok: true, returning: true, member: memberFromRow_(rows[i]) };   // right PIN: hand the card back
        }
        return { ok: false, error: 'name_taken' };
      }
    }

    // New member: next number after the highest one in use (survives deleted rows).
    var maxId = 0;
    for (var j = 0; j < rows.length; j++) {
      var n = Number(rows[j][COL.ID]);
      if (n > maxId) maxId = n;
    }
    var memberId = maxId + 1;
    var since = new Date().getFullYear();
    var role = ROLE_MAP[c.relationship] || DEFAULT_ROLE;
    var level = LEVEL_MAP[c.standing] || DEFAULT_LEVEL;
    var secCode = generateSecCode(memberId, c.department, c.fullName, c.university);

    var row = [];
    row[COL.ID] = memberId;
    row[COL.PIN] = pinHash;
    row[COL.NAME] = c.fullName;
    row[COL.ROLE] = role;
    row[COL.LEVEL] = level;
    row[COL.SINCE] = since;
    row[COL.MOTTO] = c.motto;
    row[COL.COUNTRY] = c.country;
    row[COL.PHOTO] = '';                 // photos stay on the member's device
    row[COL.STATUS] = 'Active';
    row[COL.SEC] = secCode;
    row[COL.DEPT] = c.department;
    row[COL.UNI] = c.university;
    row[COL.REL] = c.relationship;
    row[COL.STANDING] = c.standing;
    sheet.appendRow(row);
    SpreadsheetApp.flush();

    return { ok: true, returning: false, member: memberFromRow_(row) };
  } finally {
    lock.releaseLock();
  }
}

/** Checks every field; returns {clean: {...}} or {error: '<field name>'}. */
function validate_(d) {
  function text(value, max) {
    var s = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s || s.length > max) return null;
    if (/^[=+\-@]/.test(s)) return null;      // would be read as a formula by Google Sheets
    return s;
  }
  var c = {};
  if (!(c.fullName = text(d.fullName, 60))) return { error: 'fullName' };
  c.pin = String(d.pin == null ? '' : d.pin);
  if (!/^\d{4}$/.test(c.pin)) return { error: 'pin' };
  c.relationship = String(d.relationship || '');
  if (!ROLE_MAP.hasOwnProperty(c.relationship)) return { error: 'relationship' };
  c.standing = String(d.standing || '');
  if (!LEVEL_MAP.hasOwnProperty(c.standing)) return { error: 'standing' };
  if (!(c.department = text(d.department, 80))) return { error: 'department' };
  if (!(c.university = text(d.university, 80))) return { error: 'university' };
  if (!(c.country = text(d.country, 60))) return { error: 'country' };
  c.motto = String(d.motto || '');
  if (MOTTOS.indexOf(c.motto) < 0) return { error: 'motto' };
  return { clean: c };
}

function memberFromRow_(r) {
  return {
    memberId: Number(r[COL.ID]),
    secCode: String(r[COL.SEC]),
    fullName: String(r[COL.NAME]),
    role: String(r[COL.ROLE]),
    level: String(r[COL.LEVEL]),
    since: Number(r[COL.SINCE]),
    motto: String(r[COL.MOTTO]),
    country: String(r[COL.COUNTRY]),
    department: String(r[COL.DEPT]),
    university: String(r[COL.UNI]),
    relationship: String(r[COL.REL] || ''),
    standing: String(r[COL.STANDING] || '')
  };
}

// ---------------------------------------------------------------------------
// SEC-CODE:  <member no.>-<department>-<initial>-<affiliation>   e.g. 007-BIM-T-DELTA
// ---------------------------------------------------------------------------

function generateSecCode(memberId, department, fullName, university) {
  var idBlock = String(memberId).padStart(3, '0');
  return idBlock + '-' + deptBlock_(department) + '-' + initial_(fullName) + '-' + affiliation_(university);
}

/**
 * Department block. First match wins, so order matters:
 *   BIM  International management / business
 *   COM  Management, business, finance, accounting, marketing, economics
 *   ENG  Engineering, computing, maths, physics
 *   ART  Humanities, design, languages, media, arts
 *   GEN  anything else
 * Chinese department names work too. Short English words are matched as whole
 * words, so "Department" no longer counts as ART and "Systems" no longer as STEM.
 */
function deptBlock_(department) {
  var d = String(department || '').normalize('NFKC').toUpperCase();
  if (/INTERNATIONAL\s+(MANAGEMENT|BUSINESS)|\bBIM\b|國際企業|國際管理|國際商務|國企/.test(d)) return 'BIM';
  if (/MANAGEMENT|BUSINESS|FINANCE|ACCOUNTING|MARKETING|ECONOMICS|管理|企業|企管|商|財金|會計|行銷|經濟/.test(d)) return 'COM';
  if (/ENGINEERING|COMPUTER|INFORMATION TECHNOLOGY|MATHEMATICS|PHYSICS|\bSTEM\b|\bIT\b|工程|資工|電機|電子|機械|化工|資訊|數學|物理/.test(d)) return 'ENG';
  if (/HUMANITIES|DESIGN|LANGUAGE|LITERATURE|MUSIC|MEDIA|COMMUNICATION|\bARTS?\b|設計|人文|語|文學|藝術|傳播|音樂/.test(d)) return 'ART';
  return 'GEN';
}

/** Initial: Chinese names use the first character (the family name); Latin names use the last word. */
function initial_(fullName) {
  var n = String(fullName || '').normalize('NFKC').trim();
  if (!n) return 'X';
  var first = Array.from(n)[0];
  if (/[㐀-鿿]/.test(first)) return first;
  var parts = n.split(/\s+/);
  var ch = Array.from(parts[parts.length - 1])[0] || 'X';
  return /[A-Za-z]/.test(ch) ? ch.toUpperCase() : ch;
}

/** DELTA for YunTech, GAMMA for everyone else. ALPHA and OMEGA are reserved for manual admin override:
 *  edit the SEC_CODE cell in the Sheet by hand and they are never produced here. */
function affiliation_(university) {
  var u = String(university || '').normalize('NFKC').toUpperCase();
  return /YUNTECH|YUN TECH|YUNLIN|雲林科技|雲科/.test(u) ? 'DELTA' : 'GAMMA';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function props_() { return PropertiesService.getScriptProperties(); }

function getSheet_() {
  var id = props_().getProperty('SHEET_ID');
  if (!id) throw new Error('Script property SHEET_ID is not set (Project Settings > Script properties).');
  return SpreadsheetApp.openById(id).getSheets()[0];
}

/** Adds any missing header cells (and the whole header row on an empty sheet). */
function ensureHeader_(sheet) {
  if (sheet.getLastRow() === 0) { sheet.appendRow(HEADERS); return; }
  var current = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  for (var i = 0; i < HEADERS.length; i++) {
    if (!current[i]) sheet.getRange(1, i + 1).setValue(HEADERS[i]);
  }
}

function norm_(s) {
  return String(s == null ? '' : s).normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Secret key for PIN hashing. Created once, stored in Script properties, never leaves Google. */
function getSecret_() {
  var p = props_(), s = p.getProperty('PIN_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('PIN_SECRET', s); }
  return s;
}

function hmac_(message) {
  var sig = Utilities.computeHmacSha256Signature(message, getSecret_());
  return sig.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

// ---------------------------------------------------------------------------
// Optional tools: run these by hand from the Apps Script editor (Run button).
// ---------------------------------------------------------------------------

/** Run this after setting SHEET_ID. The log should say the sheet opened fine. */
function checkSetup() {
  var sheet = getSheet_();
  ensureHeader_(sheet);
  console.log('OK. Sheet "' + sheet.getParent().getName() + '", tab "' + sheet.getName() + '", ' +
              Math.max(sheet.getLastRow() - 1, 0) + ' member row(s).');
}

/**
 * Only needed if the sheet already holds rows saved by the old version, which stored PINs in plain text.
 * Turns each plain PIN into a hash. Safe to run twice: rows that are already hashed are skipped.
 */
function migratePlainPins() {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet_(), last = sheet.getLastRow(), done = 0;
    if (last < 2) { console.log('No member rows.'); return; }
    var rows = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
    rows.forEach(function (r, i) {
      var cell = String(r[COL.PIN]);
      if (/^[0-9a-f]{64}$/.test(cell)) return;
      var pin = cell.replace(/\D/g, '').padStart(4, '0').slice(-4);   // Sheets drops leading zeros, so put them back
      sheet.getRange(i + 2, COL.PIN + 1).setValue(hmac_(norm_(r[COL.NAME]) + '|' + pin));
      done++;
    });
    console.log('Hashed ' + done + ' PIN(s).');
  } finally { lock.releaseLock(); }
}
