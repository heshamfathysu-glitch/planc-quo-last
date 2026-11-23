// "Signature" quote template: the design of the Lucia Bakery Signature quote
// (2026-11-04). A navy cover with the package name and its key numbers, then a
// white pricing page: who it is for, the items table, the price summary, a
// navy total bar, the terms as numbered cards and two signature lines.
// Measured from that PDF (A4, top-based y, content 50.78-544.28). Do NOT edit
// the layout constants: a quote only changes its data.
//
// It reads the same quote data as engine.js (pages > blocks). The cover uses
// the first option; every page holding a price card becomes a pricing section;
// the terms come from the terms block. Optional overrides in data.signature:
// { title, subtitle, package, stats: [{ value, label }] }.
import { jsPDF } from "jspdf";
import { ar } from "./arabic.js";
import { resolveItem, cardTotals, fmt } from "./engine.js"; // engine.js also turns off jsPDF's own Arabic shaping

const NAVY = [0, 5, 77];
const RED = [227, 11, 33];
const WHITE = [255, 255, 255];
const BODY = [58, 63, 107];      // #3A3F6B
const MUTED = [107, 111, 142];   // #6B6F8E
const LINE = [228, 230, 240];    // #E4E6F0
const BOX = [247, 249, 255];     // #F7F9FF
const C_EYEBROW = [201, 204, 240]; // cover: eyebrow and stat labels
const C_SUB = [230, 232, 250];     // cover: subtitle
const C_META = [174, 179, 230];    // cover: spaced top and bottom lines
const C_RULE = [77, 80, 130];      // cover: stat rules (white at 30% on navy)

const PW = 595.2755905511812;
const PH = 841.8897637795275;
const L = 50.78;
const R = 544.28;
const VAT_RATE = 15;
const SPACING = 0.22; // letter spacing of the Latin meta lines, in em
const BODY_LIMIT = 790; // lowest content edge above the footer
const SIGN_LIMIT = 745; // lowest content edge on the page with the signatures
const CONT_TOP = 140;   // first content edge on a continuation page
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function toBinaryString(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return s;
}

const pad2 = (n) => String(n).padStart(2, "0");
// "04 / 11 / 2026" -> Date
function parseDay(s) {
  const m = String(s || "").match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) : null;
}
const NUM_RE = /^\s*([\d٠-٩][\d٠-٩,.]*)\s*(.*)$/;

// numbers for the cover: up to two counts from the first option, then the price
export function coverStats(card, items, tot, vatOn) {
  const stats = [];
  for (const it of items) {
    if (stats.length >= 2) break;
    const src = it.value != null && it.value !== "" ? String(it.value) : it.qty ? `${it.qty} ${String(it.desc || "").split(" ")[1] || ""}` : String(it.desc || "");
    const m = src.match(NUM_RE);
    if (m && m[2]) stats.push({ value: m[1], label: m[2].split(/[،,.]|\sب/)[0].trim() });
  }
  stats.push({ value: fmt(tot.net), label: vatOn ? "ر.س قبل الضريبة" : "ر.س" });
  return stats;
}

export class Signature {
  constructor(data, assets, pricing, opts = {}) {
    this.d = data;
    this.s = data.signature || {};
    this.pricing = pricing || { services: {} };
    this.vat = data.vat_rate ?? VAT_RATE;
    this.seller = opts.seller || {};
    this.assets = assets;
    this.warnings = [];
    const c = (this.c = new jsPDF({ unit: "pt", format: "a4", compress: true }));
    c.addFileToVFS("PlexAr-Regular.ttf", toBinaryString(assets.fontRegular));
    c.addFont("PlexAr-Regular.ttf", "PlexAr", "normal", "Identity-H");
    c.addFileToVFS("PlexAr-Bold.ttf", toBinaryString(assets.fontBold));
    c.addFont("PlexAr-Bold.ttf", "PlexAr", "bold", "Identity-H");
    if (assets.fontSemi) {
      c.addFileToVFS("PlexAr-SemiBold.ttf", toBinaryString(assets.fontSemi));
      c.addFont("PlexAr-SemiBold.ttf", "PlexArSemi", "normal", "Identity-H");
    }
    c.setDocumentProperties({ title: data.pdf_title || "عرض سعر - " + data.client, author: "PLAN C" });
    this.page = 1;
  }

