// Everything that turns server data into HTML. All dynamic text is escaped; every external link
// opens with rel="noopener noreferrer".
import { $, escapeHtml as esc, safeUrl } from "./util.js";
import { t, pick } from "./i18n.js";
import { api } from "./api.js";

const EXT = ' target="_blank" rel="noopener noreferrer"';
const digits = (s) => String(s || "").replace(/\D/g, "");

function tile(i) {
  return '<a class="tile" href="' + esc(safeUrl(i.url)) + '"' + (i.dash ? ' data-dash="1"' : EXT) + '><div class="ico">' + esc(i.icon) + "</div><div><b>" + esc(pick(i)) + "</b><small>" + esc(i.sub) + "</small></div></a>";
}
function row({ href, icon, title, sub, ext, dash }) {
  return '<a class="row" href="' + esc(safeUrl(href)) + '"' + (ext ? EXT : "") + (dash ? ' data-dash="1"' : "") + '><div class="ico">' + esc(icon) + "</div><div><b>" + esc(title) + "</b><small>" + esc(sub) + '</small></div><span class="go">›</span></a>';
}
const linkRow = (i) => row({ href: i.url, icon: i.icon, title: pick(i), sub: i.sub, ext: !i.dash, dash: i.dash });
const put = (sel, html) => {
  const el = $(sel);
  if (el) el.innerHTML = html;
};

export function renderSite(site) {
  put("#quickGrid", site.quick.map(tile).join(""));
  put("#accountsList", site.accounts.map(linkRow).join(""));
  put("#phoneList", site.phones.map((p) => row({ href: "tel:+" + digits(p.tel), icon: "📞", title: pick(p), sub: p.show })).join(""));
  put("#emailList", site.emails.map((m) => row({ href: "mailto:" + m.mail, icon: "📧", title: pick(m), sub: m.mail })).join(""));
  put("#linkList", site.links.map(linkRow).join(""));
  put(
    "#moreList",
    site.more.map(linkRow).join("") +
      '<a class="row" href="#contacts" data-page="contacts"><div class="ico">📞</div><div><b>' + esc(t("முக்கிய தொடர்புகள் & இணைப்புகள்", "Important Contacts & Links")) + '</b><small>Call, Email, Links</small></div><span class="go">›</span></a>' +
      '<div class="row"><div class="ico">🔒</div><div><b>Trustees Internal Use Only</b><small>' + esc(t("இந்த App அறங்காவலர்களின் உள் பயன்பாட்டிற்காக.", "This app is for trustees' internal use only.")) + '</small></div><span class="badge">PRIVATE</span></div>'
  );
}

export function renderTrustees(list) {
  const grid = $("#memberGrid");
  if (!grid) return;
  if (!list || !list.length) {
    grid.innerHTML = "<div class='row'><small>" + esc(t("Data கிடைக்கவில்லை", "No data available")) + "</small></div>";
    return;
  }
  grid.innerHTML = list
    .map(
      (m) =>
        '<div class="profile"><img src="' + esc(safeUrl(m.img)) + '" width="76" height="76" alt="' + esc(m.name) + '" loading="lazy" decoding="async"><b>' + esc(m.name) + '</b><span class="role">' + esc(m.role) + '</span><div class="mini-actions">' +
        '<a href="' + esc(safeUrl(m.folder)) + '"' + EXT + ">📁 Folder</a>" +
        '<a href="https://wa.me/' + esc(digits(m.phone)) + '"' + EXT + ">💬 WhatsApp</a>" +
        '<a href="tel:+' + esc(digits(m.phone)) + '">📞 Call</a></div></div>'
    )
    .join("");
}

// ===== logged-in indicator: avatar chip + dropdown (e-mail, admin badge, logout) =====
export function renderUserChip(state, onLogout) {
  const host = $("#userChip");
  if (!host) return;
  host.classList.remove("hidden");
  const initial = (state.email || "?").trim().charAt(0).toUpperCase();
  host.innerHTML = '<button id="userAvatarBtn" class="user-avatar" type="button" aria-label="Account">' + esc(initial) + "</button>";
  $("#userAvatarBtn").onclick = (e) => {
    e.stopPropagation();
    toggleDropdown(state, onLogout);
  };
}

