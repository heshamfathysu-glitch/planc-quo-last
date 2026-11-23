// Reads a client's commercial registration certificate or national address
// proof (digital PDFs from the Ministry of Commerce and SPL) in the browser
// with pdf.js, and picks out the fields the client form needs. Free forever:
// no server, no paid service. Scanned images are not read.

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
      // Arabic lines read right to left
      const arabic = parts.join("").match(/[؀-ۿ]/g)?.length > parts.join("").length / 3;
      return (arabic ? parts.reverse() : parts).join(" ").replace(/\s+/g, " ").trim();
    });
}

export async function pdfText(file) {
  const [lib, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  lib.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines = [];
  for (let n = 1; n <= Math.min(doc.numPages, 3); n++) {
    const tc = await (await doc.getPage(n)).getTextContent();
    lines.push(...itemsToLines(tc.items));
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
      const v = lines[i].slice(k + l.length).replace(/^[\s:：.\-]+/, "").trim();
      if (v) return v;
      if (lines[i + 1]) return lines[i + 1].trim();
    }
  }
  return "";
}
// numbers printed one digit per box ("4 1 7 8") count as one number
const digits = (s, n) => (norm(s).replace(/\b\d(?:\s\d\b){2,}/g, (m) => m.replace(/\s/g, "")).match(new RegExp(`\\b\\d{${n}}\\b`)) || [""])[0];

// Returns only the fields it found: { name, cr, vat, building, street,
// district, city, postal, secondary }
export function parseCompanyDoc(rawLines) {
  const lines = rawLines.map(norm).filter(Boolean);
  const all = lines.join("\n");
  const out = {};

  const vat = all.match(/\b3\d{13}3\b/);
  if (vat) out.vat = vat[0];

  const cr = digits(after(lines, ["National Number", "Unified Number", "CR Number", "Commercial Registration No", "الرقم الوطني الموحد", "رقم السجل التجاري", "الرقم الموحد"]), 10)
    || (all.match(/\b7\d{9}\b/) || [""])[0];
  if (cr) out.cr = cr;

  // name: Arabic label, or the English certificate's lines under its title
  let name = after(lines, ["الاسم التجاري", "اسم المنشأة", "Trade Name", "Establishment Name", "Company Name"]);
  if (!name) {
    const t = lines.findIndex((l) => /Commercial Registration Certificate|شهادة السجل التجاري/i.test(l));
    const end = lines.findIndex((l, i) => i > t && /National Number|الرقم الوطني/.test(l));
    if (t >= 0 && end > t) name = lines.slice(t + 1, end).filter((l) => !/Basic data|البيانات الأساسية/i.test(l)).join(" ");
  }
  if (!name) {
    // national address proof: "Name <english> | الاسم <arabic>"
    name = after(lines, ["الاسم"]) || after(lines, ["Name"]);
  }
  if (name) out.name = name.replace(/\s+/g, " ").trim();

  // national address proof
  const b = digits(after(lines, ["Building No", "رقم المبنى"]), 4);
  if (b) out.building = b;
  const p = digits(after(lines, ["Postal Code", "الرمز البريدي"]), 5);
  if (p) out.postal = p;
  const sec = digits(after(lines, ["Secondary No", "الرقم الفرعي", "الرقم الإضافي"]), 4);
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

export async function readCompanyFile(file) {
  if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
    throw new Error("اختر ملف PDF الأصلي من منصة وزارة التجارة أو العنوان الوطني. الصور والملفات الممسوحة لا تُقرأ.");
  }
  const lines = await pdfText(file);
  if (!lines.length) throw new Error("الملف لا يحتوي نصا قابلا للقراءة (ربما صورة ممسوحة). أدخل البيانات يدويا.");
  return parseCompanyDoc(lines);
}

export const FIELD_LABELS = {
  name: "الاسم", cr: "السجل التجاري", vat: "الرقم الضريبي", building: "رقم المبنى", street: "الشارع",
  district: "الحي", city: "المدينة", postal: "الرمز البريدي", secondary: "الرقم الفرعي",
};