  // ---- primitives. font: r / s / b (IBM Plex Sans Arabic regular, semibold,
  // bold) or h / hb (Helvetica, metric twin of the Arial in the reference)
  font(f, size) {
    const c = this.c;
    if (f === "h" || f === "hb") c.setFont("helvetica", f === "hb" ? "bold" : "normal");
    else if (f === "s" && this.assets.fontSemi) c.setFont("PlexArSemi", "normal");
    else c.setFont("PlexAr", f === "b" || f === "s" ? "bold" : "normal");
    c.setFontSize(size);
  }
  // every Plex line is a right-to-left paragraph, even when it starts with a Latin word
  str(f, t) { return f === "h" || f === "hb" ? String(t) : ar(t, "rtl"); }
  width(t, size, f = "r", cs = 0) {
    this.font(f, size);
    const s = this.str(f, t);
    return this.c.getTextWidth(s) + cs * s.length;
  }
  text(x, base, t, size, color, f = "r", align = "right", cs = 0) {
    if (t == null || t === "") return 0;
    const c = this.c;
    const w = this.width(t, size, f, cs);
    c.setTextColor(...color);
    const dx = align === "right" ? -w : align === "center" ? -w / 2 : 0;
    const opts = { baseline: "alphabetic" };
    if (f !== "h" && f !== "hb") Object.assign(opts, { isInputVisual: true, isOutputVisual: true });
    if (cs) opts.charSpace = cs;
    c.text(this.str(f, t), x + dx, base, opts);
    return w;
  }
  // one line that shrinks to fit maxW
  fit(x, base, t, size, color, maxW, f = "r", align = "right") {
    const w = this.width(t, size, f);
    return this.text(x, base, t, w > maxW ? (size * maxW) / w : size, color, f, align);
  }
  // Latin caps with letter spacing (the trailing space counts, as in a browser)
  spaced(xRight, base, t, color, size = 8, align = "right") {
    const cs = SPACING * size;
    const w = this.width(t, size, "h", cs);
    return this.text(align === "right" ? xRight - w : xRight, base, t, size, color, "h", "left", cs);
  }
  wrap(t, size, maxW, f = "r") {
    const lines = [];
    for (const para of String(t ?? "").split("\n")) {
      let cur = "";
      for (const word of para.split(" ")) {
        const cand = (cur + " " + word).trim();
        if (cur && this.width(cand, size, f) > maxW) { lines.push(cur); cur = word; }
        else cur = cand;
      }
      if (cur) lines.push(cur);
    }
    return lines;
  }
  rect(x, y, w, h, fill) {
    this.c.setFillColor(...fill);
    this.c.rect(x, y, w, h, "F");
  }
  // a heading in bold navy ending in a red full stop
  heading(base, t, size) {
    const w = this.text(R, base, t, size, NAVY, "b");
    this.text(R - w, base, ".", size, RED, "b");
  }

  // ---- data ----
  options() {
    const out = [];
    for (const p of this.d.pages || []) {
      for (const b of p.blocks || []) {
        if (b.type !== "card") continue;
        const items = (b.items || []).map((i) => {
          try { return resolveItem(i, this.pricing); } catch { return { ...i, amount: Number(i.amount) || 0 }; }
        });
        out.push({ page: p, card: b, items, tot: cardTotals(b, items, this.vat) });
      }
    }
    return out;
  }
  terms() {
    for (const p of this.d.pages || []) for (const b of p.blocks || []) if (b.type === "terms") return (b.items || []).filter((t) => t.title || t.text);
    return [];
  }
  intro(page) {
    return (page?.blocks || []).find((b) => b.type === "intro")?.text || "";
  }

