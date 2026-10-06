// Service record: entry form, per-person / everyone summary, bar + donut charts.
// Charts are plain HTML/SVG (the page CSP allows no inline styles or external scripts); widths are set from JS.
// Smoothness: the last good data is kept in sessionStorage and shown instantly, then refreshed quietly;
// a failed load is retried once automatically. SAVE IS INSTANT: the entry is put in a small local queue
// (localStorage) and the totals update at once; the queue is sent to the Sheet in the background with the
// same one-time save number (rid), so retries / closing the app / losing the network can never lose or double an entry.
import { $, escapeHtml as esc, showToast } from "./util.js";
import { t } from "./i18n.js";
import { api } from "./api.js";

const today = () => new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const THANKS = [
  ["தங்கள் தொண்டுக்கு நன்றி 🙏", "Thank you for your selfless service 🙏"],
  ["சேவை மலர்ந்தது 🌸 வாழ்க வளமுடன்!", "Your service has blossomed 🌸 Vazhga Valamudan!"],
  ["குருவின் அருள் தங்களுடன் 🪔", "The Guru's grace is with you 🪔"]
];
const CK = "seva:v2:";
let data = null;
let year = "";
let sel = "";
let loading = false;
let failed = false;
let inflight = null;
let f = { date: "", name: "", place: "", ids: [] };
let lastSig = ""; // fingerprint of the last server data drawn; an unchanged refresh does not redraw (no flicker)
let lastTap = 0;
let flushing = false;
let retryTimer = 0;
let formSig = "";
let sumSig = "";
let yearSig = "";
const FK = "seva:fq:v1"; // entries the Sheet refused: kept here (never thrown away) until the member retries, edits or deletes them
const readF = () => {
  try {
    const q = JSON.parse(localStorage.getItem(FK));
    return Array.isArray(q) ? q : [];
  } catch (e) {
    return [];
  }
};
const writeF = (q) => {
  try {
    if (q.length) localStorage.setItem(FK, JSON.stringify(q));
    else localStorage.removeItem(FK);
  } catch (e) {}
};
const QK = "seva:q:v1";
const readQ = () => {
  try {
    const q = JSON.parse(localStorage.getItem(QK));
    return Array.isArray(q) ? q : [];
  } catch (e) {
    return [];
  }
};
const writeQ = (q) => {
  try {
    if (q.length) localStorage.setItem(QK, JSON.stringify(q));
    else localStorage.removeItem(QK);
  } catch (e) {}
};
const newRid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12) + "xx");

const readCache = (y) => {
  try {
    return JSON.parse(sessionStorage.getItem(CK + y));
  } catch (e) {
    return null;
  }
};
const writeCache = (d) => {
  try {
    sessionStorage.setItem(CK + d.year, JSON.stringify(d));
    sessionStorage.setItem(CK + "last", d.year);
  } catch (e) {}
};

