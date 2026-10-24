// Turns the wizard answers into a quote document in the master template's
// structure (pages > blocks), the same JSON make_quote.py reads.
import { resolveItem, cardTotals, CONTENT_LIMIT } from "../pdf/engine.js";
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
      else out.push({ sid, item: { title: `تصوير فيديو | ${vt.label.replace("تصوير ", "")}`, desc: `${count} فيديو${dur ? "، المدة " + dur : ""}`, amount: money(s.price) }, short: `${count} فيديو` });
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

export function cardHeight(card, pricing) {
  const items = card.items.map((i) => resolveItem(i, pricing));
  let h = 76;
  for (const it of items) h += it.desc ? 46 : 34;
  const t = cardTotals(card, items);
  const rows = (card.subtotal_label ? 1 : 0) + (t.disc ? 2 : 0) + (card.vat !== false ? 1 : 0);
  return h - 14 + 26 * rows + 4 + 52;
}

export function composeQuote(a, pricing, opts = {}) {
  const client = a.addressedTo || a.partyName || "العميل";
  const parts = serviceItems(a, pricing);
  const disc = Number(a.discount) || 0;
  const cards = [];
  if (a.split && parts.length > 1) {
    parts.forEach((p, i) => cards.push({
      type: "card", number: pad(i + 1), title: `الخيار ${ORDINALS[i] || i + 1} | ${p.short}`,
      items: [p.item], ...(disc ? { discount_pct: disc } : {}),
    }));
  } else if (parts.length) {
    const short = parts.length === 1 ? parts[0].short : "باقة الخدمات";
    cards.push({
      type: "card", number: "01", title: `الخيار الأول | ${short}`,
      items: parts.map((p) => p.item), ...(disc ? { discount_pct: disc } : {}),
    });
  }

  const names = [...new Set(parts.map((p) => label(SERVICES, p.sid) || p.short))];
  const what = names.length ? names.join(" و") : "خدمات إنتاج المحتوى";
  const issue = a.issueDate || todayISO();
  const valid = addDays(issue, a.validDays ?? 7);

  // page 1: info + intro + as many cards as fit; the rest move to page 2
  const first = { title: "عرض سعر رسمي", blocks: [{ type: "info" }, { type: "intro", text: `يسرنا تقديم عرض سعر لـ${what} بجودة عالية.` }] };
  const pages = [first];
  let cur = 132 + 18 + 64 + 24, page = first, prev = "intro", hasInfo = true;
  for (const c of cards) {
    const gap = prev === "card" && hasInfo ? 16 : prev === null ? 24 : 18;
    const h = cardHeight(c, pricing);
    if (cur + gap + h > CONTENT_LIMIT && page.blocks.some((b) => b.type === "card")) {
      page = { title: "خيارات إضافية", blocks: [] };
      pages.push(page);
      cur = 132; prev = null; hasInfo = false;
    }
    cur += (prev === null ? 24 : prev === "card" && hasInfo ? 16 : 18) + h;
    page.blocks.push(c);
    prev = "card";
  }
  if (cur + 22 <= CONTENT_LIMIT) page.blocks.push({ type: "note", text: "جميع الأسعار بالريال السعودي، وموضحة قبل وبعد ضريبة القيمة المضافة 15%." });

  const terms = (opts.terms || DEFAULT_TERMS).map((t) => ({ ...t }));
  if (terms.length) terms[terms.length - 1].text += ` هذا العرض صالح حتى ${fmtDate(valid).replace(/ /g, "")}.`;
  pages.push({ title: "نطاق التنفيذ والتسليم", blocks: [{ type: "terms", items: terms }, { type: "approval" }] });

  return {
    client,
    subtitle: `${what} | ${client}`,
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
