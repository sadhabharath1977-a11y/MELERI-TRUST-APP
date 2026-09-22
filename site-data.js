"use strict";
// Every link, phone number and e-mail shown in the app lives here (server-only), instead of being
// written into index.html where anybody could read it with "View Page Source" without logging in.
// To add or change an entry, edit this file and redeploy.
const DASHBOARD_URL = "https://docs.google.com/spreadsheets/d/14f0UnOMQLSvfQYN1BHwrJolr9F8rl3BebwMiEon5egM/edit?usp=drivesdk";

const SITE = {
  dashboardUrl: DASHBOARD_URL,

  // Home -> Quick Access (order matters: tile colours follow the order)
  quick: [
    { icon: "📁", ta: "பொதுவான ஆவணங்கள்", en: "Common Documents", sub: "Shared Drive Folder", url: "https://drive.google.com/drive/folders/1eLcZx1fMzgcozdw0IvshjmqaG9T6MiM9" },
    { icon: "📝", ta: "கூட்ட குறிப்புகள்", en: "Meeting Notes", sub: "Meeting Notes", url: "https://drive.google.com/drive/folders/1vj8X5IcS6bbGBBLSUJ51_5xOvjDorqbW" },
    { icon: "📊", ta: "டாஷ்போர்டு", en: "Dashboard", sub: "Dashboard", url: DASHBOARD_URL, dash: true },
    { icon: "📋", ta: "ஆன்லைன் அட்மிஷன்", en: "Online Admission", sub: "Admission Form", url: "https://docs.google.com/forms/d/1qaLqBHhTSxRZm6v9Ll-QL4T7AFtEM8zP9L76XUbuFGs/viewform" }
  ],

  accounts: [
    { icon: "➕", ta: "வரவு செலவு பதிவு", en: "Income - Expense Entry", sub: "Income – Expense Entry Form", url: "https://docs.google.com/forms/d/e/1FAIpQLSenlGdJSJFREnT90Tm5Y0nBfQqgIQ3oM7QmAeoNe_I3affLWA/viewform?usp=sharing&ouid=115837768816911449489" },
    { icon: "📑", ta: "ஜோன் காலாண்டு கணக்கு", en: "Zone Quarterly Accounts", sub: "Quarterly Report", url: "https://wcscpoornam.vethathiriskyyoga.com/" },
    { icon: "📊", ta: "டாஷ்போர்டு", en: "Dashboard", sub: "Financial Dashboard", url: DASHBOARD_URL, dash: true }
  ],

  phones: [
    { ta: "வேதாத்திரி பதிப்பகம்", en: "Vethathiri Pathippagam", tel: "919994930378", show: "99949 30378" },
    { ta: "TRL ஜோன் EO", en: "TRL Zone EO", tel: "918838074336", show: "88380 74336" },
    { ta: "WCSC தலைமை அலுவலகம்", en: "WCSC Head Office", tel: "917904402887", show: "79044 02887" },
    { ta: "அளியார் கோர்ஸ் புக்கிங்", en: "Aliyar Course Booking", tel: "916379282565", show: "63792 82565" },
    { ta: "அளியார் அலுவலகம்", en: "Aliyar Office", tel: "917598238733", show: "07598 238733" },
    { ta: "ஸ்மார்ட் அலுவலகம்", en: "Smart Office", tel: "919488947444", show: "94889 47444" },
    { ta: "விஷன் அலுவலகம்", en: "Vision Office", tel: "919442124234", show: "94421 24234" },
    { ta: "அளியார் IT அலுவலகம்", en: "Aliyar IT Office", tel: "918903488633", show: "89034 88633" }
  ],

  emails: [
    { ta: "திருவள்ளூர் ஜோன்", en: "Thiruvallur Zone", mail: "wcscthiruvallurzone@vethathiri.ac.in" },
    { ta: "அளியார் அலுவலகம்", en: "Aliyar Office", mail: "aoaliyar@vethathiri.ac.in" },
    { ta: "விஷன் அளியார்", en: "Vision Aliyar", mail: "visionacademy@vethathiri.ac.in" }
  ],

  links: [
    { icon: "📅", ta: "Year Planner - அறிவுத் திருக்கோயில், அளியார்", en: "Year Planner - Arivuthirukoil, Aliyar", sub: "Open Page", url: "https://manuals.plus/m/85430e3dd5dce35db29e00d5082bba1f204678f82d55c7ef9305a1ed49f43ec9" },
    { icon: "📄", ta: "ஸ்மார்ட் படிவங்கள்", en: "Smart Forms", sub: "Open Page", url: "https://www.vethathiri.edu.in/pages/forms" }
  ],

  more: [
    { icon: "💬", ta: "அறக்கட்டளை WhatsApp குரூப்", en: "Trust WhatsApp Group", sub: "Group Communication", url: "https://chat.whatsapp.com/FZW3r2FpF3YL75mOniOW9h?s=sh&p=a&mlu=4&ilr=4" },
    { icon: "🌐", ta: "எங்கள் இணையதளம்", en: "Our Website", sub: "Our Website", url: "https://meleriskyyoga.netlify.app/" }
  ]
};

// ஆசிரியர்கள்/Masters-க்கான பிரிவு: மேலே உள்ள SITE-லிருந்தே தேர்ந்தெடுக்கப்பட்டவை (புதிய இணைப்பு எதுவும் இல்லை).
//   - Common Documents, Meeting Notes, Online Admission (Dashboard தவிர்த்து)
//   - Important Contacts பக்கம் முழுவதும் (Phones/Emails/Links)
//   - Our Website (WhatsApp Group தவிர்த்து)
// Trustees Accounts பக்கம் மற்றும் Trustees உறுப்பினர் பட்டியல் masters-க்கு இல்லை.
const MASTER_SITE = {
  dashboardUrl: DASHBOARD_URL,
  quick: SITE.quick.filter((i) => !i.dash),
  accounts: [],
  phones: SITE.phones,
  emails: SITE.emails,
  links: SITE.links,
  more: SITE.more.filter((i) => i.en === "Our Website")
};

module.exports = { SITE, MASTER_SITE };