export function clearSeva() {
  detail = null;
  data = null;
  year = "";
  sel = "";
  lastSig = "";
  formSig = "";
  sumSig = "";
  yearSig = "";
  failed = false;
  f = { date: "", name: "", place: "", ids: [] };
  try {
    Object.keys(sessionStorage).filter((k) => k.startsWith("seva:")).forEach((k) => sessionStorage.removeItem(k));
  } catch (e) {}
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchData(y, fresh) {
  let r = await api.seva.data(y, fresh);
  if (!r.ok && r.status !== 401) {
    await wait(1200); // Apps Script may have been asleep: one automatic second try
    r = await api.seva.data(y, fresh);
  }
  return r;
}

// quiet = background refresh (no spinner, no error screen when we already have something to show)
export function loadSeva(quiet, fresh) {
  if (inflight) {
    if (fresh) return inflight.then(() => loadSeva(quiet, true)); // an older (possibly stale) load is running: ask again afterwards, with the server copy skipped
    if (!data && !quiet) {
      loading = true;
      renderSeva();
    }
    return inflight;
  }
  if (!data) {
    let last = "";
    try {
      last = sessionStorage.getItem(CK + "last") || "";
    } catch (e) {}
    const c = last ? readCache(year || last) : null;
    if (c) {
      data = c;
      year = c.year;
      renderSeva();
    }
  }
  loading = !data && !quiet;
  failed = false;
  if (loading) renderSeva();
  const wasLoading = loading;
  inflight = fetchData(year, fresh).then((r) => {
    inflight = null;
    loading = false;
    let redraw = true;
    if (r.ok && !(data && readQ().length)) {
      const sig = JSON.stringify(r.data);
      redraw = wasLoading || !data || sig !== lastSig;
      lastSig = sig;
      data = r.data;
      year = data.year;
      writeCache(data);
    } else if (r.ok) redraw = false; // entries still waiting to be sent: keep the local totals
    else if (!data) failed = true;
    else redraw = false;
    if (redraw) renderSeva();
  });
  return inflight;
}

const opts = (list, cur, ph) => '<option value="">' + esc(ph) + "</option>" + list.map((x) => '<option value="' + esc(x) + '"' + (x === cur ? " selected" : "") + ">" + esc(x) + "</option>").join("");

function formHtml() {
  const pts = data.services.filter((s) => f.ids.includes(s.id)).reduce((a, s) => a + s.points, 0);
  return (
    '<label>' + esc(t("தேதி", "Date")) + '<input id="svDate" type="date" max="' + today() + '" value="' + esc(f.date || today()) + '"></label>' +
    '<label>' + esc(t("பெயர்", "Name")) + '<select id="svName">' + opts(data.names, f.name, t("— தேர்ந்தெடுக்கவும் —", "— Select —")) + "</select></label>" +
    '<label>' + esc(t("இடம்", "Place")) + '<select id="svPlace">' + opts(data.places, f.place, t("— தேர்ந்தெடுக்கவும் —", "— Select —")) + "</select></label>" +
    '<label>' + esc(t("சேவை விவரம் (ஒன்றுக்கு மேல் தேர்ந்தெடுக்கலாம்)", "Services (select one or more)")) + '</label><div class="sv-checks">' +
    data.services.map((s) => '<label class="sv-check"><input type="checkbox" data-sid="' + esc(s.id) + '"' + (f.ids.includes(s.id) ? " checked" : "") + "><span>" + esc(s.name) + "</span><em>" + s.points + "</em></label>").join("") + "</div>" +
    '<div class="sv-total" id="svPts">' + esc(t("இந்தப் பதிவின் புள்ளிகள்", "Points for this entry")) + ": " + pts + "</div>" +
    '<button id="svSave" class="unlock" type="button">💾 ' + esc(t("சேமி", "Save")) + "</button>" +
    failedHtml() +
    (readQ().length ? '<div class="sv-pend">⏳ ' + readQ().length + " " + esc(t("பதிவு அனுப்பப்படுகிறது… (இணையம் இல்லையென்றாலும் பாதுகாப்பாக உள்ளது)", "entries syncing… (safe even without internet)")) + "</div>" : "")
  );
}

function failedHtml() {
  const list = readF();
  if (!list.length) return "";
  return (
    '<div class="sv-fail"><b>⚠️ ' + esc(t("அனுப்ப முடியாத பதிவுகள்", "Entries that could not be saved")) + "</b>" +
    list.map((x) =>
      '<div class="sv-fitem"><span>' + esc(dmy(x.date)) + " · " + esc(x.name) + " · " + esc(x.place) + "</span><small>" + esc(x.why || "") + "</small>" +
      '<div class="sv-fbtn"><button type="button" data-fretry="' + esc(x.rid) + '">🔁 ' + esc(t("மீண்டும்", "Retry")) + "</button>" +
      '<button type="button" data-fedit="' + esc(x.rid) + '">✏️ ' + esc(t("திருத்து", "Edit")) + "</button>" +
      '<button type="button" data-fdel="' + esc(x.rid) + '">🗑 ' + esc(t("நீக்கு", "Delete")) + "</button></div></div>"
    ).join("") + "</div>"
  );
}

function bars(items, cls) {
  const max = Math.max(1, ...items.map((i) => i[1]));
  return items.map((i, n) => '<div class="bar"><span class="bn">' + esc(i[0]) + '</span><div class="bt"><i class="bf ' + cls(n) + '" data-w="' + Math.round((i[1] / max) * 100) + '"></i></div><b>' + i[1] + "</b></div>").join("");
}

function donut(items) {
  const total = items.reduce((a, i) => a + i[1], 0);
  if (!total) return "<small>" + esc(t("இன்னும் பதிவு இல்லை", "No entries yet")) + "</small>";
  let off = 0;
  const arcs = items.map((i, n) => {
    const p = (i[1] / total) * 100;
    const c = '<circle class="dn c' + (n % 8) + '" r="15.915" cx="21" cy="21" stroke-dasharray="' + p.toFixed(2) + " " + (100 - p).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>';
    off += p;
    return c;
  }).join("");
  const leg = items.map((i, n) => '<div><i class="c' + (n % 8) + '"></i>' + esc(i[0]) + " · " + Math.round((i[1] / total) * 100) + "%</div>").join("");
  return '<div class="sv-donut"><svg viewBox="0 0 42 42" role="img">' + arcs + '</svg><div class="sv-leg">' + leg + "</div></div>";
}

// ---- PDF (print-to-PDF) report: Tamil text is shaped by the browser itself, so it always prints correctly ----
const fmtDate = () => new Date().toLocaleDateString("en-GB");
const dmy = (d) => d.slice(8, 10) + "-" + d.slice(5, 7) + "-" + d.slice(0, 4);
// numFrom: columns from this index on are numbers (right-aligned)
const tbl = (head, rows, foot, numFrom = 1) => {
  const c = (i) => (i >= numFrom ? ' class="pr-n"' : "");
  return (
    '<table class="pr-t"><thead><tr>' + head.map((h, i) => "<th" + c(i) + ">" + esc(h) + "</th>").join("") + "</tr></thead><tbody>" +
    rows.map((r) => "<tr>" + r.map((x, i) => "<td" + c(i) + ">" + esc(x) + "</td>").join("") + "</tr>").join("") +
    (foot ? '<tr class="pr-f">' + foot.map((x, i) => "<td" + c(i) + ">" + esc(x) + "</td>").join("") + "</tr>" : "") + "</tbody></table>"
  );
};

// rows: [date, name, place, service, points] for the year (from the Sheet)
export function buildReport(person, rows) {
  const mine = person ? rows.filter((r) => r[1] === person) : rows;
  const sumP = (rs) => rs.reduce((a, r) => a + r[4], 0);
  let html =
    '<div class="pr-h"><b>MELERI MVKM TRUST</b><br>' + esc(t("சேவை விவரம்", "Service Record")) + " — " + esc(person || t("அனைவரும்", "Everyone")) + " — " + esc(data.year) +
    "<br><small>" + esc(t("தயாரிக்கப்பட்ட தேதி", "Prepared on")) + ": " + fmtDate() + "</small></div>";
  if (!mine.length) return html + "<p>" + esc(t("இன்னும் பதிவு இல்லை", "No entries yet")) + "</p>";
  const SH = [t("சேவை", "Service"), t("எண்ணிக்கை", "Count"), t("புள்ளிகள்", "Points")];
  const DH = [t("தேதி", "Date"), t("இடம்", "Place"), t("சேவைகள்", "Services"), t("புள்ளிகள்", "Points")];
  const bySvc = (rs) => {
    const m = {};
    rs.forEach((r) => {
      const e = (m[r[3]] = m[r[3]] || [r[3], 0, 0]);
      e[1]++;
      e[2] += r[4];
    });
    return Object.values(m).sort((x, y) => y[2] - x[2]).map((e) => [e[0], String(e[1]), String(e[2])]);
  };
  // one line per visit (same date + same place), services joined together
  const visits = (rs) => {
    const m = new Map();
    rs.forEach((r) => {
      const k = r[0] + "|" + r[2];
      const e = m.get(k) || [dmy(r[0]), r[2], [], 0];
      e[2].push(r[3]);
      e[3] += r[4];
      m.set(k, e);
    });
    return [...m.values()].map((e) => [e[0], e[1], e[2].join(", "), String(e[3])]);
  };
  const dateTable = (rs) => tbl(DH, visits(rs), [t("மொத்தம்", "Total"), "", String(rs.length) + " " + t("சேவைகள்", "services"), String(sumP(rs))], 3);
  if (person) {
    html += "<h3>" + esc(t("சேவை வாரியாகச் சுருக்கம்", "Summary by service")) + "</h3>" + tbl(SH, bySvc(mine), [t("மொத்தம்", "Total"), String(mine.length), String(sumP(mine))]);
    html += '<div class="pr-c"><h3>' + esc(t("🥧 சேவை வாரியாக (புள்ளிகள்)", "🥧 By service (points)")) + "</h3>" + donut(bySvc(mine).map((e) => [e[0], Number(e[2])])) + "</div>";
    html += "<h3>" + esc(t("தேதி, இடம் வாரியாக விவரம்", "Details by date and place")) + "</h3>" + dateTable(mine);
  } else {
    const names = [...new Set(mine.map((r) => r[1]))].sort((x, y) => x.localeCompare(y, "ta"));
    html += "<h3>" + esc(t("நபர் வாரியாகச் சுருக்கம்", "Summary by person")) + "</h3>" +
      tbl([t("பெயர்", "Name"), t("சேவைகள்", "Services"), t("புள்ளிகள்", "Points")], names.map((n, i) => {
        const rs = mine.filter((r) => r[1] === n);
        return [i + 1 + ".  " + n, String(rs.length), String(sumP(rs))];
      }), [t("மொத்தம்", "Total"), String(mine.length), String(sumP(mine))]);
    const perP = names.map((n) => [n, sumP(mine.filter((r) => r[1] === n))]);
    html += '<div class="pr-c"><h3>' + esc(t("📊 நபர் வாரியாக (புள்ளிகள்)", "📊 By person (points)")) + "</h3>" + bars(perP, (n) => "c" + (n % 8)) + "</div>";
    html += "<h3>" + esc(t("சேவை வாரியாக (அனைவரும்)", "By service (everyone)")) + "</h3>" + tbl(SH, bySvc(mine), null);
    html += '<div class="pr-c"><h3>' + esc(t("🥧 சேவை வாரியாக (புள்ளிகள்)", "🥧 By service (points)")) + "</h3>" + donut(bySvc(mine).map((e) => [e[0], Number(e[2])])) + "</div>";
    html += "<h3>" + esc(t("ஒவ்வொருவரின் தேதி, இடம் வாரியான விவரம்", "Each person: details by date and place")) + "</h3>";
    names.forEach((n) => {
      html += '<div class="pr-b"><h4>' + esc(n) + "</h4>" + dateTable(mine.filter((r) => r[1] === n)) + "</div>";
    });
  }
  return html + '<p class="pr-k">' + esc(t("பணத்திற்காக அல்ல, தொண்டாகச் செய்த சேவை 🙏 வாழ்க வளமுடன்!", "Service offered selflessly, not for money 🙏 Vazhga Valamudan!")) + "</p>";
}

let detail = null; // { year, at, rows }
let pdfBusy = false;
const hasActivation = () => !(navigator.userActivation && navigator.userActivation.isActive === false);

function printNow(person) {
  let box = document.getElementById("svPrint");
  if (!box) {
    box = document.createElement("div");
    box.id = "svPrint";
    document.body.appendChild(box);
  }
  box.innerHTML = buildReport(person, detail.rows);
  box.querySelectorAll(".bf").forEach((el) => (el.style.width = el.dataset.w + "%"));
  const old = document.title;
  document.title = "MELERI-Service-" + (person ? person.replace(/[^\p{L}\p{N}]+/gu, "-") : "All") + "-" + data.year; // becomes the PDF file name
  const done = () => {
    document.title = old;
    box.innerHTML = "";
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  try {
    window.print();
  } catch (e) {
    done();
    showToast(t("PDF திறக்க முடியவில்லை", "Could not open the PDF dialog"));
  }
}

async function printReport(person) {
  if (!data || pdfBusy) return;
  if (detail && detail.year === data.year && Date.now() - detail.at < 60000) return printNow(person); // data ready: print inside the tap
  pdfBusy = true;
  showToast(t("PDF தயாராகிறது…", "Preparing the PDF…"));
  let r = await api.seva.detail(data.year);
  if (!r.ok) {
    await wait(1200);
    r = await api.seva.detail(data.year);
  }
  pdfBusy = false;
  if (!r.ok) return showToast(t("விவரம் load ஆகவில்லை. மீண்டும் தொடவும்.", "Could not load the details. Please tap again."));
  detail = { year: data.year, at: Date.now(), rows: r.data.rows };
  if (hasActivation()) printNow(person);
  else showToast(t("PDF தயார் ✅ மீண்டும் ஒருமுறை தொடவும்", "PDF is ready ✅ tap the button once more"));
}

function summaryHtml() {
  const agg = data.agg;
  const mine = sel ? agg.filter((a) => a[0] === sel) : agg;
  const sum = (rows, k) => rows.reduce((a, r) => a + r[k], 0);
  const bySvc = {};
  mine.forEach((a) => {
    const e = (bySvc[a[2]] = bySvc[a[2]] || [a[2], 0, 0]);
    e[1] += a[4];
    e[2] += a[3];
  });
  const svcRows = Object.values(bySvc).sort((a, b) => b[1] - a[1]);
  const byT = {};
  agg.forEach((a) => (byT[a[0]] = (byT[a[0]] || 0) + a[4]));
  const teachers = Object.entries(byT).sort((a, b) => a[0].localeCompare(b[0], "ta"));
  return (
    '<label>' + esc(t("நபர்", "Person")) + '<select id="svSel" class="sv-sel">' + opts(data.names, sel, t("அனைவரும்", "Everyone")) + "</select></label>" +
    '<div class="sv-pdf"><button id="svPdfAll" type="button">📄 ' + esc(t("அனைவரின் PDF", "Everyone's PDF")) + "</button>" + (sel ? '<button id="svPdfOne" type="button">📄 ' + esc(sel) + " — PDF</button>" : "") + "</div>" +
    '<div class="sv-total">' + esc(sel || t("அனைவரும்", "Everyone")) + " — " + sum(mine, 3) + " " + esc(t("சேவைகள்", "services")) + " · " + sum(mine, 4) + " " + esc(t("புள்ளிகள்", "points")) + "</div>" +
    '<div class="sv-list">' + (svcRows.map((r) => "<div><span>" + esc(r[0]) + "</span><b>" + r[2] + " × = " + r[1] + "</b></div>").join("") || "<small>" + esc(t("இன்னும் பதிவு இல்லை", "No entries yet")) + "</small>") + "</div>" +
    '<div class="section-title"><h2>' + esc(t("🥧 சேவை வாரியாக", "🥧 By service")) + "</h2></div>" + donut(svcRows) +
    '<div class="section-title"><h2>' + esc(t("📊 நபர் வாரியாக (புள்ளிகள்)", "📊 By person (points)")) + "</h2></div>" + (bars(teachers, (n) => "c" + (n % 8)) || "")
  );
}

// force = true after the member's own action (save, picking a person/year, retry/edit): always redraw.
// Background refreshes (force = false) redraw only the parts whose data really changed, and never a part the
// member is touching right now (an open dropdown / focused field) - so nothing closes or jumps while choosing.
const busy = (el) => !!(el && document.activeElement && el.contains(document.activeElement));
export function renderSeva(force) {
  if (!$("#svForm")) return;
  if (!data) {
    $("#svHero").innerHTML = "";
    $("#svYearWrap").innerHTML = "";
    $("#svForm").innerHTML = loading
      ? '<div class="checking"><span class="spinner"></span><span>' + esc(t("ஏற்றுகிறது…", "Loading…")) + "</span></div>"
      : failed ? '<small>' + esc(t("தரவு load ஆகவில்லை", "Data failed to load")) + '</small><button id="svRetry" class="unlock" type="button">🔄 ' + esc(t("மீண்டும் முயற்சி", "Try again")) + "</button>" : "";
    $("#svSummary").innerHTML = "";
    formSig = "";
    sumSig = "";
    yearSig = "";
    return;
  }
  const all = data.agg;
  $("#svHero").innerHTML = "<b>" + all.reduce((a, r) => a + r[3], 0) + " 🌿</b><small>" + esc(t("இந்த ஆண்டு (" + data.year + ") நம் குழு செய்த மொத்த சேவைகள்", "Services our team offered in " + data.year)) + " · " + all.reduce((a, r) => a + r[4], 0) + " " + esc(t("புள்ளிகள்", "points")) + "</small>";

  const lang = t("ta", "en");
  const fSig = JSON.stringify([lang, data.names, data.places, data.services, readQ().length, readF().length]);
  if (force || !formSig || (fSig !== formSig && !busy($("#svForm")))) {
    $("#svForm").innerHTML = formHtml();
    formSig = fSig;
  }

  const ySig = JSON.stringify([data.year, data.years]);
  if (ySig !== yearSig) {
    $("#svYearWrap").innerHTML = '<select id="svYear" class="sv-sel">' + (data.years.includes(data.year) ? data.years : [data.year, ...data.years]).map((y) => '<option value="' + y + '"' + (y === data.year ? " selected" : "") + ">" + y + "</option>").join("") + "</select>";
    yearSig = ySig;
  }

  const sSig = JSON.stringify([lang, sel, data.year, data.agg, data.names]);
  if (force || !sumSig || (sSig !== sumSig && !busy($("#svSummary")))) {
    $("#svSummary").innerHTML = summaryHtml();
    sumSig = sSig;
    requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll("#svSummary .bf").forEach((el) => (el.style.width = el.dataset.w + "%"))));
  }
}

