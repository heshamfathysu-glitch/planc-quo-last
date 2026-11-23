import fs from "fs";
import { buildInvoice } from "../src/pdf/invoice.js";
import { invoiceTotals, zatcaQR, tlv, nextNumber, qrTimestamp, newInvoice, missing } from "../src/lib/invoice.js";

const ok = (c, m) => { if (!c) throw new Error(m); };
const rd = (p) => new Uint8Array(fs.readFileSync(p));
const assets = { fontRegular: rd("src/assets/fonts/IBMPlexSansArabic-Regular.ttf"), fontBold: rd("src/assets/fonts/IBMPlexSansArabic-Bold.ttf"), logo: rd("src/assets/logo_navy.png") };

// made-up seller and buyer (sample data only)
const seller = { name: "منشأة تجريبية", cr: "1010000000", vat: "300000000000003", building: "1234", street: "شارع التجربة", district: "حي النموذج", city: "الرياض", postal: "12345", bank: "بنك تجريبي", iban: "SA0000000000000000000000", holder: "منشأة تجريبية" };
const items = [
  { title: "جلسة تصوير تجاري", desc: "تصوير فوتوغرافي للعلامة التجارية ومعالجة الصور", qty: 1, price: 4500 },
  { title: "إنتاج فيديو قصير", desc: "تصوير ومونتاج لكل مقطع", qty: 2, price: 1000 },
];

// the three models from the user's examples
const std = newInvoice("standard", [], seller, { number: "INV-2026-0041", issueDate: "2026-11-23", issueTime: "10:30:00", supplyDate: "2026-11-22", items, buyer: { name: "عميل تجريبي", vat: "311111111111113", city: "جدة" } });
let T = invoiceTotals(std);
ok(T.taxable === 6500 && T.vat === 975 && T.total === 7475, "standard totals " + JSON.stringify(T));
ok(!missing(std).length, "standard missing " + missing(std));

const simp = newInvoice("simplified", [], seller, { items: [{ title: "جلسة تصوير شخصية", qty: 1, price: 690 }] });
T = invoiceTotals(simp);
ok(T.taxable === 600 && T.vat === 90 && T.total === 690, "simplified totals " + JSON.stringify(T));

const plain = newInvoice("plain", [], seller, { items });
T = invoiceTotals(plain);
ok(T.vat === 0 && T.total === 6500, "plain totals");
ok(invoiceTotals({ ...plain, discount: 500 }).total === 6000, "plain discount");
ok(invoiceTotals({ ...std, discount: 500 }).total === 6900, "standard discount");

// numbering continues the year's series
ok(nextNumber([{ number: "INV-2026-0041" }, { number: "INV-2025-0099" }], "2026") === "INV-2026-0042", "next number");
ok(nextNumber([], "2027") === "INV-2027-0001", "first number");

// ZATCA TLV: tag, length, UTF-8 value; time in UTC
ok(qrTimestamp("2026-11-23", "10:30:00") === "2026-11-23T07:30:00Z", "timestamp " + qrTimestamp("2026-11-23", "10:30:00"));
ok(tlv(["ab"]).join(",") === "1,2,97,98", "tlv");
const bytes = Uint8Array.from(atob(zatcaQR(std)), (c) => c.charCodeAt(0));
const out = [];
for (let i = 0; i < bytes.length;) { const n = bytes[i + 1]; out.push([bytes[i], new TextDecoder().decode(bytes.slice(i + 2, i + 2 + n))]); i += 2 + n; }
ok(JSON.stringify(out) === JSON.stringify([[1, seller.name], [2, seller.vat], [3, "2026-11-23T07:30:00Z"], [4, "7475.00"], [5, "975.00"]]), "qr " + JSON.stringify(out));

const many = { ...std, items: Array.from({ length: 14 }, (_, i) => ({ ...items[i % 2], title: `خدمة ${i + 1}` })), notes: "يرجى السداد خلال سبعة أيام." };
for (const [name, inv, pages] of [["standard", std, 1], ["simplified", simp, 1], ["plain", plain, 1], ["long", many, 3]]) {
  const doc = buildInvoice(inv, assets);
  ok(doc.getNumberOfPages() === pages, `${name}: ${doc.getNumberOfPages()} pages`);
  if (process.env.INVOICE_OUT) fs.writeFileSync(`${process.env.INVOICE_OUT}/${name}.pdf`, Buffer.from(doc.output("arraybuffer")));
}
console.log("invoice: ok");