function closeDropdown() {
  const dd = $("#userDropdown");
  if (dd) dd.remove();
}
export { closeDropdown };

function toggleDropdown(state, onLogout) {
  if ($("#userDropdown")) return closeDropdown();
  const rect = $("#userAvatarBtn").getBoundingClientRect();
  const dd = document.createElement("div");
  dd.id = "userDropdown";
  dd.className = "user-dropdown";
  dd.style.top = rect.bottom + 10 + "px";
  dd.style.right = Math.max(12, window.innerWidth - rect.right) + "px";
  dd.innerHTML = '<div class="u-email">' + esc(state.email) + "</div>" + (state.isAdmin ? '<span class="u-badge">ADMIN</span>' : "") + '<button id="logoutBtn" type="button">' + esc(t("🚪 வெளியேறு", "🚪 Log out")) + "</button>";
  document.body.appendChild(dd);
  $("#logoutBtn").onclick = onLogout;
  setTimeout(() => {
    document.addEventListener("click", function onDocClick(e) {
      if (!dd.contains(e.target)) {
        dd.remove();
        document.removeEventListener("click", onDocClick);
      }
    });
  }, 0);
}

// ===== ADMIN: add / remove allowed e-mails (the server re-checks admin rights on every call) =====
export function renderAdminPanel(state) {
  const host = $("#adminPanel");
  if (!host) return;
  host.classList.remove("hidden");
  host.innerHTML =
    '<div class="section-title"><h2>🛡️ ' + esc(t("நிர்வாகம்", "Admin")) + "</h2><span>Admin</span></div>" +
    '<div class="admin-add"><input id="adminNewEmail" type="email" autocomplete="off" aria-label="Email" placeholder="' + esc(t("புதிய Email சேர்க்க…", "Add new email…")) + '"><button id="adminAddBtn" class="unlock" type="button">➕ ' + esc(t("சேர்", "Add")) + "</button></div>" +
    '<div id="adminErr" class="err" role="alert"></div>' +
    '<div id="adminList" class="list admin-list"><div class="row"><small>Loading…</small></div></div>';

  const setErr = (msg) => ($("#adminErr").textContent = msg || "");
  const failText = (r, fallback) => (r.status === 0 ? t("இணைய இணைப்பு தோல்வி", "Network error") : r.data.error || fallback);

  function renderList(emails) {
    const list = $("#adminList");
    if (!emails || !emails.length) {
      list.innerHTML = "<div class='row'><small>" + esc(t("Emails இல்லை", "No emails")) + "</small></div>";
      return;
    }
    list.innerHTML = emails
      .map((e) => {
        const me = e === state.email;
        return '<div class="row admin-row"><div class="ico">👤</div><div><b>' + esc(e) + "</b>" + (me ? "<small>" + esc(t("Admin (நீங்கள்)", "Admin (You)")) + "</small>" : "") + "</div>" + (me ? "" : '<button class="admin-remove" type="button" aria-label="Remove" data-email="' + esc(e) + '">✕</button>') + "</div>";
      })
      .join("");
    list.querySelectorAll(".admin-remove").forEach((btn) => {
      btn.onclick = async () => {
        const email = btn.dataset.email;
        if (!confirm(t(email + " ஐ நீக்கவா?", "Remove " + email + "?"))) return;
        setErr("");
        const r = await api.admin.remove(email);
        if (r.ok) renderList(r.data.emails);
        else setErr(failText(r, t("நீக்க முடியவில்லை", "Could not remove")));
      };
    });
  }

  $("#adminAddBtn").onclick = async () => {
    const input = $("#adminNewEmail");
    const email = input.value.trim();
    if (!email) return;
    setErr("");
    const r = await api.admin.add(email);
    if (r.ok) {
      input.value = "";
      renderList(r.data.emails);
    } else setErr(failText(r, t("சேர்க்க முடியவில்லை", "Could not add")));
  };

  api.admin.list().then((r) => {
    if (r.ok) renderList(r.data.emails);
    else setErr(failText(r, t("Load ஆகவில்லை", "Could not load")));
  });
}
