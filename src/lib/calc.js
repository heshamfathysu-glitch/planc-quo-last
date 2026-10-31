// Price calculator maths. Prices come from settings/pricing (Admin > قائمة
// الأسعار), never from the code: `pricing.services` holds the tiered unit
// prices and the optional `pricing.bundles` the fixed-price packages.
import { unitPrice, VAT_RATE } from "../pdf/engine.js";

const r2 = (n) => Math.round(n * 100) / 100;
const unitWord = (s) => (s?.desc?.match(/ريال (لل\S+)/) || [])[1]?.replace(/^لل/, "") || "وحدة";

// one priced service at a quantity, plus the next cheaper tier if there is one
export function serviceLine(id, qty, pricing) {
  const s = pricing?.services?.[id];
  qty = Math.max(0, Math.floor(Number(qty) || 0));
  if (!s || !qty) return null;
  let unit;
  try { unit = unitPrice(id, qty, pricing); } catch { return { id, title: s.title, qty, unit: 0, amount: 0, missing: true }; }
  const next = s.tiers
    .filter((t) => (t.min_qty ?? 0) > qty && t.price < unit)
    .sort((a, b) => (a.min_qty ?? 0) - (b.min_qty ?? 0))[0];
  return {
    id, title: s.title, qty, unit, amount: qty * unit, word: unitWord(s),
    ...(next ? { next: { qty: next.min_qty, add: next.min_qty - qty, unit: next.price } } : {}),
  };
}

// what a bundle's contents would cost at list prices
export function bundleValue(b, pricing) {
  let value = 0;
  for (const it of b.items || []) {
    const line = serviceLine(it.service, it.qty, pricing);
    if (line) value += line.amount;
  }
  return value;
}

// "8 ريلز سوشيال + 20 صورة"
export function bundleDesc(b, pricing) {
  return (b.items || [])
    .filter((it) => Number(it.qty) > 0 && pricing?.services?.[it.service])
    .map((it) => `${it.qty} × ${pricing.services[it.service].title}`)
    .join(" + ");
}

export function bundleLine(b, count, pricing) {
  count = Math.max(0, Math.floor(Number(count) || 0));
  if (!count) return null;
  const price = Number(b.price) || 0;
  const value = bundleValue(b, pricing);
  return { title: b.title, qty: count, unit: price, amount: count * price, value: value * count, saving: value > price ? (value - price) * count : 0 };
}

// subtotal → discount → VAT, then profit after the internal cost (before VAT)
export function totals(amounts, discountPct, cost, vatRate = VAT_RATE) {
  const base = amounts.reduce((s, a) => s + (Number(a) || 0), 0);
  const disc = Math.min(100, Math.max(0, Number(discountPct) || 0));
  const discount = r2((base * disc) / 100);
  const net = r2(base - discount);
  const vat = r2((net * vatRate) / 100);
  const c = Number(cost) || 0;
  const profit = r2(net - c);
  return { base, disc, discount, net, vat, total: r2(net + vat), cost: c, profit, margin: net ? Math.round((profit / net) * 100) : 0 };
}
