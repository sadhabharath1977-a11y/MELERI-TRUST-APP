// Google Sheet-ல்: Extensions > Apps Script > இந்தக் குறியீட்டை ஒட்டவும்.
// Project Settings > Script properties > KEY = (நீண்ட random எழுத்துகள்; Vercel-ல் SERVICE_SCRIPT_KEY-உம் இதுவே)
// Deploy > Web app: Execute as = Me, Who has access = Anyone.
const S = { svc: 'சேவைகள்', names: 'பெயர்கள்', places: 'இடங்கள்', log: 'பதிவுகள்' };
const STATS_TABS = ['சேவை விவரம்', 'Sevai Details', 'sheet6', 'Sheet6'];
const sh_ = (n) => SpreadsheetApp.getActive().getSheetByName(n);
// Small CacheService layer: the lists (names / places / services) are cached 5 min, the yearly summary 2 min.
// A new entry clears the summary at once. (If you edit names/places in the Sheet they show up within 5 minutes.)
function cached_(key, ttl, fn) {
  const c = CacheService.getScriptCache();
  const hit = c.get(key);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  const v = fn();
  try { c.put(key, JSON.stringify(v), ttl); } catch (e) {}
  return v;
}
const col_ = (n) => cached_('col:' + n, 300, () => sh_(n).getRange(2, 1, Math.max(sh_(n).getLastRow() - 1, 1), 1).getValues().map(r => String(r[0]).trim()).filter(String));
const today_ = () => Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
function services_() {
  return cached_('svc', 300, () => {
    const sh = sh_(S.svc);
    return sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 4).getValues()
      .filter(r => r[0]).map(r => ({ id: String(r[0]).trim(), name: String(r[1]).trim(), points: Number(r[2]) || 0, active: String(r[3]).trim() === 'ஆம்' }));
  });
}
function doPost(e) {
  let out;
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.key !== PropertiesService.getScriptProperties().getProperty('KEY')) throw new Error('auth');
    out = b.action === 'add' ? add_(b) : b.action === 'stats' ? stats_() : b.action === 'detail' ? cached_('detail:' + String(b.year), 120, () => detail_(b)) : cached_('data:' + String(b.year), 120, () => data_(b));
  } catch (err) { out = { error: String(err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
// "சேவை விவரம்" tab -> CSV text (the app reads the dashboard figures from here).
function stats_() {
  let sh = null;
  for (const n of STATS_TABS) { sh = sh_(n); if (sh) break; }
  if (!sh) throw new Error('சேவை விவரம் tab இல்லை');
  const rows = sh.getLastRow(), cols = sh.getLastColumn();
  if (rows < 1 || cols < 1) return { csv: '' };
  const q = (v) => { v = String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const csv = sh.getRange(1, 1, rows, cols).getDisplayValues().map(r => r.map(q).join(',')).join('\n');
  return { csv };
}
function data_(b) {
  const svcs = services_(), byId = {}; svcs.forEach(s => byId[s.id] = s);
  const year = /^\d{4}$/.test(b.year) ? b.year : today_().slice(0, 4);
  const log = sh_(S.log), n = log.getLastRow() - 1;
  const rows = n > 0 ? log.getRange(2, 1, n, 8).getValues() : [];
  const agg = {}, years = {}, recent = [];
  rows.forEach(r => {
    const d = r[1] instanceof Date ? Utilities.formatDate(r[1], 'Asia/Kolkata', 'yyyy-MM-dd') : String(r[1]);
    years[d.slice(0, 4)] = 1;
    if (d.slice(0, 4) !== year) return;
    const sname = byId[r[4]] ? byId[r[4]].name : String(r[5]);
    const k = r[2] + '|' + r[4];
    agg[k] = agg[k] || [String(r[2]), String(r[4]), sname, 0, 0];
    agg[k][3]++; agg[k][4] += Number(r[6]) || 0;
    recent.push([d, String(r[2]), String(r[3]), sname, Number(r[6]) || 0]);
  });
  return { year, years: Object.keys(years).sort().reverse(), services: svcs.filter(s => s.active), names: col_(S.names), places: col_(S.places), agg: Object.values(agg), recent: recent.slice(-15).reverse() };
}
// Every entry of one year (date, name, place, service, points) - used only for the PDF report.
function detail_(b) {
  const byId = {}; services_().forEach(s => byId[s.id] = s);
  const year = /^\d{4}$/.test(b.year) ? b.year : today_().slice(0, 4);
  const log = sh_(S.log), n = log.getLastRow() - 1;
  const rows = n > 0 ? log.getRange(2, 1, n, 8).getValues() : [];
  const out = [];
  rows.forEach(r => {
    const d = r[1] instanceof Date ? Utilities.formatDate(r[1], 'Asia/Kolkata', 'yyyy-MM-dd') : String(r[1]);
    if (d.slice(0, 4) !== year) return;
    out.push([d, String(r[2]), String(r[3]), byId[r[4]] ? byId[r[4]].name : String(r[5]), Number(r[6]) || 0]);
  });
  out.sort((a, c) => (a[0] < c[0] ? -1 : a[0] > c[0] ? 1 : 0));
  return { year, rows: out };
}
function add_(b) {
  const d = String(b.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > today_()) throw new Error('தேதி சரியில்லை');
  if (col_(S.names).indexOf(b.name) < 0) throw new Error('பெயர் சரியில்லை');
  if (col_(S.places).indexOf(b.place) < 0) throw new Error('இடம் சரியில்லை');
  const byId = {}; services_().forEach(s => { if (s.active) byId[s.id] = s; });
  const ids = (b.ids || []).filter((x, i, a) => byId[x] && a.indexOf(x) === i);
  if (!ids.length) throw new Error('சேவையைத் தேர்ந்தெடுக்கவும்');
  // rid = one-time save number made by the app. The same rid arriving twice (a retry after a slow reply) is NOT saved again.
  const rid = /^[A-Za-z0-9-]{8,64}$/.test(String(b.rid || '')) ? String(b.rid) : '';
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const log = sh_(S.log), n = log.getLastRow() - 1;
    if (rid && n > 0) {
      const m = Math.min(n, 300), from = n - m + 2; // only the latest rows: a retry always arrives within seconds
      const rids = log.getRange(from, 9, m, 1).getValues(), pts = log.getRange(from, 7, m, 1).getValues();
      let cnt = 0, sum = 0;
      rids.forEach((x, i) => { if (String(x[0]) === rid) { cnt++; sum += Number(pts[i][0]) || 0; } });
      if (cnt) return { ok: true, duplicate: true, count: cnt, points: sum };
    }
    const r = log.getLastRow() + 1, now = new Date();
    const vals = ids.map(id => [now, d, b.name, b.place, id, byId[id].name, byId[id].points, String(b.by || ''), rid]);
    log.getRange(r, 2, vals.length, 1).setNumberFormat('@');
    log.getRange(r, 1, vals.length, 9).setValues(vals);
    const c = CacheService.getScriptCache();
    c.removeAll(['data:' + d.slice(0, 4), 'data:undefined', 'data:', 'detail:' + d.slice(0, 4), 'detail:undefined', 'detail:']);
  } finally { lock.releaseLock(); }
  return { ok: true, count: ids.length, points: ids.reduce((a, id) => a + byId[id].points, 0) };
}