  // ---- cover ----
  cover(opts) {
    const c = this.c, d = this.d, s = this.s;
    const first = opts[0];
    this.rect(0, 0, PW, PH, NAVY);
    if (this.assets.logoCover) c.addImage(this.assets.logoCover, "PNG", L, 62.25, 116.25, 54, "sigLogoCover", "FAST");
    const day = parseDay(d.issue_date);
    this.spaced(R, 69.75, `QUOTATION${day ? ` · ${pad2(day.getUTCDate())} ${MONTHS[day.getUTCMonth()]} ${day.getUTCFullYear()}` : ""}`, C_META);

    // numbers on fixed rules; the words above them grow upwards
    const stats = (s.stats?.length ? s.stats : first ? coverStats(first.card, first.items, first.tot, first.card.vat !== false) : []).slice(0, 4);
    stats.forEach((st, i) => {
      const right = R - 113.25 * i;
      this.rect(right - 85.5, 660.75, 85.5, 0.75, C_RULE);
      this.fit(right, 688.5, String(st.value ?? ""), 20, WHITE, 85, /[؀-ۿ]/.test(st.value) ? "b" : "hb");
      this.fit(right, 706.5, st.label || "", 9, C_EYEBROW, 85);
    });

    const sub = this.wrap(s.subtitle ?? this.intro(first?.page).replace(/\n/g, " "), 14, R - L).slice(0, 3);
    const subTop = 629.25 - 21 * (sub.length - 1);
    sub.forEach((l, i) => this.text(R, subTop + 21 * i, l, 14, C_SUB));
    const title = this.wrap(s.title || first?.page.title || d.subtitle || "عرض سعر", 36, R - L - 12, "b").slice(0, 3);
    const titleBase = (sub.length ? subTop : 629.25) - 39.75;
    title.forEach((l, i) => {
      const base = titleBase - 43 * (title.length - 1 - i);
      const w = this.text(R, base, l, 36, WHITE, "b");
      if (i === title.length - 1) this.text(R - w, base, ".", 36, RED, "b");
    });
    this.fit(R, titleBase - 43 * (title.length - 1) - 51, `عرض سعر · ${d.client || ""}`, 13, C_EYEBROW, R - L);

    const days = parseDay(d.valid_until) && day ? Math.round((parseDay(d.valid_until) - day) / 864e5) : 0;
    this.spaced(L, 783.75, `REF ${d.quote_no || ""}${days > 0 ? ` · VALID ${days} DAYS` : ""}`, C_META, 8, "left");
    this.spaced(R, 783.75, "DIGITALPLANC.COM · RIYADH", C_META);
    // white and red strip at the bottom right
    this.rect(327.53, 830.25, 179.25, PH - 830.25, WHITE);
    this.rect(506.78, 830.25, PW - 506.78, PH - 830.25, RED);
  }

  // ---- white pages ----
  newPage() {
    this.c.addPage();
    this.page += 1;
    const c = this.c;
    if (this.assets.logo) c.addImage(this.assets.logo, "PNG", L, 62.25, 91.5, 42.75, "sigLogo", "FAST");
    this.spaced(R, 69.75, `PRICING · ${pad2(this.page)}`, MUTED);
    const sl = this.seller;
    const parts = ["PLAN C", sl.cr ? `سجل تجاري ${sl.cr}` : "", sl.email || "info@digitalplanc.com", this.d.quote_no ? `عرض سعر ${this.d.quote_no}` : ""].filter(Boolean);
    this.fit(R, 804.75, parts.join(" · "), 7.5, MUTED, R - L - 40);
    this.text(L, 803.25, pad2(this.page), 7.5, MUTED, "h", "left");
    return CONT_TOP;
  }

  // header of a pricing section: title, then "for" and "package" boxes
  sectionHead(top, opt, multi) {
    const title = multi && opt.page.eyebrow ? `عرض السعر · ${opt.page.eyebrow}` : "عرض السعر";
    this.heading(top + 11.5, title, 26);
    const by = top + 30.25;
    const boxes = [
      [R, "مقدَّم إلى", this.d.client || ""],
      [289.28, "الباقة", this.s.package && !multi ? this.s.package : opt.page.title || ""],
    ];
    for (const [right, label, value] of boxes) {
      const w = right === R ? R - 306.53 : 289.28 - L;
      this.rect(right - w, by, w, 63, BOX);
      this.c.setDrawColor(...LINE);
      this.c.setLineWidth(0.75);
      this.c.rect(right - w + 0.375, by + 0.375, w - 0.75, 63 - 0.75, "S");
      this.text(right - 15, by + 24, label, 11, NAVY, "b");
      this.fit(right - 15, by + 47.25, value, 9.5, BODY, w - 30);
    }
    return by + 63;
  }

  tableHead(top, pkg) {
    this.text(538.6, top + 24, "#", 8.5, MUTED, "h");
    this.text(515.9, top + 23.25, "البند", 8.5, MUTED);
    this.text(56.7, top + 23.25, pkg ? "الكمية" : "المبلغ", 8.5, MUTED, "r", "left");
    this.rect(L, top + 36, R - L, 0.75, NAVY);
    return top + 36.75;
  }

  // a value cell: "24 صورة" draws the number in bold Latin after the word
  valueCell(base, v) {
    const m = String(v ?? "").match(NUM_RE);
    if (m && m[2] && /[؀-ۿ]/.test(m[2]) && !/[؀-ۿ]/.test(m[1])) {
      const w = this.text(56.7, base, m[2], 10, NAVY, "r", "left");
      this.text(56.7 + w + this.width(" ", 10, "hb"), base, m[1], 10, NAVY, "hb", "left");
    } else if (/[؀-ۿ]/.test(String(v ?? ""))) this.fit(56.7, base, v, 10, NAVY, 92, "r", "left");
    else this.fit(56.7, base, v, 10, NAVY, 92, "hb", "left");
  }

