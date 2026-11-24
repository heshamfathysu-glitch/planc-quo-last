import fs from "fs";
import { Solid, parseSections, sectionsText } from "../src/pdf/solid.js";
import { composeQuote } from "../src/lib/compose.js";

const rd = (p) => new Uint8Array(fs.readFileSync(p));
const assets = {
  fontRegular: rd("src/assets/fonts/IBMPlexSansArabic-Regular.ttf"),
  fontBold: rd("src/assets/fonts/IBMPlexSansArabic-Bold.ttf"),
  logo: rd("src/assets/logo_signature.png"),
  logoCover: rd("src/assets/logo_signature_cover.png"),
};
// made-up figures and bank details: the repository is public
const pricing = { services: {} };
const seller = { name: "منشأة تجريبية", name_en: "Test Est.", cr: "1000000000", holder: "منشأة تجريبية", bank: "بنك تجريبي", bank_en: "Test Bank", account: "000111", iban: "SA00 0000 0000 0000 0000 0000" };
// draw a quote and keep every string written on the pages
function buildSolid(data, assets, pricing, opts) {
  const q = new Solid(data, assets, pricing, opts);
  const seen = [];
  const draw = q.c.text.bind(q.c);
  q.c.text = (t, ...rest) => { seen.push(String(t)); return draw(t, ...rest); };
  const doc = q.build();
  doc.seen = seen.join("\n");
  return { doc };
}
const text = (doc) => doc.seen;

for (const template of ["solid", "solid_en"]) {
  const data = composeQuote({ addressedTo: "عميل تجريبي", issueDate: "2026-11-01", validDays: 5, template, services: ["custom"], custom: { items: [{ title: "خدمة", price: 500 }] } }, pricing);
  if (data.template !== template) throw new Error("template not kept: " + data.template);
  // cover, scope, pricing
  const { doc } = buildSolid(data, assets, pricing, { seller });
  if (doc.getNumberOfPages() !== 3) throw new Error(`${template} pages ${doc.getNumberOfPages()}`);
  if (!text(doc).includes("SA00 0000")) throw new Error(template + ": bank details missing");
  // no IBAN in the settings: no bank table
  if (text(buildSolid(data, assets, pricing, { seller: {} }).doc).includes("SA00 0000")) throw new Error("bank table without an IBAN");
  // the English labels in the English template
  const en = text(doc).includes("Scope of Work");
  if (en !== (template === "solid_en")) throw new Error(template + ": wrong language");
}

// the editor's text form of the sections round-trips
const secs = parseSections("# The Shoot | STABLE SHOOT\nOne shoot.\n- Location | Stable\n- Duration | 5 hours\n\n# Deliverables\n- 10 Reels | Edited");
if (secs.length !== 2 || secs[0].tag !== "STABLE SHOOT" || secs[0].cells.length !== 2 || secs[1].cells[0].text !== "Edited") throw new Error("sections " + JSON.stringify(secs));
if (JSON.stringify(parseSections(sectionsText(secs))) !== JSON.stringify(secs)) throw new Error("sections round trip");

// many sections continue on more pages; "-" hides the chips
const big = composeQuote({ addressedTo: "x", issueDate: "2026-11-01", validDays: 5, template: "solid_en", services: ["custom"], custom: { items: [{ title: "a", price: 1 }] } }, pricing);
big.solid_en = { chips: "-", sections: Array.from({ length: 6 }, (_, i) => ({ title: `Part ${i + 1}`, text: "Some words about this part of the work.", cells: [{ title: "One", text: "a" }, { title: "Two", text: "b" }, { title: "Three", text: "c" }, { title: "Four", text: "d" }] })) };
const bigDoc = buildSolid(big, assets, pricing, { seller }).doc;
if (bigDoc.getNumberOfPages() < 4) throw new Error("long scope pages " + bigDoc.getNumberOfPages());
if (text(bigDoc).includes("What You Get")) throw new Error("chips not hidden");

console.log("solid: ok");
