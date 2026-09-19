
const GOOGLE_CLIENT_ID="323362878068-gpr8osss81v1t2qv85ffedmca7dld54u.apps.googleusercontent.com";
if("scrollRestoration" in history){history.scrollRestoration="manual"}
function $(s){return document.querySelector(s)}
function escapeHtml(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function curLang(){return localStorage.getItem("meleri_lang")||"ta"}
function t(ta,en){return curLang()==="en"?en:ta}
function getSession(){
 try{return JSON.parse(sessionStorage.getItem("meleri_auth")||"null")}catch(e){return null}
}
function grantAccess(session){
 sessionStorage.setItem("meleri_auth",JSON.stringify(session));
 $("#err").textContent="";
 $("#lock").classList.add("hidden");
 window.scrollTo(0,0);
 renderUserChip(session);
 loadTrustees(session);
 if(session.isAdmin)renderAdminPanel(session);
}
async function handleCredential(response){
 const err=$("#err");
 err.textContent=t("சரிபார்க்கிறது…","Verifying…");
 try{
  const r=await fetch("/api/verify-access",{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({idToken:response.credential})
  });
  const data=await r.json().catch(()=>({}));
  if(r.ok&&data.allowed){
   grantAccess({email:data.email,isAdmin:!!data.isAdmin,idToken:response.credential});
  }else if(r.status===401){
   err.textContent=t("Google உள்நுழைவு காலாவதியாகியுள்ளது. மீண்டும் முயற்சிக்கவும்.","Google sign-in expired. Please try again.");
  }else if(data.email){
   err.textContent=t("இந்த Google account ("+data.email+")-க்கு அனுமதி இல்லை.","This Google account ("+data.email+") is not permitted.");
  }else{
   err.textContent=t("சேவையக சரிபார்ப்பு பிரச்சனை. Vercel deployment/configuration-ஐ சரிபார்க்கவும்.","Server verification problem. Check the Vercel deployment/configuration.");
  }
 }catch(e){
  err.textContent=t("சரிபார்க்க முடியவில்லை. இணைய இணைப்பை சரிபார்த்து மீண்டும் முயற்சிக்கவும்.","Could not verify. Check your internet connection and try again.");
 }
}
async function auth(){
 const lock=$("#lock");
 const session=getSession();
 if(session&&session.email&&session.idToken){
  try{
   const r=await fetch("/api/verify-access",{
    method:"POST",
    headers:{"Content-Type":"application/json","Cache-Control":"no-cache"},
    cache:"no-store",
    body:JSON.stringify({idToken:session.idToken})
   });
   const data=await r.json();
   if(r.ok&&data.allowed){
    const fresh={email:data.email,isAdmin:!!data.isAdmin,idToken:session.idToken};
    sessionStorage.setItem("meleri_auth",JSON.stringify(fresh));
    lock.classList.add("hidden");
    window.scrollTo(0,0);
    renderUserChip(fresh);
    loadTrustees(fresh);
    if(fresh.isAdmin)renderAdminPanel(fresh);
    return;
   }
  }catch(e){}
  sessionStorage.removeItem("meleri_auth");
 }else{
  sessionStorage.removeItem("meleri_auth");
 }
 lock.classList.remove("hidden");
 renderGoogleButton(0);
}
function renderGoogleButton(attempt){
 if(window.google&&google.accounts&&google.accounts.id){
  google.accounts.id.initialize({client_id:GOOGLE_CLIENT_ID,callback:handleCredential});
  google.accounts.id.renderButton($("#gsiBtn"),{theme:"filled_blue",size:"large",text:"signin_with",shape:"pill",width:280});
  return;
 }
 if(attempt>50){$("#err").textContent=t("Google Sign-In load ஆகவில்லை. இணைய இணைப்பை சரிபார்த்து Page-ஐ Refresh செய்யவும்.","Google Sign-In failed to load. Check your internet connection and refresh the page.");return}
 setTimeout(()=>renderGoogleButton(attempt+1),100);
}

// ===== LOGGED-IN INDICATOR: avatar chip + dropdown (email, admin badge, logout) =====
function renderUserChip(session){
 const host=$("#userChip");
 if(!host)return;
 host.classList.remove("hidden");
 const initial=(session.email||"?").trim().charAt(0).toUpperCase();
 host.innerHTML='<button id="userAvatarBtn" class="user-avatar" type="button" aria-label="Account">'+initial+'</button>';
 $("#userAvatarBtn").onclick=(e)=>{ e.stopPropagation(); toggleUserDropdown(session); };
}
function toggleUserDropdown(session){
 const existing=$("#userDropdown");
 if(existing){existing.remove();return}
 const btn=$("#userAvatarBtn");
 const rect=btn.getBoundingClientRect();
 const dd=document.createElement("div");
 dd.id="userDropdown";
 dd.className="user-dropdown";
 dd.style.top=(rect.bottom+10)+"px";
 dd.style.right=Math.max(12,window.innerWidth-rect.right)+"px";
 dd.innerHTML=
  '<div class="u-email">'+escapeHtml(session.email)+'</div>'+
  (session.isAdmin?'<span class="u-badge">ADMIN</span>':'')+
  '<button id="logoutBtn" type="button">'+t("🚪 வெளியேறு","🚪 Log out")+'</button>';
 document.body.appendChild(dd);
 $("#logoutBtn").onclick=()=>{ sessionStorage.removeItem("meleri_auth"); location.reload(); };
 setTimeout(()=>{
  document.addEventListener("click",function onDocClick(e){
   if(!dd.contains(e.target)){ dd.remove(); document.removeEventListener("click",onDocClick); }
  });
 },0);
}

// ===== ADMIN: add/remove allowed emails (server re-verifies admin on every call) =====
function renderAdminPanel(session){
 const host=$("#adminPanel");
 if(!host)return;
 host.classList.remove("hidden");
 host.innerHTML=
  '<div class="section-title"><h2>🛡️ '+t("நிர்வாகம்","Admin")+'</h2><span>Admin</span></div>'+
  '<div class="admin-add"><input id="adminNewEmail" type="email" placeholder="'+t("புதிய Email சேர்க்க…","Add new email…")+'"><button id="adminAddBtn" class="unlock">➕ '+t("சேர்","Add")+'</button></div>'+
  '<div id="adminErr" class="err"></div>'+
  '<div id="adminList" class="list admin-list"><div class="row"><small>'+t("Loading…","Loading…")+'</small></div></div>';

 function safeJson(r){
  return r.json().then(data=>({ok:r.ok,data})).catch(()=>({ok:false,data:{error:t("பதில் தவறு","Unexpected server response")}}));
 }
 function apiCall(method,body){
  return fetch("/api/admin-emails",{
   method,
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify(Object.assign({idToken:session.idToken},body||{}))
  }).then(safeJson).catch(()=>({ok:false,data:{error:t("இணைய இணைப்பு தோல்வி","Network error")}}));
 }
 function renderList(emails){
  const list=$("#adminList");
  if(!emails||!emails.length){list.innerHTML="<div class='row'><small>"+t("Emails இல்லை","No emails")+"</small></div>";return}
  list.innerHTML=emails.map(e=>
   '<div class="row admin-row"><div class="ico">👤</div><div><b>'+escapeHtml(e)+'</b>'+(e===session.email?'<small>'+t("Admin (நீங்கள்)","Admin (You)")+'</small>':'')+'</div>'+
    (e===session.email?'':'<button class="admin-remove" data-email="'+escapeHtml(e)+'">✕</button>')+
    '</div>'
  ).join("");
  list.querySelectorAll(".admin-remove").forEach(btn=>{
   btn.onclick=()=>{
    if(!confirm(t(btn.dataset.email+" ஐ நீக்கவா?","Remove "+btn.dataset.email+"?")))return;
    apiCall("DELETE",{email:btn.dataset.email}).then(({ok,data})=>{
     if(ok)renderList(data.emails);else $("#adminErr").textContent=data.error||t("நீக்க முடியவில்லை","Could not remove");
    });
   };
  });
 }
 function loadList(){
  fetch("/api/admin-emails",{headers:{Authorization:"Bearer "+session.idToken}})
   .then(safeJson)
   .then(({ok,data})=>{ if(ok)renderList(data.emails); else $("#adminErr").textContent=data.error||t("Load ஆகவில்லை","Could not load") })
   .catch(()=>{ $("#adminErr").textContent=t("இணைய இணைப்பு தோல்வி","Network error") });
 }
 $("#adminAddBtn").onclick=()=>{
  const input=$("#adminNewEmail");
  const email=input.value.trim();
  if(!email)return;
  $("#adminErr").textContent="";
  apiCall("POST",{email}).then(({ok,data})=>{
   if(ok){input.value="";renderList(data.emails)}else{$("#adminErr").textContent=data.error||t("சேர்க்க முடியவில்லை","Could not add")}
  });
 };
 loadList();
}

// ===== TRUSTEES: contact details only load AFTER a verified login =====
// (Previously this list — names, phone numbers, WhatsApp links — was
// written directly into index.html, so it was visible in "View Page
// Source" even to someone who never logged in. It now comes from a
// protected API call instead.)
function renderTrustees(list){
 const grid=$("#memberGrid");
 if(!grid)return;
 if(!list||!list.length){grid.innerHTML="<div class='row'><small>"+t("Data கிடைக்கவில்லை","No data available")+"</small></div>";return}
 grid.innerHTML=list.map(m=>
  '<div class="profile"><img src="'+escapeHtml(m.img)+'" alt="'+escapeHtml(m.name)+'" loading="lazy"><b>'+escapeHtml(m.name)+'</b><span class="role">'+escapeHtml(m.role)+'</span><div class="mini-actions">'+
   '<a href="'+escapeHtml(m.folder)+'" target="_blank">📁 Folder</a>'+
   '<a href="https://wa.me/'+escapeHtml(m.phone)+'" target="_blank">💬 WhatsApp</a>'+
   '<a href="tel:+'+escapeHtml(m.phone)+'">📞 Call</a>'+
  '</div></div>'
 ).join("");
}
function loadTrustees(session){
 const grid=$("#memberGrid");
 if(!grid)return;
 fetch("/api/trustees",{
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify({idToken:session.idToken})
 })
  .then(r=>r.json().then(data=>({ok:r.ok,data})))
  .then(({ok,data})=>{
   if(ok)renderTrustees(data.trustees);
   else grid.innerHTML="<div class='row'><small>"+t("உள்நுழைவு காலாவதி. Page-ஐ Refresh செய்யவும்.","Login expired. Please refresh the page.")+"</small></div>";
  })
  .catch(()=>{ grid.innerHTML="<div class='row'><small>"+t("இணைய இணைப்பு தோல்வி","Network error")+"</small></div>"; });
}

// ===== LANGUAGE TOGGLE (English / Tamil) =====
function applyLang(lang){
 localStorage.setItem("meleri_lang",lang);
 document.querySelectorAll("[data-en]").forEach(el=>{
  if(!el.dataset.ta)el.dataset.ta=el.textContent;
  el.textContent=lang==="en"?el.dataset.en:el.dataset.ta;
 });
 document.querySelectorAll("[data-en-ph]").forEach(el=>{
  if(!el.dataset.taPh)el.dataset.taPh=el.placeholder;
  el.placeholder=lang==="en"?el.dataset.enPh:el.dataset.taPh;
 });
 const btn=$("#langToggle");
 if(btn)btn.textContent=lang==="en"?"தமிழ்":"EN";
 document.documentElement.lang=lang;
 const openDropdown=$("#userDropdown");
 if(openDropdown)openDropdown.remove();
 const session=getSession();
 if(session&&session.isAdmin&&!$("#adminPanel").classList.contains("hidden"))renderAdminPanel(session);
}
function initLang(){
 const saved=localStorage.getItem("meleri_lang")||"ta";
 applyLang(saved);
 const btn=$("#langToggle");
 if(btn)btn.onclick=()=>applyLang((localStorage.getItem("meleri_lang")||"ta")==="ta"?"en":"ta");
}

function nav(){
 const links=document.querySelectorAll("[data-page]"), pages=document.querySelectorAll(".page");
 function go(id,animate){
  pages.forEach(p=>{
   const show=p.id===id;
   p.classList.toggle("active",show);
   if(show){
    p.scrollTop=0;
    if(animate){p.classList.remove("page-enter");void p.offsetWidth;p.classList.add("page-enter")}
   }
  });
  links.forEach(n=>n.classList.toggle("active",n.dataset.page===id));
  history.replaceState(null,"","#"+id);
 }
 links.forEach(n=>n.onclick=()=>go(n.dataset.page,true));
 const start=location.hash.replace("#","");go(document.getElementById(start)?start:"home",false);
}
document.addEventListener("DOMContentLoaded",()=>{auth();nav();dashboardGate();loadServiceStats();initLang()});

const DASH_STATUS_URL="https://docs.google.com/spreadsheets/d/e/2PACX-1vT2Hhw3RiD-YHcQfE_V_rc_pH-B9cubbV_Q4CzP6vhPPXSofSp-MjZOVkD8xb-CtmMvhuNddJGqPOs6/pub?gid=1803561821&single=true&output=csv";
function showToast(msg){
 let t=document.querySelector(".toast");
 if(!t){t=document.createElement("div");t.className="toast";document.body.appendChild(t)}
 t.textContent=msg;
 t.classList.add("show");
 clearTimeout(t._hideTimer);
 t._hideTimer=setTimeout(()=>t.classList.remove("show"),3200);
}
function dashboardGate(){
 const SHEETS_URL="https://docs.google.com/spreadsheets/d/14f0UnOMQLSvfQYN1BHwrJolr9F8rl3BebwMiEon5egM/edit?usp=drivesdk";
 const SHEETS_INTENT="intent://docs.google.com/spreadsheets/d/14f0UnOMQLSvfQYN1BHwrJolr9F8rl3BebwMiEon5egM/edit?usp=drivesdk#Intent;scheme=https;package=com.google.android.apps.docs.editors.sheets;end";
 document.querySelectorAll(".dash-link").forEach(link=>{
  link.addEventListener("click",e=>{
   e.preventDefault();
   fetch(DASH_STATUS_URL+"&_="+Date.now(),{cache:"no-store"})
    .then(r=>r.text())
    .then(t=>{
     if(t.trim().toUpperCase().startsWith("OFF")){
      showToast(curLang()==="en"?"Accounts are being updated right now. Please try again shortly.":"தற்போது கணக்கு Update ஆகிறது. சிறிது நேரம் கழித்து முயற்சிக்கவும்.");
     } else {
      // Android: open the installed Google Sheets app directly.
      // This avoids opening the spreadsheet in the browser/WebView first.
      window.location.href=SHEETS_INTENT;
     }
    })
    .catch(()=>{ window.location.href=SHEETS_INTENT; });
  });
 });
}

function parseCSV(text){
 return text.split(/\r?\n/).filter(r=>r.length).map(r=>r.split(",").map(c=>c.trim().replace(/^"|"$/g,"")));
}
function loadServiceStats(){
 const totalEl=$("#svcTotal"), yearEl=$("#svcYear");
 if(!totalEl||!yearEl) return;
 fetch(DASH_STATUS_URL+"&_="+Date.now(),{cache:"no-store"})
  .then(r=>r.text())
  .then(text=>{
   const rows=parseCSV(text);
   const headerRow=rows.find(r=>r.some(c=>c.includes("பிரிவு")));
   if(!headerRow) throw new Error("no-header");
   const startIdx=rows.indexOf(headerRow)+1;
   const totalRow=rows.slice(startIdx).find(r=>r[0]&&r[0].includes("இதுவரை"));
   const yearRow=rows.slice(startIdx).find(r=>r[0]&&(r[0].includes("இந்த ஆண்டு")||r[0].includes("நடப்பாண்டு")));
   const ICONS={"தீட்சை":"⭐","பிரம்மஞான":"🧘","அருள்நிதி":"💚","பேராசிரியர்":"🎓","டிப்ளமோ":"📘"};
   function iconFor(label){for(const k in ICONS){if(label.includes(k))return ICONS[k]}return "✨"}
   function render(el,row){
    if(!row){el.innerHTML="<div class='stat-card'><small>"+t("தரவு கிடைக்கவில்லை","No data available")+"</small></div>";return}
    let html="";
    for(let i=1;i<headerRow.length;i++){
     const label=headerRow[i]; if(!label) continue;
     const val=row[i]||"0";
     html+=`<div class="stat-card"><div class="ico">${iconFor(label)}</div><div><b>${val}</b><small>${label}</small></div></div>`;
    }
    el.innerHTML=html;
   }
   render(totalEl,totalRow);
   render(yearEl,yearRow);
  })
  .catch(()=>{
   const msg="<div class='stat-card'><small>"+t("தரவு load ஆகவில்லை","Data failed to load")+"</small></div>";
   totalEl.innerHTML=msg;
   yearEl.innerHTML=msg;
  });
}
