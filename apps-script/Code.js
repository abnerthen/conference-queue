/**
 * Conference check-in backend (Google Apps Script, bound to the attendee Sheet).
 *
 * Sheet layout
 *   Attendees: A ID | B Email | C Name | D Type | E RegCode | F Present | G CheckedInAt
 *   Types:     A Type | B Colour (hex) | C Counter
 *
 * Script Properties (Project Settings -> Script Properties)
 *   HMAC_SECRET  long random string, signs the QR tokens
 *   STAFF_KEY    passcode the Cloudflare scanner must send
 *
 * First-time setup: run setupSheet() once, then paste attendees into the
 * Attendees tab (columns B-D), then run fillIdsAndCodes().
 */

const ATT = 'Attendees';
const TYPES = 'Roles';
const MAX_FAILS = 5;            // wrong registration codes allowed per email...
const LOCKOUT_SECONDS = 900;    // ...before a 15 minute lockout
const QR_VALID_MS = 2 * 60 * 60 * 1000; // QR stays scannable for 2 hours

const ss_ = () => SpreadsheetApp.getActive();
const prop_ = k => PropertiesService.getScriptProperties().getProperty(k);

/* ------------------------------ One-time setup ------------------------------ */

function setupSheet() {
  const ss = ss_();
  let att = ss.getSheetByName(ATT) || ss.insertSheet(ATT);
  att.getRange(1, 1, 1, 7).setValues([[
    'ID', 'Email', 'Name', 'Type', 'RegCode', 'Present', 'CheckedInAt'
  ]]).setFontWeight('bold');
  att.setFrozenRows(1);

  let types = ss.getSheetByName(TYPES);
  if (!types) {
    types = ss.insertSheet(TYPES);
    types.getRange(1, 1, 4, 3).setValues([
      ['Type', 'Colour', 'Counter'],
      ['VIP', '#4f46e5', 'Counter A'],
      ['Speaker', '#059669', 'Counter B'],
      ['Participant', '#e2e8f0', 'Counter C']
    ]);
    types.getRange(1, 1, 1, 3).setFontWeight('bold');
  }

  // Type column becomes a dropdown fed by the Types tab
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(types.getRange('A2:A'), true)
    .setAllowInvalid(false)
    .build();
  att.getRange('D2:D').setDataValidation(rule);
  att.getRange('F2:F').insertCheckboxes();
}

function fillIdsAndCodes() {
  const sh = ss_().getSheetByName(ATT);
  const last = sh.getLastRow();
  if (last < 2) return;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  const used = new Set(sh.getRange(2, 5, last - 1, 1).getValues().flat()
    .map(c => normCode_(c)).filter(Boolean));

  for (let r = 2; r <= last; r++) {
    if (!sh.getRange(r, 2).getValue()) continue; // skip blank rows
    const idCell = sh.getRange(r, 1);
    if (!idCell.getValue()) idCell.setValue(Utilities.getUuid());

    const codeCell = sh.getRange(r, 5);
    if (!codeCell.getValue()) {
      let code;
      do { code = newCode_(alphabet); } while (used.has(normCode_(code)));
      used.add(normCode_(code));
      codeCell.setNumberFormat('@').setValue(code);
    }
  }
}

function newCode_(alphabet) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random());
  let s = '';
  for (let i = 0; i < 8; i++) s += alphabet[bytes[i] & 31];
  return s.slice(0, 4) + '-' + s.slice(4);   // e.g. K7QM-2XPD
}

/* --------------------------------- Helpers ---------------------------------- */

function normCode_(c) {
  return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function sign_(s) {
  const sig = Utilities.computeHmacSha256Signature(s, prop_('HMAC_SECRET'));
  return Utilities.base64EncodeWebSafe(sig).replace(/=+$/, '');
}

function safeEqual_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function attendees_() {
  const v = ss_().getSheetByName(ATT).getDataRange().getValues().slice(1);
  return v.map((r, i) => ({
    row: i + 2,
    id: String(r[0]),
    email: String(r[1]).trim().toLowerCase(),
    name: r[2],
    type: r[3],
    code: normCode_(r[4]),
    present: r[5] === true
  })).filter(a => a.email);
}

function typeInfo_(type) {
  const v = ss_().getSheetByName(TYPES).getDataRange().getValues().slice(1);
  const m = v.find(r => String(r[0]).trim().toLowerCase() === String(type).trim().toLowerCase());
  return m ? { colour: String(m[1]), counter: String(m[2]) }
           : { colour: '#CCCCCC', counter: 'Help desk' };
}

/* ------------------------- Web app entry points ----------------------------- */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Conference check-in')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  let out;
  try {
    const req = JSON.parse(e.postData.contents);
    out = req.action === 'scan'
      ? scan_(req.token, req.staffKey)
      : { ok: false, error: 'Unknown action.' };
  } catch (err) {
    out = { ok: false, error: 'Bad request.' };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/* --------------- Called from the attendee page (google.script.run) ---------- */

function getQr(email, regCode) {
  email = String(email || '').trim().toLowerCase();
  const code = normCode_(regCode);
  if (!email || !code) return { ok: false, error: 'Enter your email and registration code.' };

  const cache = CacheService.getScriptCache();
  const failKey = 'fails:' + email;
  const fails = Number(cache.get(failKey) || 0);
  if (fails >= MAX_FAILS) {
    return { ok: false, error: 'Too many wrong attempts. Try again in 15 minutes or visit the help desk.' };
  }

  const a = attendees_().find(x => x.email === email);
  if (!a) return { ok: false, error: 'This email is not on the attendee list.' };

  if (!a.code || !safeEqual_(a.code, code)) {
    cache.put(failKey, fails + 1, LOCKOUT_SECONDS);
    return { ok: false, error: 'The email and registration code do not match. Check your ticket email.' };
  }
  cache.remove(failKey);

  if (a.present) return { ok: false, error: 'This attendee has already checked in.' };

  const t = typeInfo_(a.type);
  const payload = a.id + '.' + (Date.now() + QR_VALID_MS);
  return {
    ok: true,
    name: a.name,
    type: a.type,
    colour: t.colour,
    counter: t.counter,
    token: payload + '.' + sign_(payload)
  };
}

/* ------------------- Called by the Cloudflare scanner (doPost) -------------- */

function scan_(token, staffKey) {
  if (!safeEqual_(staffKey || '', prop_('STAFF_KEY'))) {
    return { ok: false, error: 'Scanner is not authorised. Check the staff key.' };
  }
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return { ok: false, error: 'Invalid QR code.' };
  const [id, exp, sig] = parts;
  if (!safeEqual_(sign_(id + '.' + exp), sig)) return { ok: false, error: 'Invalid QR code.' };
  if (Date.now() > Number(exp)) {
    return { ok: false, error: 'QR code expired. Ask the attendee to generate a new one.' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const a = attendees_().find(x => x.id === id);
    if (!a) return { ok: false, error: 'Not on the attendee list.' };
    if (a.present) return { ok: false, error: 'Already checked in: ' + a.name };

    ss_().getSheetByName(ATT).getRange(a.row, 6, 1, 2).setValues([[true, new Date()]]);
    const t = typeInfo_(a.type);
    return { ok: true, name: a.name, type: a.type, colour: t.colour, counter: t.counter };
  } finally {
    lock.releaseLock();
  }
}