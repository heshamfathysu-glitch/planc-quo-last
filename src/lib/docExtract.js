// Reads a client's documents in the browser with pdf.js and picks out the
// fields the client form needs. Three separate readers, one per document:
//   cr      commercial registration certificate (Ministry of Commerce)
//   vat     VAT registration certificate (ZATCA)
//   address national address proof (SPL)
// Free forever: no server, no paid service. Scanned images are not read.
import { pdfjs, pageText } from "./pdfjs.js";

// pdf.js text items -> lines, top to bottom
export function itemsToLines(items) {
  const rows = [];
  for (const it of items) {
    const s = String(it.str || "");
    if (!s.trim()) continue;
    const y = Math.round(it.transform[5]);
    let row = rows.find((r) => Math.abs(r.y - y) <= 3);
    if (!row) rows.push((row = { y, parts: [] }));
    row.parts.push({ x: it.transform[4], s });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) => {
      const parts = r.parts.sort((a, b) => a.x - b.x).map((p) => p.s);
      const text = parts.join("");
      // Arabic lines read right to left
      const arabic = (text.match(/[؀-ۿ]/g) || []).length > text.length / 3;
      return (arabic ? parts.reverse() : parts).join(" ").replace(/\s+/g, " ").trim();
    });
}

export async function pdfText(file) {
  const lib = await pdfjs();
  const task = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const lines = [];
  try {
    for (let n = 1; n <= Math.min(doc.numPages, 3); n++) {
      lines.push(...itemsToLines(await pageText(await doc.getPage(n))));
    }
  } finally {
    task.destroy();
  }
  return lines;
}

// Arabic-Indic digits and presentation forms -> plain text
const norm = (s) => String(s || "").normalize("NFKC")
  .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
  .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
  .replace(/[‎‏‪-‮]/g, "");

// the value after a label on the same line ("Label : value"), or the next line
function after(lines, labels) {
  for (let i = 0; i < lines.length; i++) {
    for (const l of labels) {
      const k = lines[i].indexOf(l);
      if (k < 0) continue;
      const v = lines[i].slice(k + l.length).replace(/^[\s:：.\-/]+/, "").trim();
      if (v) return v;
      if (lines[i + 1]) return lines[i + 1].trim();
    }
  }
  return "";
}
// numbers printed one digit per box ("4 1 7 8") count as one number
const joinBoxes = (s) => norm(s).replace(/\b\d(?:\s\d\b){2,}/g, (m) => m.replace(/\s/g, ""));
const digits = (s, n) => (joinBoxes(s).match(new RegExp(`\\b\\d{${n}}\\b`)) || [""])[0];
const prep = (raw) => raw.map(norm).filter(Boolean);
const clean = (s) => s.replace(/\s+/g, " ").trim();

// ---- commercial registration: { name, cr } ----
export function parseCR(rawLines) {
  const lines = prep(rawLines);
  const all = lines.join("\n");
  const out = {};
  const cr = digits(after(lines, ["National Number", "Unified Number", "CR Number", "Commercial Registration No", "الرقم الوطني الموحد", "رقم السجل التجاري", "الرقم الموحد"]), 10)
    || (joinBoxes(all).match(/\b7\d{9}\b/) || [""])[0];
  if (cr) out.cr = cr;

  let name = after(lines, ["الاسم التجاري", "اسم المنشأة", "Trade Name", "Establishment Name", "Company Name"]);
  if (!name) {
    // English certificate: the name sits under the title
    const t = lines.findIndex((l) => /Commercial Registration Certificate|شهادة السجل التجاري/i.test(l));
    const end = lines.findIndex((l, i) => i > t && /National Number|الرقم الوطني/.test(l));
    if (t >= 0 && end > t) name = lines.slice(t + 1, end).filter((l) => !/Basic data|البيانات الأساسية/i.test(l)).join(" ");
  }
  if (name) out.name = clean(name);
  return out;
}

