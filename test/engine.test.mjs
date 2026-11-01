import fs from "fs";
import { buildQuote, pickIcon } from "../src/pdf/engine.js";
import { composeQuote } from "../src/lib/compose.js";

const rd = (p) => new Uint8Array(fs.readFileSync(p));
const assets = { fontRegular: rd("src/assets/fonts/IBMPlexSansArabic-Regular.ttf"), fontBold: rd("src/assets/fonts/IBMPlexSansArabic-Bold.ttf"), logo: rd("src/assets/logo_navy.png") };
const pricing = { services: { social_photo: { title: "تصوير محتوى سوشيال ميديا", desc: "{qty} صورة بسعر {price} ريال للصورة", tiers: [{ max_qty: 19, price: 3 }, { min_qty: 20, price: 2 }] } } };

const data = composeQuote({ addressedTo: "عميل تجريبي", issueDate: "2026-11-01", validDays: 7, services: ["photo", "custom"], photo: { kind: "social", qty: 30 }, custom: { items: [{ title: "خدمة", price: 500 }] }, discount: 10 }, pricing);
if (data.valid_until !== "08 / 11 / 2026") throw new Error("valid_until " + data.valid_until);
// one page per option, then the terms page (large-type template)
const shape = data.pages.map((p) => `${p.eyebrow}/${p.blocks.map((b) => b.type).join(",")}`).join(" ");
if (shape !== "عرض سعر/intro,box,banner,card,dates تفاصيل التعاون/terms,approval") throw new Error("pages " + shape);
const { doc, warnings } = buildQuote(data, assets, pricing, { titleWeight: "bold" });
const pages = doc.getNumberOfPages();
if (pages !== 2 || warnings.length) throw new Error(`pages=${pages} warnings=${JSON.stringify(warnings)}`);
// icons follow the words of a title unless one is set
for (const [t, want] of [["نطاق العمل", "target"], ["التسليم والتعديلات", "package"], ["الاستخدام والدفع والاعتماد", "wallet"], ["صلاحية العرض", "clock"], ["عنوان آخر", "check"]]) {
  if (pickIcon(undefined, t, "check") !== want) throw new Error(`icon for ${t}: ${pickIcon(undefined, t, "check")}`);
}
if (pickIcon("pen", "نطاق العمل", "check") !== "pen") throw new Error("explicit icon ignored");
// ready-made packages: each picked package is its own option, its contents are the box points
const pk = composeQuote({ addressedTo: "عميل", issueDate: "2026-11-01", services: ["realestate"], realestate: { picks: [
  { from: "a", title: "باقة أ", price: "100", includes: "نقطة أولى\nنقطة ثانية\n" },
  { title: "باقة ب", price: 200, includes: "" },
  { title: "  ", price: 5 },
] } }, pricing);
const pkShape = pk.pages.map((p) => `${p.title}/${p.blocks.map((b) => b.type).join(",")}`).join(" ");
if (pkShape !== "باقة أ/intro,box,card,dates باقة ب/intro,box,card,dates نطاق التنفيذ والاعتماد/terms,approval") throw new Error("packages " + pkShape);
if (JSON.stringify(pk.pages[0].blocks[1].lines) !== JSON.stringify(["نقطة أولى", "نقطة ثانية"])) throw new Error("package lines");
if (pk.pages[1].blocks[2].items[0].amount !== 200) throw new Error("package price");
const one = composeQuote({ issueDate: "2026-11-01", services: ["realestate"], split: false, realestate: { picks: [{ title: "أ", price: 1, includes: "س" }, { title: "ب", price: 2, includes: "ص\nع" }] } }, pricing);
if (one.pages.length !== 2 || one.pages[0].blocks[1].lines.join("|") !== "أ: س|ب: ص، ع") throw new Error("packages in one option");
if (buildQuote(pk, assets, pricing).warnings.length) throw new Error("package pdf warnings");
console.log("engine: ok,", pages, "pages");
