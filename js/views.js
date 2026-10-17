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

// role: "master" (ஆசிரியர்கள்/Masters) shows a master-specific lock notice; anything else (trustee/admin) shows the trustee one.
export function renderSite(site, role) {
  put("#quickGrid", site.quick.map(tile).join(""));
  put("#accountsList", site.accounts.map(linkRow).join(""));
  put("#phoneList", site.phones.map((p) => row({ href: "tel:+" + digits(p.tel), icon: "📞", title: pick(p), sub: p.show })).join(""));
  put("#emailList", site.emails.map((m) => row({ href: "mailto:" + m.mail, icon: "📧", title: pick(m), sub: m.mail })).join(""));
  put("#linkList", site.links.map(linkRow).join(""));
  const isMaster = role === "master";
  const lockTitle = isMaster ? "ஆசிரியர்கள்/Masters Internal Use Only" : "Trustees Internal Use Only";
  const lockSub = isMaster
    ? t("இந்த App ஆசிரியர்கள்/Masters-ன் உள் பயன்பாட்டிற்கு மட்டும்.", "This app is for Masters' internal use only.")
    : t("இந்த App அறங்காவலர்களின் உள் பயன்பாட்டிற்காக.", "This app is for trustees' internal use only.");
  put(
    "#moreList",
    site.more.map(linkRow).join("") +
      '<a class="row" href="#contacts" data-page="contacts"><div class="ico">📞</div><div><b>' + esc(t("முக்கிய தொடர்புகள் & இணைப்புகள்", "Important Contacts & Links")) + '</b><small>Call, Email, Links</small></div><span class="go">›</span></a>' +
      '<div class="row"><div class="ico">🔒</div><div><b>' + esc(lockTitle) + "</b><small>" + esc(lockSub) + '</small></div><span class="badge">PRIVATE</span></div>'
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

// ===== Admin-only: preview the app as a Trustee sees it, or as a Master/ஆசிரியர் sees it =====
export function renderRoleSwitch(previewRole, onSwitch) {
  const host = $("#roleSwitch");
  if (!host) return;
  host.classList.remove("hidden");
  const isMaster = previewRole === "master";
  host.innerHTML =
    '<div class="section-title"><h2>👁️ ' + esc(t("பார்வை", "View")) + "</h2><span>Preview</span></div>" +
    '<div class="role-switch"><button id="viewTrusteeBtn" class="unlock" type="button"' + (isMaster ? "" : " disabled") + ">👥 " + esc(t("அறங்காவலர் View", "Trustee View")) + "</button>" +
    '<button id="viewMasterBtn" class="unlock" type="button"' + (isMaster ? " disabled" : "") + ">🎓 " + esc(t("ஆசிரியர்/Master View", "Master View")) + "</button></div>";
  $("#viewTrusteeBtn").onclick = () => onSwitch("trustee");
  $("#viewMasterBtn").onclick = () => onSwitch("master");
}

// ===== ADMIN: add / remove members, each with a role (the server re-checks admin rights on every call) =====
export function renderAdminPanel(state) {
  const host = $("#adminPanel");
  if (!host) return;
  host.classList.remove("hidden");
  host.innerHTML =
    '<div class="section-title"><h2>🛡️ ' + esc(t("நிர்வாகம்", "Admin")) + "</h2><span>Admin</span></div>" +
    '<div class="admin-add"><input id="adminNewEmail" type="email" autocomplete="off" aria-label="Email" placeholder="' + esc(t("புதிய Email சேர்க்க…", "Add new email…")) + '">' +
    '<select id="adminNewRole" aria-label="Role"><option value="trustee">' + esc(t("அறங்காவலர்", "Trustee")) + '</option><option value="master">' + esc(t("ஆசிரியர்/Master", "Master")) + "</option></select>" +
    '<button id="adminAddBtn" class="unlock" type="button">➕ ' + esc(t("சேர்", "Add")) + "</button></div>" +
    '<div id="adminErr" class="err" role="alert"></div>' +
    '<div id="adminList" class="list admin-list"><div class="row"><small>Loading…</small></div></div>';

  const setErr = (msg) => ($("#adminErr").textContent = msg || "");
  const failText = (r, fallback) => (r.status === 0 ? t("இணைய இணைப்பு தோல்வி", "Network error") : r.data.error || fallback);
  const roleLabel = (role) => (role === "master" ? t("ஆசிரியர்/Master", "Master") : t("அறங்காவலர்", "Trustee"));

  function renderList(members) {
    const list = $("#adminList");
    const adminRow = '<div class="row admin-row"><div class="ico">👤</div><div><b>' + esc(state.email) + "</b><small>" + esc(t("Admin (நீங்கள்)", "Admin (You)")) + "</small></div></div>";
    if (!members || !members.length) {
      list.innerHTML = adminRow;
      return;
    }
    list.innerHTML =
      adminRow +
      members
        .map((m) => {
          const deviceBadge = m.deviceId
            ? '<span class="badge" title="' + esc(t("ஒரு Device-க்கு Lock ஆகியுள்ளது", "Locked to one device")) + '">📱</span>'
            : "";
          const resetBtn = m.deviceId
            ? '<button class="admin-reset" type="button" aria-label="Reset device" data-email="' + esc(m.email) + '" title="' + esc(t("Device Reset", "Reset device")) + '">🔓</button>'
            : "";
          return (
            '<div class="row admin-row"><div class="ico">👤</div><div><b>' +
            esc(m.email) +
            "</b><small>" +
            esc(roleLabel(m.role)) +
            "</small></div>" +
            deviceBadge +
            resetBtn +
            '<button class="admin-remove" type="button" aria-label="Remove" data-email="' +
            esc(m.email) +
            '">✕</button></div>'
          );
        })
        .join("");
    list.querySelectorAll(".admin-remove").forEach((btn) => {
      btn.onclick = async () => {
        const email = btn.dataset.email;
        if (!confirm(t(email + " ஐ நீக்கவா?", "Remove " + email + "?"))) return;
        setErr("");
        const r = await api.admin.remove(email);
        if (r.ok) renderList(r.data.members);
        else setErr(failText(r, t("நீக்க முடியவில்லை", "Could not remove")));
      };
    });
    list.querySelectorAll(".admin-reset").forEach((btn) => {
      btn.onclick = async () => {
        const email = btn.dataset.email;
        if (!confirm(t(email + " -ன் Device Lock-ஐ அவிழ்க்கவா? அடுத்த login எந்த Device-லும் வேலை செய்யும்.", "Release " + email + "'s device lock? The next login will work from any device."))) return;
        setErr("");
        const r = await api.admin.resetDevice(email);
        if (r.ok) renderList(r.data.members);
        else setErr(failText(r, t("முடியவில்லை", "Could not reset")));
      };
    });
  }

  $("#adminAddBtn").onclick = async () => {
    const input = $("#adminNewEmail");
    const email = input.value.trim();
    const role = $("#adminNewRole").value;
    if (!email) return;
    setErr("");
    const r = await api.admin.add(email, role);
    if (r.ok) {
      input.value = "";
      renderList(r.data.members);
    } else setErr(failText(r, t("சேர்க்க முடியவில்லை", "Could not add")));
  };

  api.admin.list().then((r) => {
    if (r.ok) renderList(r.data.members);
    else setErr(failText(r, t("Load ஆகவில்லை", "Could not load")));
  });
}
