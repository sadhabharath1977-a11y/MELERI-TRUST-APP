// Service statistics. The server fetches, parses and caches the Google Sheet; the browser keeps its
// own copy and shows it instantly (stale-while-revalidate), refreshing in the background.
import { $, escapeHtml as esc } from "./util.js";
import { t } from "./i18n.js";
import { api } from "./api.js";

const KEY = "meleri_stats_v1";
const FRESH_MS = 30 * 1000;
const ICONS = [["தீட்சை", "⭐"], ["பிரம்மஞான", "🧘"], ["அருள்நிதி", "💚"], ["பேராசிரியர்", "🎓"], ["டிப்ளமோ", "📘"]];
const iconFor = (label) => (ICONS.find(([k]) => label.includes(k)) || [0, "✨"])[1];

let data = null;
let fetchedAt = 0;
let inflight = null;

function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    if (c && c.data) {
      data = c.data;
      fetchedAt = c.at;
    }
  } catch (e) {}
}
function saveCache() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ at: fetchedAt, data }));
  } catch (e) {}
}
// Called on logout / session end so the next person on a shared phone never sees old figures.
export function clearStats() {
  data = null;
  fetchedAt = 0;
  try {
    localStorage.removeItem(KEY);
  } catch (e) {}
}

// false only when the sheet's switch says the accounts are being updated.
export const dashboardOpen = () => !data || data.open !== false;

function cards(labels, values) {
  if (!values || !labels.length) return "<div class='stat-card'><small>" + esc(t("தரவு கிடைக்கவில்லை", "No data available")) + "</small></div>";
  return labels.map((l, i) => '<div class="stat-card"><div class="ico">' + iconFor(l) + "</div><div><b>" + esc(values[i]) + "</b><small>" + esc(l) + "</small></div></div>").join("");
}

export function renderStats() {
  const total = $("#svcTotal");
  const year = $("#svcYear");
  if (!total || !year || !data) return;
  total.innerHTML = cards(data.labels, data.total);
  year.innerHTML = cards(data.labels, data.year);
}

function renderError() {
  const msg = "<div class='stat-card'><small>" + esc(t("தரவு load ஆகவில்லை", "Data failed to load")) + "</small></div>";
  if ($("#svcTotal")) $("#svcTotal").innerHTML = msg;
  if ($("#svcYear")) $("#svcYear").innerHTML = msg;
}

export function loadStats() {
  if (!data) readCache();
  if (data) renderStats();
  if (data && Date.now() - fetchedAt < FRESH_MS) return Promise.resolve();
  if (!inflight) {
    inflight = api
      .stats()
      .then((r) => {
        if (r.ok) {
          data = r.data;
          fetchedAt = Date.now();
          saveCache();
          renderStats();
        } else if (!data) renderError();
      })
      .finally(() => (inflight = null));
  }
  return inflight;
}
