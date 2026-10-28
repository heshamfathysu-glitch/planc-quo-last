// PLAN C quotation PDF engine.
// Line-for-line port of make_quote.py; keep the two in step. The style is
// measured from the user's large-type Gloria Jeans reference (2026-10-27): one
// option per page under a small eyebrow and a big title, soft boxes, rows on
// hairlines and a green total. Do NOT edit the layout constants: a quote only
// changes its data. Colors and title weight come from the theme, whose
// defaults are the reference values.
import { jsPDF } from "jspdf";
import { ar } from "./arabic.js";
import ICONS from "./icons.json";

// Text arrives already shaped and in visual order (see arabic.js). jsPDF's own
// Arabic parser would shape it a second time and break lam-alef pairs.
jsPDF.API.events = jsPDF.API.events.filter(([name]) => name !== "preProcessText");
jsPDF.API.processArabic = undefined;

export const MASTER_THEME = {
  v: 2,                     // themes saved for the earlier template have no v
  bar: [10, 9, 64],         // top bar
  ink: [17, 20, 60],        // #11143C text
  muted: [114, 119, 138],   // #72778A subtitle, eyebrow, dates, notes
  line: [222, 227, 235],    // rules and box borders
  box: [240, 240, 252],     // lavender box, approval
  box2: [232, 242, 250],    // blue box
  banner: [255, 240, 219],  // peach banner
  bannerInk: [131, 80, 28], // #83501C banner text
  totalBg: [222, 242, 224], // green total box
  accent: [36, 90, 61],     // #245A3D total amount, every other term heading
  footer: [102, 110, 133],  // footer text
  titleWeight: "regular",   // "regular" | "bold" for titles and totals
};
export const themeOf = (theme) => ({ ...MASTER_THEME, ...(theme?.v === 2 ? theme : {}) });

const PW = 595.2755905511812; // A4 width
const ML = 38;
const MR = 557;
const CW = MR - ML;
const HEADER_LINE = 115;
const FOOTER_LINE = 805;
const TITLE_BASE = 199.35;
export const CONTENT_LIMIT = 795; // lowest box edge; a last text line sits on 783.55
const TEXT_DESCENT = 11.45;
const INTRO_W = 345;
const TERMS_GAP = 50.68; // last body line of a term to the next heading
const VAT_RATE = 15;
const WHITE = [255, 255, 255];

// icon picked from the words of a title when none is set
const ICON_WORDS = [
  ["نطاق", "target"], ["خصم", "percent"], ["ضريب", "percent"], ["جاهز", "calendar"], ["جدول", "calendar"],
  ["موعد", "calendar"], ["تسليم", "package"], ["تعديل", "refresh"], ["دفع", "wallet"], ["سداد", "wallet"],
  ["استخدام", "wallet"], ["صلاحي", "clock"], ["اعتماد", "pen"], ["تصوير", "camera"], ["فيديو", "video"],
  ["موقع", "layout"], ["باقة", "package"],
];
export const pickIcon = (icon, text, fallback) => icon || (ICON_WORDS.find(([w]) => String(text || "").includes(w)) || [])[1] || fallback;
export const ICON_NAMES = Object.keys(ICONS).filter((k) => k !== "_");

// points along an arc on the icon grid (degrees, y down)
function arcPoints(cx, cy, r, a0, a1) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = ((a0 + ((a1 - a0) * i) / 24) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// how each block starts and ends: text blocks sit on baselines (font size),
// boxes on their edges
const SPEC = {
  intro: [17, 17], note: [13, 13], dates: [11, 11], info: [11, 11], terms: [17, 17.15],
  box: [0, 0], banner: [0, 0], card: [0, 0], approval: [0, 0], image: [0, 0], chart: [0, 0],
};

// space between neighbouring blocks, measured from the reference; the page
// title counts as text of 26.7
function gapBetween(prev, prevType, next, nextType) {
  if (prev) return next ? prev + 1.4 * next : 23.65 + prev;
  if (next) return 14.55 + next;
  return prevType === "box" && nextType === "box" ? 14 : 18;
}

// Spare room is shared out evenly over the gaps (none grows past 1.6x); when
// a page is too full the gaps shrink, down to half.
function fitGaps(flex, spare) {
  const total = flex.reduce((s, g) => s + g, 0);
  if (spare < -0.01) {
    if (!total) return { adj: (g) => g, over: -spare };
    const f = Math.max(0.5, (total + spare) / total);
    return { adj: (g) => g * f, over: Math.max(0, -spare - total * (1 - f)) };
  }
  const grow = (e) => flex.reduce((s, g) => s + Math.min(e, 0.6 * g), 0);
  let lo = 0, hi = spare;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (grow(mid) > spare) hi = mid; else lo = mid;
  }
  return { adj: (g) => g + Math.min(lo, 0.6 * g), over: 0 };
}

