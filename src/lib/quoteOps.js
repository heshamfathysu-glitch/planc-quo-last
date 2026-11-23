// Actions shared by the quotes log, the editor and the packages tab:
// add items to a quote, duplicate it, turn it into an invoice, or start a new
// quote from a package. They only change the quote's data; the PDF template
// (src/pdf/engine.js) draws it the same way as before.
import { put, list, getSetting } from "./store.js";
import { resolveItem } from "../pdf/engine.js";
import { DEFAULT_TERMS } from "../data/catalog.js";
import { addDays, fmtDate, todayISO, quoteNumber, quoteTotal } from "./compose.js";
import { newInvoice, invoiceTotals } from "./invoice.js";

// the price card of the first option, and the "what it includes" box before it
export function firstCard(data) {
  for (let pi = 0; pi < (data?.pages || []).length; pi++) {
    const bi = data.pages[pi].blocks.findIndex((b) => b.type === "card");
    if (bi >= 0) return { pi, bi, block: data.pages[pi].blocks[bi] };
  }
  return null;
}

export function cardItems(data, pricing) {
  const c = firstCard(data);
  if (!c) return [];
  return (c.block.items || []).map((it) => {
    try { return resolveItem(it, pricing || { services: {} }); } catch { return { ...it, amount: Number(it.amount) || 0 }; }
  });
}

// add items (and their "includes" lines) to the first option; a quote with no
// price card gets one on its first page, before the dates line
export function addItems(data, items, lines = []) {
  const pages = data.pages.map((p) => ({ ...p, blocks: [...p.blocks] }));
  let c = firstCard({ pages });
  if (!c) {
    const page = pages[0];
    const at = page.blocks.findIndex((b) => b.type === "dates" || b.type === "info" || b.type === "terms" || b.type === "approval");
    page.blocks.splice(at < 0 ? page.blocks.length : at, 0, { type: "card", brief: true, items: [] });
    c = firstCard({ pages });
  }
  const page = pages[c.pi];
  page.blocks[c.bi] = { ...c.block, items: [...(c.block.items || []).filter((it) => it.title || it.service || Number(it.amount)), ...items] };
  if (lines.length) {
    const bx = page.blocks.findIndex((b, i) => i < c.bi && b.type === "box" && !b.bank);
    if (bx >= 0) page.blocks[bx] = { ...page.blocks[bx], lines: [...(page.blocks[bx].lines || []).filter(Boolean), ...lines] };
    else page.blocks.splice(c.bi, 0, { type: "box", title: "ماذا يشمل هذا الخيار؟", lines });
  }
  return { ...data, pages };
}

export function removeItem(data, index) {
  const c = firstCard(data);
  if (!c) return data;
  const pages = data.pages.map((p, pi) => (pi !== c.pi ? p : {
    ...p, blocks: p.blocks.map((b, bi) => (bi !== c.bi ? b : { ...b, items: b.items.filter((_, i) => i !== index) })),
  }));
  return { ...data, pages };
}

export async function duplicateQuote(q, user) {
  const { id: _id, createdAt: _c, updatedAt: _u, history: _h, ...rest } = q;
  return put("quotes", {
    ...rest,
    status: "draft",
    history: [],
    ...(q.data ? { data: { ...q.data, quote_no: q.data.quote_no + "-2" } } : {}),
  }, user);
}

// a draft invoice with the quote's client, subject, items and discount; the
// model follows the seller settings (VAT number set = tax invoice)
export async function quoteToInvoice(q, pricing, user) {
  const [seller, all] = await Promise.all([getSetting("seller", null), list("invoices")]);
  const c = firstCard(q.data);
  const items = cardItems(q.data, pricing).map((it) => ({ title: it.title || "", desc: it.desc || "", qty: 1, price: Number(it.amount) || 0 }));
  const base = items.reduce((s, it) => s + it.price, 0);
  const disc = Number(c?.block.discount_pct) || 0;
  const inv = newInvoice(seller?.vat ? "standard" : "plain", all, seller, {
    subject: q.data?.subtitle || "",
    buyer: { name: q.data?.client || "", vat: "", cr: "", building: "", street: "", district: "", city: "", postal: "" },
    items: items.length ? items : [{ title: "", desc: "", qty: 1, price: 0 }],
    discount: c?.block.discount_amount ? Number(c.block.discount_amount) : Math.round(base * disc) / 100,
    quoteId: q.id,
    notes: q.data?.quote_no ? `بناء على عرض السعر ${q.data.quote_no}` : "",
  });
  return put("invoices", { ...inv, total: invoiceTotals(inv).total }, user);
}

// a quote made straight from a package (Admin > الباقات): the client name is
// left for the team to fill in the editor
export async function quoteFromPackage(pkg, user) {
  const lib = await getSetting("terms", null);
  const issue = todayISO();
  const valid = addDays(issue, 7);
  const day = (iso) => fmtDate(iso).replace(/ /g, "");
  const terms = (lib?.filter((t) => t.default !== false) || DEFAULT_TERMS).map((t) => ({ title: t.title, text: t.text }));
  terms.push({ title: "صلاحية العرض", text: `تاريخ الإصدار: ${day(issue)}. العرض صالح حتى ${day(valid)}.` });
  const includes = (pkg.includes || []).filter(Boolean);
  const data = {
    client: "عميل غير محدد",
    subtitle: `عرض ${pkg.title}`,
    quote_no: quoteNumber(issue),
    issue_date: fmtDate(issue),
    valid_until: fmtDate(valid),
    pages: [
      {
        eyebrow: "عرض سعر",
        title: pkg.title,
        blocks: [
          { type: "intro", text: `يسرنا تقديم عرض سعر لـ${pkg.title} بجودة عالية.` },
          ...(includes.length ? [{ type: "box", title: "ماذا يشمل هذا الخيار؟", lines: includes }] : []),
          { type: "card", brief: true, items: [{ title: pkg.title, amount: Number(pkg.price) || 0 }] },
          { type: "dates" },
        ],
      },
      { eyebrow: "تفاصيل التعاون", title: "نطاق التنفيذ والاعتماد", blocks: [{ type: "terms", items: terms }, { type: "approval" }] },
    ],
  };
  return put("quotes", {
    status: "draft",
    answers: { preparer: user.name, issueDate: issue, validDays: 7, services: [], packageId: pkg.id },
    data,
    client: data.client,
    total: quoteTotal(data, { services: {} }),
  }, user);
}
