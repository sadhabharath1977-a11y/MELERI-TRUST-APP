// Small shared helpers.
export const $ = (selector, root = document) => root.querySelector(selector);

export function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Only allow link types the app really uses (defence in depth against javascript: URLs).
export function safeUrl(url) {
  try {
    const u = new URL(url, location.href);
    return ["https:", "http:", "tel:", "mailto:"].includes(u.protocol) ? u.href : "#";
  } catch (e) {
    return "#";
  }
}

let toastTimer = 0;
export function showToast(message) {
  let el = $(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}
