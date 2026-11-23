// Saudi invoices (ZATCA, phase 1): the three models from the user's examples.
//   standard   فاتورة ضريبية: to a VAT-registered business, prices before VAT,
//              VAT shown per line.
//   simplified فاتورة ضريبية مبسطة: to an individual, prices include VAT.
//   plain      فاتورة: when the seller is not registered for VAT, no VAT at all.
// Seller details live in Firestore settings/seller (Admin > بيانات الفواتير)
// and are copied into each invoice when it is created, so an issued invoice
// never changes when the settings do.

export const INVOICE_TYPES = [
  { id: "standard", label: "فاتورة ضريبية", short: "ضريبية", hint: "لمنشأة مسجلة في ضريبة القيمة المضافة. الأسعار قبل الضريبة." },
  { id: "simplified", label: "فاتورة ضريبية مبسطة", short: "مبسطة", hint: "لعميل فرد. الأسعار شاملة الضريبة." },
  { id: "plain", label: "فاتورة", short: "بدون ضريبة", hint: "عندما تكون المنشأة غير مسجلة في ضريبة القيمة المضافة." },
];
export const typeOf = (id) => INVOICE_TYPES.find((t) => t.id === id) || INVOICE_TYPES[0];

export const INVOICE_STATUSES = [
  { id: "draft", label: "مسودة" },
  { id: "issued", label: "صادرة" },
  { id: "paid", label: "مدفوعة" },
];
export const invoiceStatusLabel = (s) => INVOICE_STATUSES.find((x) => x.id === s)?.label || s;

export const PAY_METHODS = ["تحويل بنكي", "بطاقة مدى", "بطاقة ائتمانية", "نقدا", "Apple Pay", "STC Pay"];

export const DEFAULT_SELLER = {
  name: "", cr: "", vat: "",
  building: "", street: "", district: "", city: "", postal: "",
  bank: "", iban: "", holder: "",
};

export const VAT_RATE = 15;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// 1,234.50: invoices always show two decimals
export const money2 = (n) => r2(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ksaNow = () => {
  // Saudi Arabia is UTC+3 all year
  const d = new Date(Date.now() + 3 * 3600e3).toISOString();
  return { date: d.slice(0, 10), time: d.slice(11, 19) };
};
const addDays = (ymd, n) => {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// next number in the INV-YYYY-0001 series of the issue year, across all types
export function nextNumber(invoices, year) {
  const pre = `INV-${year}-`;
  const max = (invoices || []).reduce((m, i) => {
    const s = String(i.number || "");
    const n = s.startsWith(pre) ? parseInt(s.slice(pre.length), 10) : NaN;
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return pre + String(max + 1).padStart(4, "0");
}

export function newInvoice(type, invoices, seller, from = {}) {
  const { date, time } = ksaNow();
  return {
    type,
    status: "draft",
    archived: false,
    number: nextNumber(invoices, date.slice(0, 4)),
    issueDate: date,
    issueTime: time,
    supplyDate: date,
    subject: "",
    seller: { ...DEFAULT_SELLER, ...(seller || {}) },
    buyer: { name: "", vat: "", cr: "", building: "", street: "", district: "", city: "", postal: "" },
    txn: type === "simplified" ? "" : undefined,
    items: [{ title: "", desc: "", qty: 1, price: 0 }],
    discount: 0,
    vatRate: VAT_RATE,
    payMethod: type === "simplified" ? "بطاقة مدى" : "تحويل بنكي",
    dueDate: type === "simplified" ? "" : addDays(date, 7),
    notes: "",
    ...from,
  };
}

// Amounts. standard and plain: prices are before VAT. simplified: prices
// include VAT, and the VAT part is taken out of the total.
export function invoiceTotals(inv) {
  const type = inv.type || "standard";
  const rate = type === "plain" ? 0 : Number(inv.vatRate ?? VAT_RATE);
  const lines = (inv.items || []).map((it) => {
    const qty = Number(it.qty) || 0;
    const price = Number(it.price) || 0;
    const gross = r2(qty * price);
    if (type === "simplified") {
      const net = r2(gross / (1 + rate / 100));
      return { qty, price, net, vat: r2(gross - net), total: gross };
    }
    const vat = r2((gross * rate) / 100);
    return { qty, price, net: gross, vat, total: r2(gross + vat) };
  });
  const discount = r2(Math.max(0, Number(inv.discount) || 0));
  const lineNet = r2(lines.reduce((s, l) => s + l.net, 0));
  const lineTotal = r2(lines.reduce((s, l) => s + l.total, 0));
  let taxable, vat, total;
  if (type === "simplified") {
    // the discount comes off the amount the customer pays
    total = r2(lineTotal - discount);
    taxable = r2(total / (1 + rate / 100));
    vat = r2(total - taxable);
  } else {
    taxable = r2(lineNet - discount);
    vat = discount ? r2((taxable * rate) / 100) : r2(lines.reduce((s, l) => s + l.vat, 0));
    total = r2(taxable + vat);
  }
  return { rate, lines, subtotal: type === "simplified" ? lineTotal : lineNet, discount, taxable, vat, total };
}

// ---- ZATCA QR (phase 1): TLV of seller name, VAT number, time stamp,
// total with VAT and the VAT amount, in Base64.
const utf8 = (s) => new TextEncoder().encode(String(s ?? ""));
export function tlv(fields) {
  const parts = [];
  fields.forEach((v, i) => {
    const b = utf8(v);
    if (b.length > 255) throw new Error("قيمة أطول من المسموح في رمز QR");
    parts.push(i + 1, b.length, ...b);
  });
  return new Uint8Array(parts);
}
const b64 = (bytes) => {
  let s = "";
  bytes.forEach((x) => { s += String.fromCharCode(x); });
  return btoa(s);
};

// issue date and time are Saudi time; the QR carries them in UTC
export function qrTimestamp(date, time) {
  const t = /^\d{2}:\d{2}(:\d{2})?$/.test(time || "") ? (time.length === 5 ? time + ":00" : time) : "00:00:00";
  const d = new Date(`${date}T${t}+03:00`);
  return isNaN(d) ? "" : d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function zatcaQR(inv, totals = invoiceTotals(inv)) {
  return b64(tlv([
    inv.seller?.name || "",
    inv.seller?.vat || "",
    qrTimestamp(inv.issueDate, inv.issueTime),
    totals.total.toFixed(2),
    totals.vat.toFixed(2),
  ]));
}

// what the invoice still lacks before it can be issued
export function missing(inv) {
  const out = [];
  const s = inv.seller || {};
  if (!s.name) out.push("اسم المنشأة");
  if (inv.type !== "plain" && !/^3\d{13}3$/.test(s.vat || "")) out.push("الرقم الضريبي للمنشأة (15 رقما يبدأ وينتهي بـ 3)");
  if (inv.type === "standard") {
    if (!inv.buyer?.name) out.push("اسم المشتري");
    if (inv.buyer?.vat && !/^3\d{13}3$/.test(inv.buyer.vat)) out.push("الرقم الضريبي للمشتري غير صحيح");
  }
  if (!(inv.items || []).some((i) => i.title && Number(i.qty) > 0)) out.push("خدمة واحدة على الأقل");
  return out;
}

export const addressLines = (p = {}) => [
  [p.building, p.street, p.district].filter(Boolean).join("، "),
  [p.city, p.postal].filter(Boolean).join("، ") + (p.city || p.postal ? "، المملكة العربية السعودية" : ""),
].filter(Boolean);
