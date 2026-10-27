// Turns the wizard answers into a quote document in the master template's
// structure (pages > blocks), the same JSON make_quote.py reads.
import { resolveItem, cardTotals, unitPrice, fmt } from "../pdf/engine.js";
import { SERVICES, VIDEO_TYPES, DURATIONS, ORDINALS, DEFAULT_TERMS, CLIENT_TYPES } from "../data/catalog.js";

const pad = (n) => String(n).padStart(2, "0");

export function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d} / ${m} / ${y}`;
}
export function addDays(iso, days) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + Number(days || 0));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const todayISO = () => addDays(new Date().toISOString().slice(0, 10), 0);

export function quoteNumber(iso, code) {
  const [y, m, d] = (iso || todayISO()).split("-");
  return `QUO-${y}-${code || "XX"}-${m}${d}`;
}

const label = (list, id) => list.find((x) => x.id === id)?.label || "";
const money = (v) => Number(v) || 0;

// one priced item per chosen service
export function serviceItems(a, pricing) {
  const out = [];
  for (const sid of a.services || []) {
    const s = a[sid] || {};
    if (sid === "photo") {
      const qty = Number(s.qty) || 0;
      if (!qty) continue;
      const service = s.kind === "menu" ? "menu_photo" : "social_photo";
      if (pricing?.services?.[service]) out.push({ sid, item: { service, qty }, short: `تصوير ${qty} ${s.kind === "menu" ? "منتج" : "صورة"}` });
      else out.push({ sid, item: { title: s.kind === "menu" ? "تصوير منتجات قائمة الطعام" : "تصوير محتوى سوشيال ميديا", desc: `${qty} صورة`, amount: money(s.price) }, short: `تصوير ${qty} صورة` });
    } else if (sid === "video") {
      const vt = VIDEO_TYPES.find((v) => v.id === s.type) || VIDEO_TYPES[0];
      const count = Number(s.count) || 1;
      const dur = s.duration === "custom" ? `${s.minutes || "؟"} دقيقة` : label(DURATIONS, s.duration);
      const priced = vt.pricing && pricing?.services?.[vt.pricing] && ["7-15", "15-30"].includes(s.duration) && !s.price;
      if (priced) out.push({ sid, item: { service: vt.pricing, qty: count }, short: `${count} فيديو ${vt.label.replace("تصوير ", "")}` });
      else out.push({ sid, item: { title: `تصوير فيديو | ${vt.label.replace("تصوير ", "")}`, desc: `${count} فيديو${dur ? "، المدة " + dur : ""}`, amount: money(s.price) }, short: `${count} فيديو ${vt.label.replace("تصوير ", "")}` });
    } else if (sid === "website") {
      out.push({ sid, item: { title: "تصميم موقع إلكتروني", desc: [s.pages ? `${s.pages} صفحات` : "", s.details].filter(Boolean).join("، "), amount: money(s.price) }, short: "تصميم موقع" });
    } else if (sid === "landing") {
      out.push({ sid, item: { title: "تصميم صفحة هبوط", desc: s.summary || "", amount: money(s.price) }, short: "صفحة هبوط" });
    } else if (sid === "custom") {
      for (const c of s.items || []) {
        if (c.title) out.push({ sid, item: { title: c.title, desc: c.desc || "", amount: money(c.price) }, short: c.title });
      }
    } else {
      const lbl = label(SERVICES, sid);
      out.push({ sid, item: { title: lbl, desc: s.desc || "", amount: money(s.price) }, short: lbl });
    }
  }
  return out.map((x) => ({ ...x, item: stripEmptyDesc(x.item) }));
}

function stripEmptyDesc(it) {
  if (it.desc === "") { const { desc, ...rest } = it; void desc; return rest; }
  return it;
}

// what an item includes: "تصوير محتوى سوشيال ميديا • 30 صورة بسعر 70 ريال للصورة"
function included(it, pricing) {
  try { it = resolveItem(it, pricing); } catch { /* no price tier */ }
  const title = it.title || pricing?.services?.[it.service]?.title || "";
  return it.desc ? `${title} • ${it.desc}` : title;
}

// one priced service also shows its unit price after the discount
function discountLine(disc, items, pricing) {
  const it = items[0];
  if (items.length === 1 && "service" in it && !("amount" in it)) {
    try {
      const price = it.unit_price || unitPrice(it.service, it.qty, pricing);
      const unit = (pricing.services[it.service].desc.match(/ريال (لل\S+)/) || [])[1];
      if (unit) return `خصم ${fmt(disc)}% | سعر ${unit.replace(/^لل/, "ال")} بعد الخصم: ${fmt((price * (100 - disc)) / 100)} ريال`;
    } catch { /* no price tier */ }
  }
  return `خصم ${fmt(disc)}% على قيمة ${items.length > 1 ? "الخدمات" : "الخدمة"}`;
}

// One page per option (eyebrow, big title, intro, what it includes, the
// discount, price rows and total, dates), then the terms page with approval.
export function composeQuote(a, pricing, opts = {}) {
  const client = a.addressedTo || a.partyName || "العميل";
  const parts = serviceItems(a, pricing);
  const disc = Number(a.discount) || 0;
  const options = a.split && parts.length > 1 ? parts.map((p) => [p]) : parts.length ? [parts] : [];

  const customs = parts.filter((p) => p.sid === "custom").length;
  const names = [...new Set(parts.map((p) => (p.sid !== "custom" ? label(SERVICES, p.sid) || p.short : customs > 1 ? "خدمات مخصصة" : p.short)))];
  const what = !names.length ? "خدمات إنتاج المحتوى" : names.length > 3 ? `${names[0]} وخدمات أخرى` : names.join(" و");
  const issue = a.issueDate || todayISO();
  const valid = addDays(issue, a.validDays ?? 7);
  const intro = `يسرنا تقديم عرض سعر لـ${what} بجودة عالية.`;

  const pages = options.map((group, i) => {
    const items = group.map((p) => p.item);
    const blocks = [{ type: "intro", text: intro }];
    const lines = items.map((it) => included(it, pricing)).filter(Boolean);
    if (lines.length) blocks.push({ type: "box", title: "ماذا يشمل هذا الخيار؟", lines });
    if (disc) blocks.push({ type: "banner", text: discountLine(disc, items, pricing) });
    blocks.push({ type: "card", brief: true, items, ...(disc ? { discount_pct: disc } : {}) });
    blocks.push({ type: "dates" });
    return {
      eyebrow: options.length > 1 ? `الخيار ${ORDINALS[i] || i + 1}` : "عرض سعر",
      title: group.length === 1 ? group[0].short : group.length <= 3 ? group.map((p) => p.short).join(" + ") : "باقة الخدمات",
      blocks,
    };
  });
  if (!pages.length) pages.push({ eyebrow: "عرض سعر", title: what, blocks: [{ type: "intro", text: intro }, { type: "dates" }] });

  const day = (iso) => fmtDate(iso).replace(/ /g, "");
  const terms = (opts.terms || DEFAULT_TERMS).map((t) => ({ title: t.title, text: t.text }));
  terms.push({ title: "صلاحية العرض", text: `تاريخ الإصدار: ${day(issue)}. العرض صالح حتى ${day(valid)}.` });
  pages.push({ eyebrow: "تفاصيل التعاون", title: "نطاق التنفيذ والاعتماد", blocks: [{ type: "terms", items: terms }, { type: "approval" }] });

  return {
    client,
    subtitle: `عرض ${what}`,
    quote_no: quoteNumber(issue, opts.code),
    issue_date: fmtDate(issue),
    valid_until: fmtDate(valid),
    pages,
  };
}

export function quoteTotal(data, pricing) {
  // value of the first option (what the dashboard sums)
  for (const p of data?.pages || []) for (const b of p.blocks) {
    if (b.type === "card") {
      try { return cardTotals(b, b.items.map((i) => resolveItem(i, pricing))).total; } catch { return 0; }
    }
  }
  return 0;
}

export const clientTypeLabel = (id) => label(CLIENT_TYPES, id);
