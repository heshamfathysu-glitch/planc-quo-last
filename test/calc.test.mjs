import { serviceLine, bundleLine, bundleDesc, totals } from "../src/lib/calc.js";

// made-up prices: the real list lives in Firestore, never in the repo
const pricing = {
  services: {
    reel: { title: "ريلز", desc: "{qty} ريلز بسعر {price} ريال للريل", tiers: [{ max_qty: 1, price: 30 }, { min_qty: 2, max_qty: 3, price: 20 }, { min_qty: 4, price: 10 }] },
    photo: { title: "صور", desc: "{qty} صورة بسعر {price} ريال للصورة", tiers: [{ max_qty: 19, price: 5 }, { min_qty: 20, price: 3 }] },
  },
  bundles: [{ id: "b1", title: "باقة", price: 90, items: [{ service: "reel", qty: 8 }, { service: "photo", qty: 10 }] }],
};
const eq = (a, b, what) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };

eq(serviceLine("reel", 0, pricing), null, "zero qty");
const one = serviceLine("reel", 1, pricing);
eq([one.unit, one.amount, one.word, one.next], [30, 30, "ريل", { qty: 2, add: 1, unit: 20 }], "one reel");
const three = serviceLine("reel", 3, pricing);
eq([three.unit, three.amount, three.next], [20, 60, { qty: 4, add: 1, unit: 10 }], "three reels");
eq(serviceLine("reel", 9, pricing).next, undefined, "last tier has no hint");
eq(serviceLine("photo", 20, pricing).amount, 60, "photo tier");

const b = bundleLine(pricing.bundles[0], 2, pricing);
eq([b.amount, b.value, b.saving], [180, 260, 80], "bundle x2"); // 8×10 + 10×5 = 130 each
eq(bundleDesc(pricing.bundles[0], pricing), "8 × ريلز + 10 × صور", "bundle desc");

const t = totals([100, 100], 10, 50);
eq([t.base, t.discount, t.net, t.vat, t.total, t.profit, t.margin], [200, 20, 180, 27, 207, 130, 72], "totals");
eq(totals([100], 150, 0).net, 0, "discount capped at 100%");
console.log("calc: ok");