  rowLayout(it) {
    const title = this.wrap(it.title || it.label || "", 10.5, 360, "s");
    const desc = it.desc ? this.wrap(it.desc, 8.5, 360) : [];
    const lastTitle = 17.25 + 15 * (title.length - 1);
    const last = desc.length ? lastTitle + 16.5 + 13 * (desc.length - 1) : lastTitle;
    return { title, desc, h: last + (desc.length ? 9.75 : 12) + 0.75 };
  }
  row(top, n, it, lay, pkg) {
    this.text(538.6, top + 13.5, pad2(n), 8.5, MUTED, "h");
    lay.title.forEach((l, i) => this.text(515.9, top + 17.25 + 15 * i, l, 10.5, NAVY, "s"));
    const d0 = top + 17.25 + 15 * (lay.title.length - 1) + 16.5;
    lay.desc.forEach((l, i) => this.text(515.9, d0 + 13 * i, l, 8.5, MUTED));
    const value = pkg || !("amount" in it) ? (it.value ?? (it.qty ? String(it.qty) : fmt(it.amount || 0))) : fmt(it.amount);
    this.valueCell(top + 16.5, value);
    this.rect(L, top + lay.h - 0.75, R - L, 0.75, LINE);
    return top + lay.h;
  }

  summaryRows(o) {
    const b = o.card, t = o.tot, vatOn = b.vat !== false;
    const pkg = "price" in b;
    const g1 = [], g2 = [];
    if (t.discount) {
      g1.push({ label: b.subtotal_label || (pkg ? "سعر الباقة" : "المجموع"), value: fmt(t.base), f: "b" });
      g1.push({ label: b.discount_label || (b.discount_amount ? "خصم خاص" : `خصم ${fmt(t.disc)}%`), value: "–" + fmt(t.discount), f: "b", red: true });
      g2.push({ label: vatOn ? "الإجمالي بعد الخصم قبل الضريبة" : "الإجمالي بعد الخصم", value: fmt(t.net), f: "b" });
    } else {
      g1.push({ label: b.subtotal_label || (pkg ? "سعر الباقة" : vatOn ? "الإجمالي قبل الضريبة" : "المجموع"), value: fmt(t.base), f: "b" });
    }
    if (vatOn) g2.push({ label: `ضريبة القيمة المضافة ${fmt(this.vat)}%`, value: fmt(t.vat), f: "r" });
    return [g1, g2];
  }
  summaryHeight(o) {
    const [g1, g2] = this.summaryRows(o);
    let h = 24.75 + 27.75 * (g1.length - 1);
    if (g2.length) h += 10.5 + 18 + 27 * (g2.length - 1);
    return h + 11.25 + 0.75 + 47.25;
  }
  summary(top, o) {
    const [g1, g2] = this.summaryRows(o);
    const draw = (base, r) => {
      const color = r.red ? RED : NAVY;
      this.text(538.6, base, r.label, 10, color, r.f);
      this.text(56.7, base - 1.5, r.value, 10, color, r.f === "b" ? "hb" : "h", "left");
    };
    let base = top + 24.75;
    g1.forEach((r, i) => draw(base + 27.75 * i, r));
    base += 27.75 * (g1.length - 1);
    if (g2.length) {
      this.rect(L, base + 10.5, R - L, 0.75, LINE);
      base += 10.5 + 18;
      g2.forEach((r, i) => draw(base + 27 * i, r));
      base += 27 * (g2.length - 1);
    }
    const sep = base + 11.25;
    this.rect(L, sep, R - L, 0.75, LINE);
    const bar = sep + 0.75;
    this.rect(L, bar, R - L, 47.25, NAVY);
    this.rect(191.78, bar, 0.75, 47.25, WHITE);
    const b = o.card;
    this.fit(527.2, bar + 27.75, b.total_label || (b.vat !== false ? "الإجمالي شامل الضريبة" : "الإجمالي"), 13, WHITE, 320, "b");
    const cw = this.text(68, bar + 26.25, "ر.س", 9, WHITE, "r", "left");
    this.fit(68 + cw + this.width(" ", 14, "hb"), bar + 26.25, fmt(o.tot.total), 14, WHITE, 110, "hb", "left");
    return bar + 47.25;
  }