// Sends queued entries one by one. Same rid every time => the Sheet saves each entry exactly once.
export async function flushSeva() {
  if (flushing || !readQ().length) return;
  flushing = true;
  let retry = false;
  let signedOut = false;
  try {
    for (let guard = 0; guard < 50; guard++) {
      const item = readQ()[0];
      if (!item) break;
      const r = await api.seva.add(item);
      if (r.ok) writeQ(readQ().filter((x) => x.rid !== item.rid));
      else if (r.status === 401) {
        signedOut = true; // entries stay in the queue and go out after the next login
        break;
      } else if (r.status === 0 || r.status === 429 || r.status >= 500) {
        retry = true; // no network / Sheet slow: try again shortly with the same number
        break;
      } else {
        // refused for good (e.g. wrong date): move it to the "could not be saved" box instead of deleting it
        const why = (r.data && r.data.error) || t("சேமிக்க முடியவில்லை", "Could not save");
        writeF([...readF(), { ...item, why }]);
        writeQ(readQ().filter((x) => x.rid !== item.rid));
        showToast(why + " — " + t("பதிவு பாதுகாக்கப்பட்டுள்ளது (கீழே திருத்தலாம்)", "entry kept safe (fix it below)"));
      }
    }
  } finally {
    flushing = false;
  }
  clearTimeout(retryTimer);
  if (retry) retryTimer = setTimeout(flushSeva, 8000);
  else if (!signedOut && readQ().length) return flushSeva(); // something was added while we were sending
  else if (!signedOut) {
    detail = null;
    setTimeout(() => loadSeva(true, true), 600); // confirm the totals with the Sheet quietly (fresh: skips the 30 s server copy)
  }
  renderSeva();
}

