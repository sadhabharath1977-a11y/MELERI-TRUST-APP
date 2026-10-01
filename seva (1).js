// Masters' service record: entry form, per-teacher / all-teachers summary, bar + donut charts.
// Charts are plain HTML/SVG (the page CSP allows no inline styles or external scripts); widths are set from JS.
import { $, escapeHtml as esc, showToast } from "./util.js";
import { t } from "./i18n.js";
import { api } from "./api.js";

const today = () => new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const THANKS = [
  ["தங்கள் தொண்டுக்கு நன்றி 🙏", "Thank you for your selfless service 🙏"],
  ["சேவை மலர்ந்தது 🌸 வாழ்க வளமுடன்!", "Your service has blossomed 🌸 Vazhga Valamudan!"],
  ["குருவின் அருள் தங்களுடன் 🪔", "The Guru's grace is with you 🪔"]
];
let data = null;
let year = "";
let sel = "";
let busy = false;
let inflight = null;
let f = { date: "", name: "", place: "", ids: [] };

export function clearSeva() {
  data = null;
  year = "";
  sel = "";
  f = { date: "", name: "", place: "", ids: [] };
}

export function loadSeva() {
  if (inflight) return inflight;
  inflight = api.seva.data(year).then((r) => {
    inflight = null;
    if (r.ok) {
      data = r.data;
      year = data.year;
      renderSeva();
    } else if (!data) $("#svSummary").innerHTML = "<small>" + esc(t("தரவு load ஆகவில்லை", "Data failed to load")) + "</small>";
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
    '<div class="sv-total">' + esc(t("இந்தப் பதிவின் புள்ளிகள்", "Points for this entry")) + ": " + pts + "</div>" +
    '<button id="svSave" class="unlock" type="button"' + (busy ? " disabled" : "") + ">💾 " + esc(t("சேமி", "Save")) + "</button>"
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
  const leg = items.map((i, n) => "<div><i class=\"c" + (n % 8) + '"></i>' + esc(i[0]) + " · " + Math.round((i[1] / total) * 100) + "%</div>").join("");
  return '<div class="sv-donut"><svg viewBox="0 0 42 42" role="img">' + arcs + '</svg><div class="sv-leg">' + leg + "</div></div>";
}

function summaryHtml() {
  const agg = data.agg;
  const mine = sel ? agg.filter((a) => a[0] === sel) : agg;
  const sum = (rows, k) => rows.reduce((a, r) => a + r[k], 0);
  const bySvc = {};
  mine.forEach((a) => (bySvc[a[2]] = bySvc[a[2]] || [a[2], 0, 0]) && ((bySvc[a[2]][1] += a[4]), (bySvc[a[2]][2] += a[3])));
  const svcRows = Object.values(bySvc).sort((a, b) => b[1] - a[1]);
  const byT = {};
  agg.forEach((a) => (byT[a[0]] = (byT[a[0]] || 0) + a[4]));
  const teachers = Object.entries(byT).sort((a, b) => a[0].localeCompare(b[0], "ta"));
  return (
    '<label>' + esc(t("ஆசிரியர்", "Master")) + '<select id="svSel" class="sv-sel">' + opts(data.names, sel, t("அனைத்து ஆசிரியர்களும்", "All masters")) + "</select></label>" +
    '<div class="sv-total">' + esc(sel || t("அனைவரும்", "Everyone")) + " — " + sum(mine, 3) + " " + esc(t("சேவைகள்", "services")) + " · " + sum(mine, 4) + " " + esc(t("புள்ளிகள்", "points")) + "</div>" +
    '<div class="sv-list">' + (svcRows.map((r) => "<div><span>" + esc(r[0]) + "</span><b>" + r[2] + " × = " + r[1] + "</b></div>").join("") || "<small>" + esc(t("இன்னும் பதிவு இல்லை", "No entries yet")) + "</small>") + "</div>" +
    '<div class="section-title"><h2>' + esc(t("🥧 சேவை வாரியாக", "🥧 By service")) + "</h2></div>" + donut(svcRows) +
    '<div class="section-title"><h2>' + esc(t("📊 ஆசிரியர் வாரியாக (புள்ளிகள்)", "📊 By master (points)")) + "</h2></div>" + (bars(teachers, (n) => "c" + (n % 8)) || "")
  );
}

export function renderSeva() {
  if (!data || !$("#svForm")) return;
  const all = data.agg;
  $("#svHero").innerHTML = "<b>" + all.reduce((a, r) => a + r[3], 0) + " 🌿</b><small>" + esc(t("இந்த ஆண்டு (" + data.year + ") நம் குழு செய்த மொத்த சேவைகள்", "Services our team offered in " + data.year)) + " · " + all.reduce((a, r) => a + r[4], 0) + " " + esc(t("புள்ளிகள்", "points")) + "</small>";
  $("#svForm").innerHTML = formHtml();
  $("#svYearWrap").innerHTML = '<select id="svYear" class="sv-sel">' + (data.years.includes(data.year) ? data.years : [data.year, ...data.years]).map((y) => '<option value="' + y + '"' + (y === data.year ? " selected" : "") + ">" + y + "</option>").join("") + "</select>";
  $("#svSummary").innerHTML = summaryHtml();
  requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll("#svSummary .bf").forEach((el) => (el.style.width = el.dataset.w + "%"))));
}

async function save() {
  if (busy) return;
  if (!f.name || !f.place || !f.ids.length) return showToast(t("பெயர், இடம், சேவை மூன்றையும் தேர்ந்தெடுக்கவும்", "Please select name, place and service"));
  busy = true;
  renderSeva();
  const r = await api.seva.add({ date: f.date || today(), name: f.name, place: f.place, ids: f.ids });
  busy = false;
  if (r.ok) {
    f.ids = [];
    const m = THANKS[Math.floor(Math.random() * THANKS.length)];
    showToast(t(m[0], m[1]) + " (+" + r.data.points + ")");
    data = null;
    await loadSeva();
  } else {
    renderSeva();
    showToast(r.status === 0 ? t("இணைய இணைப்பு தோல்வி", "Network error") : r.data.error || t("சேமிக்க முடியவில்லை", "Could not save"));
  }
}

export function initSeva() {
  const page = $("#seva");
  if (!page) return;
  page.addEventListener("input", (e) => {
    const el = e.target;
    if (el.id === "svDate") f.date = el.value;
    else if (el.id === "svName") f.name = el.value;
    else if (el.id === "svPlace") f.place = el.value;
    else if (el.dataset && el.dataset.sid) {
      f.ids = el.checked ? [...f.ids, el.dataset.sid] : f.ids.filter((x) => x !== el.dataset.sid);
      renderSeva();
    }
  });
  page.addEventListener("change", (e) => {
    if (e.target.id === "svSel") {
      sel = e.target.value;
      renderSeva();
    } else if (e.target.id === "svYear") {
      year = e.target.value;
      loadSeva();
    }
  });
  page.addEventListener("click", (e) => {
    if (e.target.closest("#svSave")) save();
  });
}
