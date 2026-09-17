// Trustee contact details. This file lives under /api/ so Vercel treats it as
// server-only code — it is NEVER sent to the browser as a static file.
// It is only readable through /api/trustees.js, which checks login first.
const TRUSTEES = [
  { img: "1000546836.jpg", name: "A/N VIVEKANANDAN",  role: "PRESIDENT",       folder: "https://drive.google.com/drive/folders/1DZ8wmSBUu4b-UUfINhkSBl4d6poZ5ogp", phone: "919380447242" },
  { img: "1000546776.jpg", name: "A/N VENUGOPAL",     role: "SECRETARY",       folder: "https://drive.google.com/drive/folders/1EnEmRGomCTKdEAuycuAo_ilICO8Yf4f7", phone: "919080060581" },
  { img: "1000546780.jpg", name: "A/N VAIYAPURI",     role: "TREASURER",       folder: "https://drive.google.com/drive/folders/175EfYZ6yJOIPXHZ0dBxTMV0CJ-iwO20N", phone: "919488753625" },
  { img: "1000546778.jpg", name: "A/N SADANANDAN",    role: "VP SMART",        folder: "https://drive.google.com/drive/folders/11Exvj2ZxY2Lq8LcEARFbhAnK6k1iFnC9", phone: "917010364315" },
  { img: "1000546782.jpg", name: "A/N NARAYANAN",     role: "VP YHE",          folder: "https://drive.google.com/drive/folders/11D8iV-SX0PswyWC5_RTl1pP4oXbnwYox", phone: "919843960038" },
  { img: "1000546824.jpg", name: "A/N UMAPATHI",      role: "VP YYE",          folder: "https://drive.google.com/drive/folders/11EqsIT3UlFo8CzJ7HUct2dzSLIp1-lrc", phone: "918012207993" },
  { img: "1000546784.jpg", name: "A/N VENKATESAN",    role: "VP PRO",          folder: "https://drive.google.com/drive/folders/1DFghycnWyXKDzDCMfj3uW4SvOk46j8iE", phone: "919952995426" },
  { img: "1000546818.jpg", name: "A/N THANGARAJ",     role: "VP EXTENSION",    folder: "https://drive.google.com/drive/folders/1DXpP8sobFVyhB23os1eyanLkPC-j171q", phone: "919600894055" },
  { img: "1000546816.jpg", name: "A/N MURALIPRASATH", role: "VP VSP",          folder: "https://drive.google.com/drive/folders/1DXX9dVK2f4ihWGbiEqE6LhT3olr8T-jX", phone: "919500502037" },
  { img: "1000546821.png", name: "A/N JOTHYMURUGAN",  role: "PROG OFFICER",    folder: "https://drive.google.com/drive/folders/1Wy8RB0Rlv_tS1XZfubmjx6uBhGBh06Tm", phone: "919751197757" },
  { img: "1000546820.jpg", name: "A/N MENAGAI",       role: "MASTER INCHARGE", folder: "https://drive.google.com/drive/folders/1m5lPS_YAUDliB5jwq6f5QD3-lRJH6849", phone: "919585715482" }
];

module.exports = { TRUSTEES };