import { fmt } from "../lib/format.js";
export { fmt };

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

const sum = (a) => a.reduce((s, x) => s + x, 0);

class Quote {
  constructor(data, assets, pricing, theme) {
    this.d = data;
    this.t = themeOf(theme);
    this.pricing = pricing;
    this.vat = data.vat_rate ?? VAT_RATE;
    this.logo = assets.logo;
    this.warnings = [];
    this.dry = false; // measuring only: nothing is painted
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
    for (const para of String(text ?? "").split("\n")) {
      let cur = "";
      for (const word of para.split(" ")) {
        const cand = (cur + " " + word).trim();
        if (cur && this.width(cand, size) > maxW) { lines.push(cur); cur = word; }
        else cur = cand;
      }
      if (cur) lines.push(cur);
    }
    return lines;
  }

  // ---- painting primitives; base is the top-based baseline ----
  text(x, base, text, size, color, align = "right", weight) {
    if (this.dry) return;
    const c = this.c;
    this.font(size, weight);
    c.setTextColor(...color);
    const s = ar(text);
    const w = c.getTextWidth(s);
    const dx = align === "right" ? -w : align === "center" ? -w / 2 : 0;
    c.text(s, x + dx, base, { baseline: "alphabetic", isInputVisual: true, isOutputVisual: true });
  }

  // one line that shrinks to fit maxW
  fitText(x, base, text, size, color, maxW, weight) {
    const w = this.width(text, size, weight);
    this.text(x, base, text, w > maxW ? (size * maxW) / w : size, color, "right", weight);
  }

  rule(y, x0, x1, lw) {
    if (this.dry) return;
    const c = this.c;
    c.setDrawColor(...this.t.line);
    c.setLineWidth(lw);
    c.line(x0, y, x1, y);
  }

  rect(x, top, w, h, fill, stroke = true) {
    if (this.dry) return;
    const c = this.c;
    c.setFillColor(...fill);
    if (stroke) { c.setDrawColor(...this.t.line); c.setLineWidth(0.6); }
    c.rect(x, top, w, h, stroke ? "FD" : "F");
  }

  // line icon centred on (cx, cy), optionally on a round badge of radius br
  icon(name, cx, cy, size, color, badge, br) {
    const ops = ICONS[name];
    if (this.dry || !ops || name === "_") return;
    const c = this.c, k = size / 24, x0 = cx - size / 2, y0 = cy - size / 2;
    const X = (x) => x0 + x * k, Y = (y) => y0 + y * k;
    if (badge) { c.setFillColor(...badge); c.circle(cx, cy, br, "F"); }
    c.setDrawColor(...color);
    c.setFillColor(...color);
    c.setLineWidth(2 * k);
    c.setLineCap("round");
    c.setLineJoin("round");
    for (const [op, a] of ops) {
      if (op === "l" || op === "a") {
        const pts = op === "l" ? a : arcPoints(...a);
        for (let i = 1; i < pts.length; i++) c.line(X(pts[i - 1][0]), Y(pts[i - 1][1]), X(pts[i][0]), Y(pts[i][1]));
      } else if (op === "c") c.circle(X(a[0]), Y(a[1]), a[2] * k, "S");
      else if (op === "d") c.circle(X(a[0]), Y(a[1]), a[2] * k, "F");
      else if (op === "r") c.roundedRect(X(a[0]), Y(a[1]), a[2] * k, a[3] * k, a[4] * k, a[4] * k, "S");
    }
    c.setLineCap("butt");
    c.setLineJoin("miter");
  }

  pageFrame(page, n, total) {
    const c = this.c, t = this.t, d = this.d;
    this.rect(0, 0, PW, 8, t.bar, false);
    if (this.logo) c.addImage(this.logo, "PNG", ML, 28.34, 140, 65.325138, "logo", "FAST");
    this.fitText(MR, 53.05, d.client, 21, t.ink, MR - 198, this.emph());
    this.fitText(MR, 83.7, subtitleOf(page, d), 14, t.muted, MR - 198);
    this.rule(HEADER_LINE, ML, MR, 0.7);
    this.rule(FOOTER_LINE, ML, MR, 0.7);
    if (page.eyebrow) this.fitText(MR, 148.65, page.eyebrow, 13, t.muted, CW);
    this.fitText(MR, TITLE_BASE, page.title || "", 27, t.ink, CW, this.emph());
    c.setFont("helvetica", "normal");
    c.setFontSize(8);
    c.setTextColor(...t.footer);
    const right = `${d.quote_no} | ${n} / ${total}`;
    c.text("PLAN C / CREATIVE SOLUTIONS", ML, 824, { baseline: "alphabetic" });
    c.text(right, MR - c.getTextWidth(right), 824, { baseline: "alphabetic" });
  }

