import { parseCR, parseVAT, parseAddress } from "../src/lib/docExtract.js";
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: ${JSON.stringify(a)}`); };

// English CR certificate (Ministry of Commerce), made-up company
eq(parseCR(["Commercial Registration Certificate", "Basic data of the commercial register", "Sample Trading", "Company", "National Number : 7000000001", "Release date : 01/01/2026", "Status : Active", "7000000001"]),
  { cr: "7000000001", name: "Sample Trading Company" }, "english cr");

// Arabic CR certificate with Arabic-Indic digits; the CR reader ignores VAT numbers
eq(parseCR(["شهادة السجل التجاري", "الاسم التجاري : شركة النموذج للتجارة", "الرقم الوطني الموحد : ٧٠٠٠٠٠٠٠٠٢", "الرقم الضريبي 300000000000003"]),
  { cr: "7000000002", name: "شركة النموذج للتجارة" }, "arabic cr");

// VAT registration certificate (ZATCA), label and value on separate lines
eq(parseVAT(["شهادة تسجيل في ضريبة القيمة المضافة", "VAT Registration Certificate", "اسم المكلف", "شركة النموذج للتجارة", "رقم التسجيل الضريبي", "٣٠٠٠٠٠٠٠٠٠٠٠٠٠٣", "تاريخ التسجيل 01/01/2026"]),
  { vat: "300000000000003", name: "شركة النموذج للتجارة" }, "vat arabic");
eq(parseVAT(["VAT Registration Number: 3 1 0 0 0 0 0 0 0 0 0 0 0 0 3", "Taxpayer Name: Sample Trading Company"]),
  { vat: "310000000000003", name: "Sample Trading Company" }, "vat english boxes");
eq(parseVAT(["Commercial Registration Certificate", "National Number : 7000000001"]), {}, "vat on a cr file");

// national address proof: digits in boxes, label on one line and value on the next
eq(parseAddress(["Name Sample Trading Company", "Building No.", "1 2 3 4", "Street", "King Road", "District", "Al Sample Dist.", "Secondary No.", "5 6 7 8", "Postal Code", "1 2 3 4 5", "City", "RIYADH"]),
  { name: "Sample Trading Company", building: "1234", postal: "12345", secondary: "5678", street: "King Road", district: "Al Sample Dist.", city: "RIYADH" }, "address");
console.log("docExtract: ok");
