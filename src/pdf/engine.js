// PLAN C quotation PDF engine.
// Line-for-line port of make_quote.py (the master Gloria Jeans style).
// Every measurement below was taken from that file. Do NOT edit the layout
// constants: a quote only changes its data. Colors and font weight come from
// the theme, whose defaults are the master values.
import { jsPDF } from "jspdf";
import { ar } from "./arabic.js";

// Text arrives already shaped and in visual order (see arabic.js). jsPDF's own
// Arabic parser would shape it a second time and break lam-alef pairs.
jsPDF.API.events = jsPDF.API.events.filter(([name]) => name !== "preProcessText");
jsPDF.API.processArabic = undefined;

export const MASTER_THEME = {
  navy: [5, 3, 77],       // #05034D
  ink: [20, 19, 58],      // #14133A
  muted: [107, 111, 134], // #6B6F86
  line: [220, 224, 234],  // #DCE0EA
  head: [238, 240, 249],  // #EEF0F9 card header / badges
  panel: [244, 245, 250], // #F4F5FA info + approval panels
  red: [179, 38, 30],     // #B3261E discount
  white: [255, 255, 255],
  titleWeight: "regular", // "regular" | "bold" for titles and totals
};

const PW = 595.2755905511812; // A4 width
const ML = 41.5;
const MR = PW - ML;
const CW = MR - ML;
const IR = MR - 18;
const IL = ML + 18;
const AX = ML + 24;
const LW = 0.8;
const R = 6;
const HEADER_LINE = 132;
const FOOTER_LINE = 797;
export const CONTENT_LIMIT = 785;
const VAT_RATE = 15;


export function fmt(n) {
  n = Math.round(Number(n) * 100) / 100;
  let s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  s = s.replace(/0+$/, "").replace(/\.$/, "");
  return (n < 0 ? "-" : "") + s;
}

// python round(): banker's rounding on ties is irrelevant at 2dp for our values
const r2 = (n) => Math.round(n * 100) / 100;

function pyFormat(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
}

export function unitPrice(service, qty, pricing) {
  const s = pricing.services[service];
  if (!s) throw new Error(`unknown service ${service}`);
  for (const t of s.tiers) {
    if ((t.min_qty ?? 0) <= qty && qty <= (t.max_qty ?? 1e9)) return t.price;
  }
  throw new Error(`no price tier for ${service} qty=${qty}`);
}

export function resolveItem(item, pricing) {
  item = { ...item };
  if ("service" in item && !("amount" in item)) {
    const qty = item.qty;
    const price = item.unit_price || unitPrice(item.service, qty, pricing);
    item.amount = qty * price;
    if (!("desc" in item)) item.desc = pyFormat(pricing.services[item.service].desc, { qty, price: fmt(price) });
    if (!("title" in item)) item.title = pricing.services[item.service].title;
  }
  return item;
}

export function cardTotals(b, items, vatRate = VAT_RATE) {
  const base = "price" in b ? b.price : items.filter((i) => "amount" in i).reduce((s, i) => s + i.amount, 0);
  const disc = b.discount_pct || 0;
  const discount = r2((base * disc) / 100);
  const net = base - discount;
  const vat = b.vat !== false ? r2((net * vatRate) / 100) : 0;
  return { base, disc, discount, net, vat, total: net + vat };
}

function toBinaryString(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return s;
}

class Quote {
  constructor(data, assets, pricing, theme) {
    this.d = data;
    this.t = { ...MASTER_THEME, ...(theme || {}) };
    this.pricing = pricing;
    this.vat = data.vat_rate ?? VAT_RATE;
    this.logo = assets.logo;
    this.warnings = [];
    const c = (this.c = new jsPDF({ unit: "pt", format: "a4", compress: true }));
    c.addFileToVFS("PlexAr-Regular.ttf", toBinaryString(assets.fontRegular));
    c.addFont("PlexAr-Regular.ttf", "PlexAr", "normal", "Identity-H");
    if (assets.fontBold) {
      c.addFileToVFS("PlexAr-Bold.ttf", toBinaryString(assets.fontBold));
      c.addFont("PlexAr-Bold.ttf", "PlexAr", "bold", "Identity-H");
    }
    this.hasBold = !!assets.fontBold;
    c.setDocumentProperties({ title: data.pdf_title || "عرض سعر - " + data.client, author: "PLAN C" });
  }

