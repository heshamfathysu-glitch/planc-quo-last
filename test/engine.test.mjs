import fs from "fs";
import { buildQuote } from "../src/pdf/engine.js";
import { composeQuote } from "../src/lib/compose.js";

const rd = (p) => new Uint8Array(fs.readFileSync(p));
const assets = { fontRegular: rd("src/assets/fonts/IBMPlexSansArabic-Regular.ttf"), fontBold: rd("src/assets/fonts/IBMPlexSansArabic-Bold.ttf"), logo: rd("src/assets/logo_navy.png") };
const pricing = { services: { social_photo: { title: "تصوير محتوى سوشيال ميديا", desc: "{qty} صورة بسعر {price} ريال للصورة", tiers: [{ max_qty: 19, price: 3 }, { min_qty: 20, price: 2 }] } } };

const data = composeQuote({ addressedTo: "عميل تجريبي", issueDate: "2026-11-01", validDays: 7, services: ["photo", "custom"], photo: { kind: "social", qty: 30 }, custom: { items: [{ title: "خدمة", price: 500 }] }, discount: 10 }, pricing);
if (data.valid_until !== "08 / 11 / 2026") throw new Error("valid_until " + data.valid_until);
const { doc, warnings } = buildQuote(data, assets, pricing, { titleWeight: "bold" });
const pages = doc.getNumberOfPages();
if (pages !== 2 || warnings.length) throw new Error(`pages=${pages} warnings=${JSON.stringify(warnings)}`);
console.log("engine: ok,", pages, "pages");