function save() {
  const now = Date.now();
  if (now - lastTap < 800) return; // double tap
  if (!f.name || !f.place || !f.ids.length) return showToast(t("பெயர், இடம், சேவை மூன்றையும் தேர்ந்தெடுக்கவும்", "Please select name, place and service"));
  lastTap = now;
  const date = f.date || today();
  const picked = data.services.filter((s) => f.ids.includes(s.id));
  const pts = picked.reduce((a, s) => a + s.points, 0);
  const q = readQ();
  q.push({ date, name: f.name, place: f.place, ids: [...f.ids], rid: newRid() }); // saved on this phone first: nothing can be lost
  writeQ(q);
  // Show the new totals immediately.
  if (data.year === date.slice(0, 4)) {
    picked.forEach((s) => {
      let row = data.agg.find((a) => a[0] === f.name && a[1] === s.id);
      if (!row) data.agg.push((row = [f.name, s.id, s.name, 0, 0]));
      row[3] += 1;
      row[4] += s.points;
    });
    writeCache(data);
  }
  f.ids = [];
  detail = null; // the PDF must include this new entry
  const m = THANKS[Math.floor(Math.random() * THANKS.length)];
  showToast(t(m[0], m[1]) + " (+" + pts + ")");
  renderSeva(true);
  flushSeva();
}