  font(size, weight) {
    const w = weight === "bold" && this.hasBold ? "bold" : "normal";
    this.c.setFont("PlexAr", w);
    this.c.setFontSize(size);
  }
  emph() { return this.t.titleWeight; }

  width(text, size, weight) {
    this.font(size, weight);
    return this.c.getTextWidth(ar(text));
  }

  wrap(text, size, maxW) {
    const lines = [];
    let cur = "";
    for (const word of String(text).split(" ")) {
      const cand = (cur + " " + word).trim();
      if (cur && this.width(cand, size) > maxW) { lines.push(cur); cur = word; }
      else cur = cand;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // text helpers; base is the top-based baseline, as in make_quote.py
  draw(x, base, text, size, color, align, weight) {
    const c = this.c;
    this.font(size, weight);
    c.setTextColor(...color);
    const s = ar(text);
    const w = c.getTextWidth(s);
    const dx = align === "right" ? -w : align === "center" ? -w / 2 : 0;
    c.text(s, x + dx, base, { baseline: "alphabetic", isInputVisual: true, isOutputVisual: true });
  }
  rtext(x, b, t, s, col, w) { this.draw(x, b, t, s, col, "right", w); }
  ltext(x, b, t, s, col, w) { this.draw(x, b, t, s, col, "left", w); }
  ctext(x, b, t, s, col, w) { this.draw(x, b, t, s, col, "center", w); }

  hline(top, x0 = ML, x1 = MR, dash = false) {
    const c = this.c;
    c.setDrawColor(...this.t.line);
    c.setLineWidth(LW);
    if (dash) c.setLineDashPattern([2, 2], 0);
    c.line(x0, top, x1, top);
    if (dash) c.setLineDashPattern([], 0);
  }

  rrect(x, top, w, h, color, r = R) {
    this.c.setFillColor(...color);
    this.c.roundedRect(x, top, w, h, r, r, "F");
  }

  pageFrame(page, n, total) {
    const c = this.c, t = this.t;
    c.setFillColor(...t.navy);
    c.rect(0, 0, PW, 5.5, "F");
    // logo at 75% of the master size, kept on the same vertical centre
    if (this.logo) c.addImage(this.logo, "PNG", ML, 51.20789, 108, 50.39367, "logo", "FAST");
    this.rtext(MR, 73, page.title, 22, t.navy, this.emph());
    this.rtext(MR, 95, page.subtitle || this.d.subtitle, 9.5, t.muted);
    this.hline(HEADER_LINE);
    this.hline(FOOTER_LINE);
    this.ltext(ML, 813, "PLAN C  /  CREATIVE SOLUTIONS", 6.5, t.muted);
    this.rtext(MR, 813, `${this.d.quote_no}   |   ${n} / ${total}`, 6.5, t.muted);
  }

  info(top) {
    const t = this.t;
    this.rrect(ML, top, CW, 64, t.panel);
    const colw = (CW - 32) / 4;
    const cols = [
      ["مقدم إلى", this.d.client, 13],
      ["تاريخ الإصدار", this.d.issue_date, 10],
      ["صالح حتى", this.d.valid_until, 10],
      ["رقم العرض", this.d.quote_no, 9],
    ];
    cols.forEach(([label, value, size], i) => {
      const x = MR - 16 - i * colw;
      this.rtext(x, top + 19, label, 7.5, t.muted);
      this.rtext(x, top + 44, value, size, t.ink);
    });
    return top + 64;
  }

  intro(base, text) { this.rtext(MR, base, text, 9.5, this.t.ink); return base; }
  note(base, text) { this.rtext(MR, base, text, 8.5, this.t.muted); return base; }

  card(top, b) {
    const c = this.c, t = this.t;
    const items = b.items.map((i) => resolveItem(i, this.pricing));

    let y = top + 76;
    for (const it of items) y += it.desc ? 46 : 34;
    const lineY = y - 14;
    const rows = this.summaryRows(b, items);
    const navyTop = lineY + 26 * rows.length + 4;
    const bottom = navyTop + 52;

    c.setDrawColor(...t.line);
    c.setLineWidth(LW);
    c.setFillColor(...t.white);
    c.roundedRect(ML, top, CW, bottom - top, R, R, "FD");
    this.rrect(ML, top, CW, 48, t.head);
    c.rect(ML, top + 40, CW, 8, "F");
    this.hline(top + 48);
    c.setDrawColor(...t.line);
    c.roundedRect(ML, top, CW, bottom - top, R, R, "S");

    this.rtext(IR, top + 29, b.title, 13, t.navy, this.emph());
    this.ltext(IL, top + 29, b.number, 12, t.navy, this.emph());

    let ty = top + 76;
    for (const it of items) {
      const desc = it.desc;
      this.rtext(IR, ty, it.title, 10, t.ink);
      if (desc) this.rtext(IR, ty + 16, desc, 7.5, t.muted);
      if ("amount" in it) this.ltext(AX, ty + (desc ? 11 : 5), fmt(it.amount), 16, t.navy);
      else this.ltext(AX, ty + (desc ? 9 : 3), it.value, 12, t.navy);
      ty += desc ? 46 : 34;
    }

    y = lineY;
    for (const [label, value, lcol, vcol] of rows) {
      this.hline(y, IL, IR, true);
      this.rtext(IR, y + 15, label, 9, lcol);
      this.ltext(AX, y + 15, fmt(value), 11.5, vcol);
      y += 26;
    }

    this.rrect(ML, navyTop, CW, 52, t.navy);
    const total = cardTotals(b, items, this.vat).total;
    const tw = this.width(fmt(total), 24, this.emph());
    this.ltext(AX, navyTop + 35, fmt(total), 24, t.white, this.emph());
    this.ltext(AX + tw + 22, navyTop + 32, "SAR", 7, t.white);
    this.rtext(IR, navyTop + 31, b.total_label || "الإجمالي شامل الضريبة", 10, t.white);
    return bottom;
  }

  summaryRows(b, items) {
    const t = this.t;
    const { base, disc, discount, net, vat } = cardTotals(b, items, this.vat);
    const rows = [];
    if (b.subtotal_label) rows.push([b.subtotal_label, base, t.ink, t.navy]);
    if (disc) {
      rows.push([`خصم ${fmt(disc)}%`, -discount, t.ink, t.red]);
      rows.push(["الإجمالي بعد الخصم", net, t.ink, t.navy]);
    }
    if (b.vat !== false) rows.push([`ضريبة القيمة المضافة ${fmt(this.vat)}%`, vat, t.muted, t.muted]);
    return rows;
  }

  terms(top, b) {
    const t = this.t;
    let last = null;
    b.items.forEach((it, i) => {
      if (i) { this.hline(last + 21); top = last + 21 + 16; }
      const num = it.number || String(i + 1).padStart(2, "0");
      this.rrect(MR - 28, top, 28, 19, t.head, 3);
      this.ctext(MR - 14, top + 13, num, 9, t.navy);
      this.rtext(MR - 40, top + 14, it.title, 11.5, t.navy, this.emph());
      const base = top + 38;
      const lines = this.wrap(it.text, 8.8, CW);
      lines.forEach((line, j) => this.rtext(MR, base + 17 * j, line, 8.8, t.muted));
      last = base + 17 * Math.max(lines.length - 1, 0);
    });
    return last;
  }

  // ---- additions to the master: same frame, colors and type scale ----
  // image (PNG/JPEG logo or chart), right aligned like the text column
  image(top, b) {
    if (!b.src) return top;
    const w = (CW * Math.min(100, Math.max(10, b.width_pct || 100))) / 100;
    const h = b.ratio ? w * b.ratio : 160;
    const x = b.align === "center" ? ML + (CW - w) / 2 : b.align === "left" ? ML : MR - w;
    const fmtName = /^data:image\/jpe?g/.test(b.src) ? "JPEG" : "PNG";
    this.c.addImage(b.src, fmtName, x, top, w, h, undefined, "FAST");
    let bottom = top + h;
    if (b.caption) { this.draw(b.align === "center" ? x + w / 2 : b.align === "left" ? x : MR, bottom + 16, b.caption, 8.5, this.t.muted, b.align === "center" ? "center" : b.align === "left" ? "left" : "right"); bottom += 16; }
    return bottom;
  }

  // bar chart drawn as vectors in the template colors
  chart(top, b) {
    const t = this.t, c = this.c;
    const rows = (b.rows || []).filter((r) => r.label || r.value);
    let y = top;
    if (b.title) { this.rtext(MR, y + 12, b.title, 11.5, t.navy, this.emph()); y += 26; }
    const n = Math.max(rows.length, 1);
    const max = Math.max(1, ...rows.map((r) => Number(r.value) || 0));
    const plotH = 120, labelH = 30;
    this.rrect(ML, y, CW, plotH + labelH + 24, t.panel);
    const x0 = ML + 16, x1 = MR - 16, base = y + 12 + plotH;
    const slot = (x1 - x0) / n, bw = Math.min(46, slot * 0.55);
    c.setDrawColor(...t.line); c.setLineWidth(LW); c.line(x0, base, x1, base);
    rows.forEach((r, i) => {
      // first row on the right (reading order)
      const cx = x1 - slot * (i + 0.5);
      const v = Number(r.value) || 0;
      const h = (v / max) * (plotH - 18);
      c.setFillColor(...(i === 0 || !b.highlight_first ? t.navy : t.head));
      if (h > 0) c.roundedRect(cx - bw / 2, base - h, bw, h, 3, 3, "F");
      this.ctext(cx, base - h - 5, fmt(v), 8, t.ink);
      this.ctext(cx, base + 15, r.label || "", 8, t.muted);
    });
    return y + plotH + labelH + 24;
  }

  approval(top) {
    const t = this.t;
    this.rrect(ML, top, CW, 66, t.panel);
    this.rtext(MR - 16, top + 24, "اعتماد العرض", 10, t.ink);
    this.rtext(MR - 16, top + 50, "الخيار المختار: __________________", 8.5, t.muted);
    this.rtext(MR - 200, top + 50, "الاسم والتاريخ: __________________", 8.5, t.muted);
    return top + 66;
  }

  build() {
    const pages = this.d.pages;
    pages.forEach((page, idx) => {
      const n = idx + 1;
      if (idx) this.c.addPage();
      this.pageFrame(page, n, pages.length);
      let cur = HEADER_LINE, prev = null;
      const hasInfo = page.blocks.some((b) => b.type === "info");
      for (const b of page.blocks) {
        const k = b.type;
        if (k === "info") cur = this.info(cur + 18);
        else if (k === "intro") cur = this.intro(cur + 24, b.text);
        else if (k === "card") {
          const gap = prev === null ? 24 : prev === "card" && hasInfo ? 16 : 18;
          cur = this.card(cur + gap, b);
        } else if (k === "note") cur = this.note(cur + 22, b.text);
        else if (k === "terms") cur = this.terms(cur + 20, b);
        else if (k === "approval") cur = this.approval(cur + 42);
        else if (k === "image") cur = this.image(cur + (prev === null ? 24 : 18), b);
        else if (k === "chart") cur = this.chart(cur + (prev === null ? 24 : 18), b);
        else throw new Error(`unknown block type ${k}`);
        prev = k;
      }
      if (cur > CONTENT_LIMIT) this.warnings.push({ page: n, overflow: Math.round(cur - CONTENT_LIMIT) });
    });
    return this.c;
  }
}

// Returns { doc, warnings }. assets: { fontRegular, fontBold?, logo } as Uint8Array.
export function buildQuote(data, assets, pricing, theme) {
  const q = new Quote(data, assets, pricing, theme);
  const doc = q.build();
  return { doc, warnings: q.warnings };
}
