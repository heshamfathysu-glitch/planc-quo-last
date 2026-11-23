import { parseCompanyDoc } from "../src/lib/docExtract.js";
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: ${JSON.stringify(a)}`); };

// English CR certificate (Ministry of Commerce), made-up company
eq(parseCompanyDoc(["Commercial Registration Certificate", "Basic data of the commercial register", "Sample Trading", "Company", "National Number : 7000000001", "Release date : 01/01/2026", "Status : Active", "7000000001"]),
  { cr: "7000000001", name: "Sample Trading Company" }, "english cr");

// Arabic certificate with Arabic-Indic digits and a VAT number
eq(parseCompanyDoc(["شهادة السجل التجاري", "الاسم التجاري : شركة النموذج للتجارة", "الرقم الوطني الموحد : ٧٠٠٠٠٠٠٠٠٢", "الرقم الضريبي 300000000000003"]),
  { vat: "300000000000003", cr: "7000000002", name: "شركة النموذج للتجارة" }, "arabic cr");

// national address proof: digits in boxes, label on one line and value on the next
eq(parseCompanyDoc(["Name Sample Trading Company", "Building No.", "1 2 3 4", "Street", "King Road", "District", "Al Sample Dist.", "Secondary No.", "5 6 7 8", "Postal Code", "1 2 3 4 5", "City", "RIYADH"]),
  { name: "Sample Trading Company", building: "1234", postal: "12345", secondary: "5678", street: "King Road", district: "Al Sample Dist.", city: "RIYADH" }, "address");
console.log("docExtract: ok");