// buttons of the "could not be saved" box: retry as it is / load back into the form to fix / delete
function failedAction(btn) {
  const rid = btn.dataset.fretry || btn.dataset.fedit || btn.dataset.fdel;
  const list = readF();
  const item = list.find((x) => x.rid === rid);
  if (!item) return;
  writeF(list.filter((x) => x.rid !== rid));
  if (btn.dataset.fretry) {
    writeQ([...readQ(), { date: item.date, name: item.name, place: item.place, ids: item.ids, rid: item.rid }]);
    renderSeva(true);
    flushSeva();
  } else if (btn.dataset.fedit) {
    f = { date: item.date, name: item.name, place: item.place, ids: [...item.ids] };
    renderSeva(true);
    const form = $("#svForm");
    if (form && form.scrollIntoView) form.scrollIntoView({ block: "start" });
  } else renderSeva(true);
}

export function initSeva() {
  const page = $("#seva");
  if (!page) return;
  window.addEventListener("online", () => flushSeva());
  page.addEventListener("input", (e) => {
    const el = e.target;
    if (el.id === "svDate") f.date = el.value;
    else if (el.id === "svName") f.name = el.value;
    else if (el.id === "svPlace") f.place = el.value;
    else if (el.dataset && el.dataset.sid) {
      f.ids = el.checked ? [...f.ids, el.dataset.sid] : f.ids.filter((x) => x !== el.dataset.sid);
      const pts = data.services.filter((s) => f.ids.includes(s.id)).reduce((a, s) => a + s.points, 0);
      const out = $("#svPts");
      if (out) out.textContent = t("இந்தப் பதிவின் புள்ளிகள்", "Points for this entry") + ": " + pts;
    }
  });
  page.addEventListener("change", (e) => {
    if (e.target.id === "svSel") {
      sel = e.target.value;
      renderSeva(true);
    } else if (e.target.id === "svYear") {
      year = e.target.value;
      const c = readCache(year);
      if (c) {
        data = c;
        renderSeva(true);
      }
      loadSeva(true);
    }
  });
  page.addEventListener("click", (e) => {
    const fb = e.target.closest("[data-fretry],[data-fedit],[data-fdel]");
    if (fb) return failedAction(fb);
    if (e.target.closest("#svSave")) save();
    else if (e.target.closest("#svRetry")) loadSeva();
    else if (e.target.closest("#svPdfAll")) printReport("");
    else if (e.target.closest("#svPdfOne")) printReport(sel);
  });
}
