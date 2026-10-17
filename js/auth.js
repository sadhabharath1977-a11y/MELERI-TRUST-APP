// Login screen + Google Sign-In. The Google script is loaded ONLY when a login is actually needed
// (people with a valid session never download it).
import { $ } from "./util.js";
import { t } from "./i18n.js";
import { api } from "./api.js";

const CLIENT_ID = (document.querySelector('meta[name="google-client-id"]') || {}).content || "";
let onAuthed = () => {};
let gsiLoading = null;
let gsiInitialised = false;

export const initAuth = (callback) => (onAuthed = callback);
const setError = (message) => ($("#err").textContent = message || "");
const show = (sel, on) => $(sel).classList.toggle("hidden", !on);

export function showChecking() {
  show("#lock", true);
  show("#lockChecking", true);
  show("#gsiBtn", false);
  show("#retryBtn", false);
  setError("");
}
export function hideLock() {
  show("#lock", false);
  window.scrollTo(0, 0);
}

export function showRetry(message, retry) {
  show("#lock", true);
  show("#lockChecking", false);
  show("#gsiBtn", false);
  show("#retryBtn", true);
  setError(message);
  $("#retryBtn").onclick = () => {
    showChecking();
    retry();
  };
}

function loadGsi() {
  if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
  if (!gsiLoading) {
    gsiLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = resolve;
      s.onerror = () => {
        gsiLoading = null;
        reject(new Error("gsi"));
      };
      document.head.appendChild(s);
    });
  }
  return gsiLoading;
}

export async function showLogin(message) {
  show("#lock", true);
  show("#lockChecking", false);
  show("#retryBtn", false);
  show("#gsiBtn", true);
  setError(message);
  try {
    await loadGsi();
    if (!gsiInitialised) {
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handleCredential });
      gsiInitialised = true;
    }
    window.google.accounts.id.renderButton($("#gsiBtn"), { theme: "filled_blue", size: "large", text: "signin_with", shape: "pill", width: 280 });
  } catch (e) {
    show("#gsiBtn", false);
    showRetry(t("Google Sign-In load ஆகவில்லை. இணைய இணைப்பை சரிபார்த்து மீண்டும் முயற்சிக்கவும்.", "Google Sign-In failed to load. Check your internet connection and try again."), () => showLogin());
  }
}

async function handleCredential(response) {
  setError(t("சரிபார்க்கிறது…", "Verifying…"));
  const r = await api.login(response.credential);
  if (r.ok && r.data.authenticated) {
    setError("");
    return onAuthed(r.data);
  }
  if (r.status === 0) return setError(t("சரிபார்க்க முடியவில்லை. இணைய இணைப்பை சரிபார்த்து மீண்டும் முயற்சிக்கவும்.", "Could not verify. Check your internet connection and try again."));
  if (r.status === 401) return setError(t("Google உள்நுழைவு காலாவதியாகியுள்ளது. மீண்டும் முயற்சிக்கவும்.", "Google sign-in expired. Please try again."));
  if (r.status === 403 && r.data.email) return setError(t("இந்த Google account (" + r.data.email + ")-க்கு அனுமதி இல்லை.", "This Google account (" + r.data.email + ") is not permitted."));
  if (r.status === 409 && r.data.error === "device-locked") return setError(t("இந்த Account ஏற்கனவே வேறொரு Device-ல் பயன்பாட்டில் உள்ளது. Device மாற்ற Admin-ஐ தொடர்பு கொள்ளவும்.", "This account is already in use on a different device. Contact the admin to switch devices."));
  if (r.status === 429) return setError(t("அதிக முயற்சிகள். ஒரு நிமிடம் கழித்து முயற்சிக்கவும்.", "Too many attempts. Please wait a minute and try again."));
  if (r.data.error === "config") return setError(t("சேவையக அமைப்பு முழுமையடையவில்லை (ADMIN_EMAIL). SETUP-TA.txt-ஐ பார்க்கவும்.", "Server is not fully configured (ADMIN_EMAIL). See SETUP-TA.txt."));
  setError(t("சேவையக சரிபார்ப்பு பிரச்சனை. சிறிது நேரம் கழித்து முயற்சிக்கவும்.", "Server verification problem. Please try again shortly."));
}
