import fs from "fs";
import { buildSignature, coverStats } from "../src/pdf/signature.js";
import { composeQuote } from "../src/lib/compose.js";
import { cardTotals } from "../src/pdf/engine.js";

const rd = (p) => new Uint8Array(fs.readFileSync(p));
const assets = {
  fontRegular: rd("src/assets/fonts/IBMPlexSansArabic-Regular.ttf"),
  fontBold: rd("src/assets/fonts/IBMPlexSansArabic-Bold.ttf"),
  fontSemi: rd("src/assets/fonts/IBMPlexSansArabic-SemiBold.ttf"),
  logo: rd("src/assets/logo_signature.png"),
  logoCover: rd("src/assets/logo_signature_cover.png"),
};
const pricing = { services: { social_photo: { title: "تصوير محتوى سوشيال ميديا", desc: "{qty} صورة بسعر {price} ريال للصورة", tiers: [{ max_qty: 19, price: 3 }, { min_qty: 20, price: 2 }] } } };

// the wizard keeps the chosen template on the quote
const data = composeQuote({ addressedTo: "عميل تجريبي", issueDate: "2026-11-01", validDays: 14, template: "signature", services: ["photo", "custom"], photo: { kind: "social", qty: 30 }, custom: { items: [{ title: "خدمة", price: 500 }] }, discount: 10 }, pricing);
if (data.template !== "signature") throw new Error("template not kept: " + data.template);
if ("template" in composeQuote({ addressedTo: "x", services: [] }, pricing)) throw new Error("classic quotes must not carry a template");

// cover + pricing page (the last row of term cards may move to a page with the signatures)
let pages = buildSignature(data, assets, pricing).doc.getNumberOfPages();
if (pages < 2 || pages > 3) throw new Error("wizard quote pages " + pages);

// a fixed discount amount (made-up figures: the repository is public)
const card = { price: 1000, discount_amount: 200, items: [{ title: "تصوير", value: "24 صورة" }, { title: "فيديو", value: "5 فيديوهات" }] };
const tot = cardTotals(card, card.items);
if (tot.net !== 800 || tot.vat !== 120 || tot.total !== 920) throw new Error("totals " + JSON.stringify(tot));
const stats = coverStats(card, card.items, tot, true).map((s) => `${s.value}|${s.label}`).join(" ");
if (stats !== "24|صورة 5|فيديوهات 800|ر.س قبل الضريبة") throw new Error("stats " + stats);

// many items and terms continue on more pages instead of running off the page
const big = structuredClone(data);
big.pages[0].blocks.find((b) => b.type === "card").items = Array.from({ length: 14 }, (_, i) => ({ title: `بند ${i + 1}`, desc: "وصف قصير للبند", amount: 100 }));
pages = buildSignature(big, assets, pricing).doc.getNumberOfPages();
if (pages < 3) throw new Error("long quote pages " + pages);

console.log("signature: ok");