  // ---- blocks: each takes where it starts (baseline or top edge) and returns
  // { end, gaps } with gaps = its own flexible spaces at natural size ----
  intro(base, b) { return this.para(base, b.text, 17, 25.5, INTRO_W, this.t.ink); }
  note(base, b) {
    this.icon(b.icon || "info", 550.5, base - 4.5, 13, this.t.muted);
    return this.para(base, b.text, 13, 19.5, CW - 20, this.t.muted, MR - 20);
  }
  dates(base, b) {
    const day = (s) => String(s || "").replace(/\s*\/\s*/g, "/");
    const text = b.text || `الإصدار: ${day(this.d.issue_date)} | صالح حتى: ${day(this.d.valid_until)}`;
    this.icon("calendar", 551, base - 3.8, 12, this.t.muted);
    return this.para(base, text, 11, 16.5, CW - 18, this.t.muted, MR - 18);
  }

  para(base, text, size, lead, maxW, color, x = MR) {
    const lines = this.wrap(text, size, maxW);
    lines.forEach((l, i) => this.text(x, base + lead * i, l, size, color));
    return { end: base + lead * Math.max(lines.length - 1, 0), gaps: [] };
  }

  box(top, b) {
    const t = this.t;
    const lines = (Array.isArray(b.lines) ? b.lines : String(b.lines || "").split("\n")).flatMap((l) => this.wrap(l, 16, 448));
    const compact = lines.length <= 1;
    const tb = top + (compact ? 26.9 : 31.9);
    const first = b.title ? tb + (compact ? 32.9 : 37.9) : tb;
    const last = lines.length ? first + 24 * (lines.length - 1) : tb;
    const bottom = last + (lines.length > 1 ? 22.2 : 20.2);
    this.rect(ML, top, CW, bottom - top, b.tone === "blue" ? t.box2 : t.box);
    // icon on a white badge beside the title, a green check before each point
    if (b.title) {
      this.icon(pickIcon(b.icon, b.title, "list"), 526, tb - 6.2, 14, t.ink, WHITE, 12);
      this.text(505, tb, b.title, 18, t.ink);
    }
    lines.forEach((l, i) => {
      if (b.marks !== false) this.icon("check", 526, first + 24 * i - 5.3, 14, t.accent);
      this.text(505, first + 24 * i, l, 16, t.ink);
    });
    return { end: bottom, gaps: [] };
  }

  banner(top, b) {
    const lines = this.wrap(b.text, 16, 456);
    const h = 43 + 22 * Math.max(lines.length - 1, 0);
    this.rect(ML, top, CW, h, this.t.banner);
    this.icon(b.icon || (/خصم|%/.test(b.text || "") ? "percent" : "info"), 530, top + 19.5, 14, this.t.bannerInk, WHITE, 12);
    lines.forEach((l, i) => this.text(509, top + 24.8 + 22 * i, l, 16, this.t.bannerInk));
    return { end: top + h, gaps: [] };
  }