// ---- VAT registration certificate: { name, vat } ----
export function parseVAT(rawLines) {
  const lines = prep(rawLines);
  const out = {};
  const labelled = joinBoxes(after(lines, ["رقم التسجيل الضريبي", "الرقم الضريبي", "رقم تسجيل ضريبة القيمة المضافة", "VAT Registration Number", "VAT Number", "Tax Registration Number", "TRN"]));
  const vat = (labelled.replace(/\s/g, "").match(/3\d{13}3/) || joinBoxes(lines.join("\n")).replace(/(\d) (?=\d)/g, "$1").match(/\b3\d{13}3\b/) || [""])[0];
  if (vat) out.vat = vat;
  const name = after(lines, ["اسم المكلف", "اسم المنشأة", "اسم الشركة", "Taxpayer Name", "Entity Name", "Company Name", "Name of Taxpayer"]);
  if (name && !/^\d+$/.test(name)) out.name = clean(name);
  return out;
}

// ---- national address: { name, building, street, district, city, postal, secondary } ----
export function parseAddress(rawLines) {
  const lines = prep(rawLines);
  const out = {};
  const name = after(lines, ["الاسم"]) || after(lines, ["Name"]);
  if (name) out.name = clean(name);
  const b = digits(after(lines, ["Building No", "Building Number", "رقم المبنى"]), 4);
  if (b) out.building = b;
  const p = digits(after(lines, ["Postal Code", "الرمز البريدي"]), 5);
  if (p) out.postal = p;
  const sec = digits(after(lines, ["Secondary No", "Additional No", "الرقم الفرعي", "الرقم الإضافي"]), 4);
  if (sec) out.secondary = sec;
  const strip = (s) => s.replace(/\b\d+\b/g, "").replace(/\s+/g, " ").trim();
  const street = strip(after(lines, ["الشارع", "Street"]));
  if (street && !/^(Street|الشارع)$/.test(street)) out.street = street;
  const district = strip(after(lines, ["الحي", "District"]));
  if (district && !/^(District|الحي)$/.test(district)) out.district = district;
  const city = strip(after(lines, ["المدينة", "City"]));
  if (city && !/^(City|المدينة)$/.test(city)) out.city = city;
  return out;
}

// what each button reads, and the field that proves it is the right file
export const DOC_KINDS = {
  cr: { label: "السجل التجاري", parse: parseCR, key: "cr", fields: ["name", "cr"] },
  vat: { label: "شهادة التسجيل الضريبي", parse: parseVAT, key: "vat", fields: ["name", "vat"] },
  address: { label: "العنوان الوطني", parse: parseAddress, key: ["building", "postal"], fields: ["building", "street", "district", "city", "postal", "secondary"] },
};

export async function readDocFile(file, kind) {
  const k = DOC_KINDS[kind];
  if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
    throw new Error(`اختر ملف ${k.label} بصيغة PDF الأصلية. الصور والملفات الممسوحة لا تُقرأ.`);
  }
  let lines;
  try {
    lines = await pdfText(file);
  } catch (e) {
    if (/password/i.test(e?.name || e?.message || "")) throw new Error("الملف محمي بكلمة مرور. افتحه واحفظه بدون حماية ثم أعد المحاولة.");
    throw new Error("تعذر فتح الملف. تأكد أنه ملف PDF سليم.");
  }
  if (!lines.length) throw new Error("الملف لا يحتوي نصا قابلا للقراءة (ربما صورة ممسوحة). أدخل البيانات يدويا.");
  const found = k.parse(lines);
  const keys = [].concat(k.key);
  if (!keys.some((x) => found[x])) throw new Error(`لم نجد بيانات ${k.label} في هذا الملف. تأكد أنك اخترت الملف الصحيح.`);
  return found;
}

export const FIELD_LABELS = {
  name: "الاسم", cr: "السجل التجاري", vat: "الرقم الضريبي", building: "رقم المبنى", street: "الشارع",
  district: "الحي", city: "المدينة", postal: "الرمز البريدي", secondary: "الرقم الفرعي",
};
