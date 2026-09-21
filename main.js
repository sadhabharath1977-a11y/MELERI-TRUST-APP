// App entry point: navigation, start-up sequence, dashboard link, service worker.
import { $, showToast } from "./util.js";
import { t, initLang, onLangChange, curLang } from "./i18n.js";
import { api, setUnauthorizedHandler } from "./api.js";
import { initAuth, showChecking, showLogin, showRetry, hideLock } from "./auth.js";
import { renderSite, renderTrustees, renderUserChip, renderAdminPanel, closeDropdown } from "./views.js";
import { loadStats, renderStats, clearStats, dashboardOpen } from "./stats.js";

let state = null; // what the server returned after login: { email, isAdmin, trustees, site }

// ---------- navigation (Back button works; no full reloads) ----------
const PAGES = ["home", "trustees", "accounts", "service", "contacts", "more"];
function showPage(id, animate) {
  if (!PAGES.includes(id)) id = "home";
  document.querySelectorAll(".page").forEach((p) => {
    const active = p.id === id;
    p.classList.toggle("active", active);
    if (active) {
      p.scrollTop = 0;
      if (animate) {
        p.classList.remove("page-enter");
        void p.offsetWidth;
        p.classList.add("page-enter");
      }
    }
  });
  document.querySelectorAll(".nav").forEach((n) => {
    const on = n.dataset.page === id;
    n.classList.toggle("active", on);
    if (on) n.setAttribute("aria-current", "page");
    else n.removeAttribute("aria-current");
  });
  if (id === "service" && state) loadStats();
}
function go(id) {
  if (location.hash !== "#" + id) history.pushState(null, "", "#" + id);
  showPage(id, true);
}
function initNav() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-page]");
    if (!el) return;
    e.preventDefault();
    go(el.dataset.page);
  });
  window.addEventListener("popstate", () => showPage(location.hash.slice(1), true));
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  showPage(location.hash.slice(1), false);
}

// ---------- trustees search ----------
function applySearch() {
  const input = $("#memberSearch");
  const q = input ? input.value.trim().toLowerCase() : "";
  document.querySelectorAll("#memberGrid .profile").forEach((c) => (c.style.display = c.textContent.toLowerCase().includes(q) ? "" : "none"));
}

// ---------- dashboard link: honours the ON/OFF switch in the sheet, opens the Sheets app on Android ----------
function initDashboardLinks() {
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-dash]");
    if (!link) return;
    e.preventDefault();
    loadStats(); // refresh the switch in the background for next time
    if (!dashboardOpen()) {
      showToast(curLang() === "en" ? "Accounts are being updated right now. Please try again shortly." : "தற்போது கணக்கு Update ஆகிறது. சிறிது நேரம் கழித்து முயற்சிக்கவும்.");
      return;
    }
    const url = state && state.site.dashboardUrl ? state.site.dashboardUrl : link.href;
    if (/Android/i.test(navigator.userAgent)) {
      // Opens the installed Google Sheets app directly. (Android only - iPhone/PC get the normal link.)
      const path = url.replace(/^https:\/\//, "").split("#")[0];
      location.href = "intent://" + path + "#Intent;scheme=https;package=com.google.android.apps.docs.editors.sheets;S.browser_fallback_url=" + encodeURIComponent(url) + ";end";
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  });
}

// ---------- after login ----------
function renderAll() {
  if (!state) return;
  renderSite(state.site);
  renderTrustees(state.trustees);
  applySearch();
  renderUserChip(state, logout);
  if (state.isAdmin && !$("#adminPanel").classList.contains("hidden")) renderAdminPanel(state);
  renderStats();
}

function onAuthed(data) {
  state = data;
  hideLock();
  renderAll();
  if (state.isAdmin) renderAdminPanel(state);
  showPage(location.hash.slice(1), false);
  // Warm the stats cache when the phone is idle, so the Service page and Dashboard switch are instant.
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 1500)))(() => loadStats());
}

async function logout() {
  await api.logout();
  clearStats();
  try {
    if (window.google && window.google.accounts) window.google.accounts.id.disableAutoSelect();
  } catch (e) {}
  location.reload();
}

function sessionEnded() {
  if (!state) return;
  state = null;
  clearStats();
  closeDropdown();
  showLogin(t("உள்நுழைவு காலாவதியாகிவிட்டது. மீண்டும் உள்நுழையவும்.", "Your session has ended. Please sign in again."));
}

async function boot() {
  showChecking();
  const r = await api.session();
  if (r.ok && r.data.authenticated) return onAuthed(r.data);
  if (r.status === 401) return showLogin();
  if (r.data && r.data.error === "config") return showRetry(t("சேவையக அமைப்பு முழுமையடையவில்லை (ADMIN_EMAIL). SETUP-TA.txt-ஐ பார்க்கவும்.", "Server is not fully configured (ADMIN_EMAIL). See SETUP-TA.txt."), boot);
  showRetry(r.status === 0 ? t("இணைய இணைப்பு இல்லை. இணைப்பை சரிபார்த்து மீண்டும் முயற்சிக்கவும்.", "No connection. Check your internet and try again.") : t("சேவையகப் பிரச்சனை. சிறிது நேரம் கழித்து முயற்சிக்கவும்.", "Server problem. Please try again shortly."), boot);
}

// ---------- service worker (no forced reload on the very first visit) ----------
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

// ---------- start ----------
initAuth(onAuthed);
setUnauthorizedHandler(sessionEnded);
initLang();
onLangChange(renderAll);
initNav();
initDashboardLinks();
const search = $("#memberSearch");
if (search) search.addEventListener("input", applySearch);
boot();
if (document.readyState === "complete") registerServiceWorker();
else window.addEventListener("load", registerServiceWorker);