  card(top, b, ctx) {
    const t = this.t;
    const items = (b.items || []).map((i) => resolveItem(i, this.pricing));
    const tot = cardTotals(b, items, this.vat);
    const P = ctx.compact ? { sep: 15, next: 23, sub: 18, subPad: 12 } : { sep: 19.2, next: 27.8, sub: 21, subPad: 15 };
    let y = top + 20.8, sep = null;
    if (b.title) { this.text(MR, y, b.title, 18, t.ink, "right", this.emph()); y += 42; }
    for (const r of this.cardRows(b, items, tot)) {
      const avail = 486 - this.width(r.value, 16) - 24;
      let main = r.label || b.brief ? this.wrap(r.label || r.title, 16, avail) : null, sub = [];
      if (!main) {
        const both = r.desc ? `${r.title} • ${r.desc}` : r.title || "";
        if (this.width(both, 16) <= avail) main = [both];
        else { main = this.wrap(r.title, 16, avail); sub = this.wrap(r.desc, 12, avail); }
      }
      main.forEach((l, i) => this.text(540, y + 22 * i, l, 16, t.ink));
      this.text(54, y, r.value, 16, t.ink, "left");
      let z = y + 22 * Math.max(main.length - 1, 0);
      if (sub.length) {
        z += P.sub;
        sub.forEach((l, i) => this.text(540, z + 16 * i, l, 12, t.muted));
        z += 16 * (sub.length - 1);
      }
      sep = z + (sub.length ? P.subPad : P.sep);
      this.rule(sep, 54, 541, 0.6);
      y = sep + P.next;
    }
    const tt = sep === null ? top : sep + 18;
    this.rect(ML, tt, 345, 48, t.totalBg);
    this.text(369, tt + 26.7, b.total_label || (b.vat !== false ? "الإجمالي شامل الضريبة" : "الإجمالي"), 14, t.ink);
    this.text(51, tt + 27.75, `${fmt(tot.total)} SAR`, 15, t.accent, "left", this.emph());
    return { end: tt + 48, gaps: [] };
  }

  cardRows(b, items, tot) {
    const rows = items.map((it) => ({ label: it.label, title: it.title, desc: it.desc, value: "amount" in it ? fmt(it.amount) : String(it.value ?? "") }));
    if ("price" in b || (b.subtotal_label && items.length > 1)) rows.push({ label: b.subtotal_label || "قيمة الخيار", value: fmt(tot.base) });
    if (tot.disc) {
      rows.push({ label: `خصم ${fmt(tot.disc)}%`, value: fmt(-tot.discount) });
      rows.push({ label: "الإجمالي بعد الخصم", value: fmt(tot.net) });
    }
    if (b.vat !== false) rows.push({ label: `ضريبة القيمة المضافة ${fmt(this.vat)}%`, value: fmt(tot.vat) });
    return rows;
  }

  terms(base, b, ctx) {
    const t = this.t;
    const items = b.items || [];
    let y = base, last = base;
    items.forEach((it, i) => {
      if (i) y = last + ctx.adj(TERMS_GAP);
      const color = i % 2 ? t.accent : t.ink;
      this.icon(pickIcon(it.icon, it.title, "check"), 545, y - 6, 14, color, i % 2 ? t.totalBg : t.box, 12);
      this.text(524, y, it.title, 17, color, "right", this.emph());
      const lines = this.wrap(it.text, 13.5, 486);
      lines.forEach((l, j) => this.text(524, y + 27.32 + 20.25 * j, l, 13.5, t.ink));
      last = lines.length ? y + 27.32 + 20.25 * (lines.length - 1) : y;
    });
    return { end: last, gaps: items.slice(1).map(() => TERMS_GAP) };
  }

  approval(top) {
    const t = this.t;
    this.rect(ML, top, CW, 64, t.box);
    this.icon("pen", 530, top + 16, 14, t.ink, WHITE, 12);
    this.text(509, top + 21.75, "اعتماد العرض", 15, t.ink);
    this.text(509, top + 48.6, "الخيار: ______________ الاسم والتاريخ: ______________", 12, t.ink);
    return { end: top + 64, gaps: [] };
  }

  // image (PNG/JPEG logo or chart), right aligned like the text column
  image(top, b) {
    if (!b.src) return { end: top, gaps: [] };
    const w = (CW * Math.min(100, Math.max(10, b.width_pct || 100))) / 100;
    const h = b.ratio ? w * b.ratio : 160;
    const x = b.align === "center" ? ML + (CW - w) / 2 : b.align === "left" ? ML : MR - w;
    if (!this.dry) this.c.addImage(b.src, /^data:image\/jpe?g/.test(b.src) ? "JPEG" : "PNG", x, top, w, h, undefined, "FAST");
    let end = top + h;
    if (b.caption) {
      const align = b.align === "center" ? "center" : b.align === "left" ? "left" : "right";
      this.text(align === "center" ? x + w / 2 : align === "left" ? x : MR, end + 18, b.caption, 12, this.t.muted, align);
      end += 22;
    }
    return { end, gaps: [] };
  }

