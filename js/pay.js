// "Pay & Send Details" page: for each row of the Sheet tab -> send details by e-mail / pay by UPI / copy the UPI ID.
import { $, escapeHtml as esc, showToast } from "./util.js";
import { t } from "./i18n.js";
import { api } from "./api.js";

let items = null; // null = not loaded yet
let loading = false;
let failed = false;
let at = 0;

const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
const PHONE_RE = /^91\d{10}$/;
const UPI_RE = /^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9.-]{1,40}$/;

export function clearPay() {
  items = null;
  failed = false;
  at = 0;
}

export async function loadPay(quiet) {
  if (loading) return;
  if (items && Date.now() - at < 60000) return;
  loading = true;
  if (!quiet) renderPay();
  const r = await api.pay();
  loading = false;
  if (r.ok && r.data && Array.isArray(r.data.items)) {
    items = r.data.items;
    failed = false;
    at = Date.now();
  } else {
    failed = true;
  }
  renderPay();
}

function card(i) {
  const email = EMAIL_RE.test(i.email || "") ? i.email : "";
  const upi = UPI_RE.test(i.upi || "") ? i.upi : "";
  const phone = PHONE_RE.test(i.phone || "") ? i.phone : "";
  // UPI deep link: the Tamil title is not sent as the payee name (some UPI apps reject non-English names).
  const pn = /^[\x20-\x7E]+$/.test(i.title) ? "&pn=" + encodeURIComponent(i.title) : "";
  let h = '<div class="pay-card"><b>' + esc(i.title) + "</b>";
  if (email) h += '<div class="pay-id">✉ ' + esc(email) + "</div>";
  if (upi) h += '<div class="pay-id">₹ ' + esc(upi) + "</div>";
  if (phone) h += '<div class="pay-id">📞 ' + esc(phone.slice(2, 7) + " " + phone.slice(7)) + "</div>";
  h += '<div class="pay-btns">';
  if (email) h += '<a class="pay-btn" href="mailto:' + esc(email) + "?subject=" + esc(encodeURIComponent(i.title)) + '">✉ ' + esc(t("விவரம் அனுப்பு", "Send details")) + "</a>";
  if (upi) {
    h += '<a class="pay-btn upi" href="upi://pay?pa=' + esc(upi) + pn + '&cu=INR">₹ ' + esc(t("UPI செலுத்து", "Pay by UPI")) + "</a>";
    h += '<button class="pay-btn copy" type="button" data-copy="' + esc(upi) + '" aria-label="' + esc(t("UPI ID நகலெடு", "Copy UPI ID")) + '">⧉ ' + esc(t("நகலெடு", "Copy")) + "</button>";
  }
  // Call and WhatsApp sit on the right of "Copy" (both use the number in column E)
  if (phone) {
    h += '<a class="pay-btn copy" href="tel:+' + esc(phone) + '">📞 ' + esc(t("அழை", "Call")) + "</a>";
    h += '<a class="pay-btn copy wa" href="https://wa.me/' + esc(phone) + '" target="_blank" rel="noopener">💬 WhatsApp</a>';
  }
  return h + "</div></div>";
}

export function renderPay() {
  const box = $("#payList");
  if (!box) return;
  if (!items) {
    box.innerHTML = failed
      ? '<div class="row"><div class="ico">⚠️</div><div><b>' + esc(t("தற்போது ஏற்ற முடியவில்லை", "Could not load right now")) + "</b><small>" +
        esc(t("சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.", "Please try again in a moment.")) + '</small></div><button class="pay-btn copy" type="button" data-pay-retry>' + esc(t("மீண்டும்", "Retry")) + "</button></div>"
      : '<div class="row skeleton" style="min-height:76px"></div><div class="row skeleton" style="min-height:76px"></div><div class="row skeleton" style="min-height:76px"></div>';
    return;
  }
  box.innerHTML = items.length
    ? items.map(card).join("")
    : '<div class="row"><div class="ico">ℹ️</div><div><b>' + esc(t("இன்னும் பதிவுகள் இல்லை", "No entries yet")) + "</b></div></div>";
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(t("UPI ID நகலெடுக்கப்பட்டது", "UPI ID copied"));
  } catch (e) {
    showToast(text); // clipboard blocked: at least show the ID so it can be copied by hand
  }
}

export function initPay() {
  document.addEventListener("click", (e) => {
    const c = e.target.closest("[data-copy]");
    if (c) {
      e.preventDefault();
      copyText(c.dataset.copy);
      return;
    }
    if (e.target.closest("[data-pay-retry]")) {
      e.preventDefault();
      failed = false;
      loadPay();
    }
  });
}
