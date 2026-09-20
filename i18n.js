// Tamil / English switching. Static text uses data-en="..." attributes in index.html;
// text created by JavaScript uses t(ta, en) / pick({ta, en}) and is re-rendered on change.
import { $ } from "./util.js";

export function curLang() {
  try {
    return localStorage.getItem("meleri_lang") || "ta";
  } catch (e) {
    return "ta";
  }
}
export const t = (ta, en) => (curLang() === "en" ? en : ta);
export const pick = (item) => (curLang() === "en" ? item.en || item.ta : item.ta || item.en);

const listeners = [];
export const onLangChange = (fn) => listeners.push(fn);

export function applyLang(lang) {
  try {
    localStorage.setItem("meleri_lang", lang);
  } catch (e) {}
  document.querySelectorAll("[data-en]").forEach((el) => {
    if (!el.dataset.ta) el.dataset.ta = el.textContent; // remember the original Tamil text
    el.textContent = lang === "en" ? el.dataset.en : el.dataset.ta;
  });
  document.querySelectorAll("[data-en-ph]").forEach((el) => {
    if (!el.dataset.taPh) el.dataset.taPh = el.placeholder;
    el.placeholder = lang === "en" ? el.dataset.enPh : el.dataset.taPh;
  });
  const btn = $("#langToggle");
  if (btn) btn.textContent = lang === "en" ? "தமிழ்" : "EN";
  document.documentElement.lang = lang;
  listeners.forEach((fn) => fn(lang));
}

export function initLang() {
  applyLang(curLang());
  const btn = $("#langToggle");
  if (btn) btn.onclick = () => applyLang(curLang() === "ta" ? "en" : "ta");
}