  // bar chart drawn as vectors in the template colors
  chart(top, b) {
    const t = this.t;
    const rows = (b.rows || []).filter((r) => r.label || r.value);
    let y = top;
    if (b.title) { this.text(MR, y + 15, b.title, 17, t.ink, "right", this.emph()); y += 31; }
    const n = Math.max(rows.length, 1);
    const max = Math.max(1, ...rows.map((r) => Number(r.value) || 0));
    const plotH = 120, labelH = 32;
    this.rect(ML, y, CW, plotH + labelH + 24, t.box);
    const x0 = ML + 16, x1 = MR - 16, base = y + 12 + plotH;
    const slot = (x1 - x0) / n, bw = Math.min(46, slot * 0.55);
    this.rule(base, x0, x1, 0.6);
    rows.forEach((r, i) => {
      // first row on the right (reading order)
      const cx = x1 - slot * (i + 0.5);
      const v = Number(r.value) || 0;
      const h = (v / max) * (plotH - 20);
      if (h > 0) this.rect(cx - bw / 2, base - h, bw, h, i === 0 || !b.highlight_first ? t.bar : t.box2, false);
      this.text(cx, base - h - 6, fmt(v), 12, t.ink, "center");
      this.text(cx, base + 19, r.label || "", 12, t.muted, "center");
    });
    return { end: y + plotH + labelH + 24, gaps: [] };
  }

  block(b, start, ctx) {
    return this[b.type === "info" ? "dates" : b.type](start, b, ctx);
  }

  // where every block of a page goes: natural gaps, then fitted to the page
  plan(blocks) {
    const specs = blocks.map((b) => {
      if (!(b.type in SPEC)) throw new Error(`unknown block type ${b.type}`);
      return SPEC[b.type];
    });
    const kind = (b) => (b.type === "box" ? "box" : b.type);
    const gaps = blocks.map((b, i) => (i
      ? gapBetween(specs[i - 1][1], kind(blocks[i - 1]), specs[i][0], kind(b))
      : gapBetween(26.7, "title", specs[0][0], kind(b))));
    let out = null;
    for (const compact of [false, true]) {
      this.dry = true;
      const ms = blocks.map((b) => this.block(b, 0, { compact, adj: (g) => g }));
      this.dry = false;
      const fixed = TITLE_BASE + gaps[0] + sum(ms.map((m) => m.end - sum(m.gaps)));
      const flex = [...gaps.slice(1), ...ms.flatMap((m) => m.gaps)];
      const descent = specs[specs.length - 1][1] ? TEXT_DESCENT : 0;
      const fit = fitGaps(flex, CONTENT_LIMIT - (fixed + sum(flex) + descent));
      out = { compact, gaps, ...fit };
      if (fit.over <= 0.5 || !blocks.some((b) => b.type === "card")) break;
    }
    return out;
  }

  // a page that cannot fit even when tightened continues on a copy of itself
  paginate(pages) {
    const out = [];
    for (const page of pages) {
      let rest = page.blocks || [];
      if (!rest.length) { out.push({ page, blocks: [], plan: null }); continue; }
      while (rest.length) {
        let k = rest.length, plan = this.plan(rest);
        while (plan.over > 0.5 && k > 1) plan = this.plan(rest.slice(0, --k));
        // a dates line or note never sits alone on the next page
        if (k < rest.length && k > 1 && rest.slice(k).every((b) => b.type === "dates" || b.type === "note")) plan = this.plan(rest.slice(0, --k));
        out.push({ page, blocks: rest.slice(0, k), plan });
        rest = rest.slice(k);
      }
    }
    return out;
  }

  build() {
    const sheets = this.paginate(this.d.pages);
    sheets.forEach(({ page, blocks, plan }, idx) => {
      const n = idx + 1;
      if (idx) this.c.addPage();
      this.pageFrame(page, n, sheets.length);
      if (!plan) return;
      let cur = TITLE_BASE;
      blocks.forEach((b, i) => {
        cur += i ? plan.adj(plan.gaps[i]) : plan.gaps[0];
        cur = this.block(b, cur, { compact: plan.compact, adj: plan.adj }).end;
      });
      if (plan.over > 0.5) this.warnings.push({ page: n, overflow: Math.round(plan.over) });
    });
    return this.c;
  }
}

// header subtitle: the quote subject, without the client name the old
// template repeated after it
function subtitleOf(page, d) {
  const client = String(d.client || "").trim();
  return String(page.subtitle || d.subtitle || "").split(" | ").filter((p) => p.trim() && p.trim() !== client).join(" | ");
}

// Returns { doc, warnings }. assets: { fontRegular, fontBold?, logo } as Uint8Array.
export function buildQuote(data, assets, pricing, theme) {
  const q = new Quote(data, assets, pricing, theme);
  const doc = q.build();
  return { doc, warnings: q.warnings };
}