  // terms: numbered cards, two to a row (first on the right)
  termCard(right, w, top, h, n, t, lay) {
    this.rect(right - w, top, w, 1.5, NAVY);
    this.rect(right - w, top + h - 0.75, w, 0.75, LINE);
    this.rect(right - 0.75, top + 1.5, 0.75, h - 1.5, LINE);
    this.rect(right - w, top + 1.5, 0.75, h - 1.5, LINE);
    this.text(right - 12.08, top + 21.75, pad2(n), 11, RED, "hb");
    this.fit(right - 32.88, top + 21, t.title || "", 9.5, NAVY, w - 46, "b");
    lay.forEach((l, i) => this.text(right - 32.88, top + 36 + 13.5 * i, l, 8.5, BODY));
  }
  termRows(terms) {
    const rows = [];
    for (let i = 0; i < terms.length; i += 2) {
      const pair = terms.slice(i, i + 2).map((t, j) => {
        const w = j ? 243 : 242.25;
        return { t, n: i + j + 1, lay: this.wrap(t.text || "", 8.5, w - 32.88 - 12) };
      });
      const lines = Math.max(...pair.map((p) => p.lay.length), 0);
      rows.push({ pair, h: lines ? 36 + 13.5 * (lines - 1) + 14.25 : 36 });
    }
    return rows;
  }

  signatures() {
    this.text(R, 767.25, `اعتماد العميل · ${this.d.client || ""}`, 9, MUTED);
    this.text(286.28, 765.75, "PLAN C", 9, MUTED, "h");
    this.rect(308.78, 791.25, R - 308.78, 0.75, NAVY);
    this.rect(L, 791.25, 286.28 - L, 0.75, NAVY);
  }

  build() {
    const opts = this.options();
    this.cover(opts);
    const multi = opts.length > 1;
    let y = this.newPage();
    const room = (h, limit = BODY_LIMIT) => {
      if (y + h <= limit) return;
      y = this.newPage();
    };
    if (!opts.length) y = this.sectionHead(y, { page: { title: this.s.package || this.d.subtitle || "" } }, false);
    opts.forEach((o, oi) => {
      if (oi) y = this.newPage();
      y = this.sectionHead(y, o, multi);
      const pkg = "price" in o.card;
      y = this.tableHead(y, pkg);
      o.items.forEach((it, i) => {
        const lay = this.rowLayout(it);
        if (y + lay.h > BODY_LIMIT) y = this.tableHead(this.newPage() - 10, pkg);
        y = this.row(y, i + 1, it, lay, pkg);
      });
      room(this.summaryHeight(o));
      y = this.summary(y, o);
    });

    const rows = this.termRows(this.terms());
    // where each row of term cards starts: [{ brk: new page before it, top }];
    // breakAt forces a new page before that row (-1: before the heading)
    const place = (breakAt) => {
      let yy = y;
      const out = [];
      if (breakAt === -1 || yy + 44.25 + rows[0].h > BODY_LIMIT) { yy = CONT_TOP; out.head = true; }
      out.headY = yy;
      yy += 44.25;
      rows.forEach((r, i) => {
        let brk = false;
        if (i) {
          if (i === breakAt || yy + 9 + r.h > BODY_LIMIT) { yy = CONT_TOP; brk = true; } else yy += 9;
        }
        out.push({ brk, top: yy });
        yy += r.h;
      });
      out.end = yy;
      return out;
    };
    if (rows.length) {
      // the signatures need the bottom of the last page: rather than leave
      // them alone on a page, the last row of cards (or all) goes with them
      let plan = place();
      if (plan.end > SIGN_LIMIT && !plan[rows.length - 1].brk) plan = place(rows.length > 1 ? rows.length - 1 : -1);
      if (plan.head) this.newPage();
      this.heading(plan.headY + 31.5, "الشروط", 16);
      rows.forEach((r, i) => {
        if (plan[i].brk) this.newPage();
        r.pair.forEach((p, j) => this.termCard(j ? 293.78 : R, j ? 243 : 242.25, plan[i].top, r.h, p.n, p.t, p.lay));
      });
      y = plan.end;
    }
    if (y > SIGN_LIMIT) this.newPage();
    this.signatures();
    return this.c;
  }
}

// Returns { doc, warnings }. assets: { fontRegular, fontBold, fontSemi, logo, logoCover }.
export function buildSignature(data, assets, pricing, opts) {
  const q = new Signature(data, assets, pricing, opts);
  const doc = q.build();
  return { doc, warnings: q.warnings };
}
