// "SOLID" quote template, in Arabic (template "solid") and English
// ("solid_en"): the design of the SOLID 10 Reels quote (2026-11-24). A navy
// cover with the quote title and its key numbers, a scope page (headline,
// sections with detail cells, "what you get" chips) and a pricing page (who it
// is for, the package with its price, bank transfer details and two signature
// lines). Measured from the two reference PDFs (A4, top-based y, content
// 50.78-544.28). Do NOT edit the layout constants: a quote only changes its data.
//
// It reads the same quote data as engine.js. Every field of data.solid (or
// data.solid_en) is optional: a missing field takes its text from the quote,
// an empty one hides that part. Fields: { eyebrow, subtitle, stats: [{ value,
// label }], quote, intro, sections: [{ title, tag, text, cells: [{ title, text }] }],
// chips: [], client_desc, project: [], package, package_desc }.
// Bank details come from the invoice settings (seller), never from the code.
import { Signature, coverStats } from "./signature.js";
import { fmt } from "./engine.js";
export { parseSections, sectionsText } from "./solidText.js";

const NAVY = [0, 5, 77];
const RED = [227, 11, 33];
const WHITE = [255, 255, 255];
const BODY = [58, 63, 107];
const MUTED = [107, 111, 142];
const LINE = [228, 230, 240];
const BOX = [247, 249, 255];
const C_EYEBROW = [201, 204, 240];
const C_SUB = [230, 232, 250];
const C_META = [174, 179, 230];
const C_RULE = [77, 80, 130]; // white at 30% on navy

const PW = 595.2755905511812;
const PH = 841.8897637795275;
const L = 50.78;
const R = 544.28;
const IN = 17.78; // inner margin of the section and price boxes
const BODY_LIMIT = 790;
const CONT_TOP = 140;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const AR_RE = /[؀-ۿ]/;

const TEXT = {
  ar: {
    title: (c) => `عرض سعر لـ ${c}`,
    scope: "نطاق العمل", get: "ما ستحصل عليه", pricing: "عرض السعر", bank: "بيانات التحويل البنكي",
    for: "مقدَّم إلى", project: "المشروع", full: "الباقة كاملة",
    cur: "ر.س", excl: "قبل الضريبة", incl: (v) => `شامل الضريبة ${v} ر.س`, after: (v) => `بعد خصم ${v} ر.س`,
    note: (vat, days) => `جميع الأسعار بالريال السعودي${vat ? `، وتُضاف إليها ضريبة القيمة المضافة ${vat}%` : ""}.${days > 0 ? ` العرض صالح ${days} أيام من تاريخه.` : ""}`,
    cols: ["اسم الحساب", "البنك", "رقم الحساب", "الآيبان IBAN"],
    cr: (n, cr) => [n, cr ? `سجل تجاري ${cr}` : ""].filter(Boolean).join(" · "),
    approval: (c) => `اعتماد العميل · ${c}`,
    footer: (cr, mail, q) => ["PLAN C", cr ? `سجل تجاري ${cr}` : "", mail, q ? `عرض سعر ${q}` : ""],
    quote: "لا ننتج محتوى جميلًا فقط! بل ننتج محتوى يبيع",
    chips: ["تصوير", "مونتاج", "متابعة وتنظيم", "دعم فني", "فريق كامل معك"],
  },
  en: {
    title: (c) => `Quotation for ${c}`,
    scope: "Scope of Work", get: "What You Get", pricing: "Quotation", bank: "Bank Transfer Details",
    for: "Prepared for", project: "Project", full: "Full Package",
    cur: "SAR", excl: "Excl. VAT", incl: (v) => `Incl. VAT ${v} SAR`, after: (v) => `After a ${v} SAR discount`,
    note: (vat, days) => `All prices in Saudi Riyals${vat ? `, plus ${vat}% VAT` : ""}.${days > 0 ? ` This quote is valid for ${days} days from its issue date.` : ""}`,
    cols: ["Account name", "Bank", "Account no.", "IBAN"],
    cr: (n, cr) => [n, cr ? `CR ${cr}` : ""].filter(Boolean).join(" · "),
    approval: (c) => `Client approval · ${c}`,
    footer: (cr, mail, q) => ["PLAN C", cr ? `CR ${cr}` : "", mail, q ? `Quote ${q}` : ""],
    quote: "We don’t just produce beautiful content! We produce content that sells.",
    chips: ["Shooting", "Editing", "Follow-up & organization", "Technical support", "A full team with you"],
  },
};

// measured spacing that differs between the two languages
const M = {
  ar: {
    cover: { rule: 660.75, subUp: 31.5, subLead: 21, sub: 14, titleUp: 39.75, title: 36, titleLead: 43, eyebrowUp: 51, val: 27.75, lab: 45.75 },
    head: { base: 166.5, size: 30 },
    quote: { size: 19, lead: 25.5, gap: 50.25 + 0.75, w: 420 },
    intro: { gap: 33, lead: 23.25, w: 440 },
    sec: { title: 13, titleY: 30, descY: 54.75, descLead: 17.25, cellsNoDesc: 44.25, cellT: 18.75, cellD: 33.75, cellEnd: 12.75, end: 13.5 },
    get: { gap: 34.5, chipTop: 18, chipH: 32.25, chipSize: 11.5, chipBase: 20.25, pad: 14.6, gapX: 8.25 },
    boxes: { top: 192, label: 30, first: 53.25, lead: 14.25, end: 21.75 },
    pkg: { gap: 16.5, title: 43.5, desc: 66, price: 50.25, excl: 69, incl: 90.75, end: 24.75, descEnd: 33, descW: 262 },
    note: 18.75, bankHead: 40.5, table: 15, tableH: 51.75, colLab: 19.5, colVal: 37.5, valSize: 9.5, pad: 12, crLine: 14.25, sign: 51.75, signLine: 29.25,
    footBase: 804.75, numBase: 803.25,
  },
  en: {
    cover: { rule: 665.25, subUp: 29.25, subLead: 16.5, sub: 14, titleUp: 37.5, title: 38, titleLead: 44, eyebrowUp: 51.75, val: 27.75, lab: 43.5 },
    head: { base: 165, size: 28 },
    quote: { size: 17, lead: 25.5, gap: 48.75, w: 440 },
    intro: { gap: 31.5, lead: 23.25, w: 470 },
    sec: { title: 12.5, titleY: 26.25, descY: 50.25, descLead: 17.25, cellsNoDesc: 39, cellT: 17.25, cellD: 30.75, cellEnd: 12, end: 14.25 },
    get: { gap: 31.5, chipTop: 15.75, chipH: 24, chipSize: 9.5, chipBase: 15, pad: 8.6, gapX: 5.5 },
    boxes: { top: 189.75, label: 27, first: 46.5, lead: 10.5, end: 19.5 },
    pkg: { gap: 17.25, title: 40.5, desc: 60, price: 49.5, excl: 67.5, incl: 86.25, end: 22.5, descEnd: 32.25, descW: 285 },
    note: 16.5, bankHead: 36.75, table: 12.75, tableH: 45, colLab: 17.25, colVal: 31.5, valSize: 8.6, pad: 9.3, crLine: 12, sign: 49.5, signLine: 27.75,
    footBase: 806.25, numBase: 806.25,
  },
};

const pad2 = (n) => String(n).padStart(2, "0");
function parseDay(s) {
  const m = String(s || "").match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) : null;
}
const has = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined;

export class Solid extends Signature {
  constructor(data, assets, pricing, opts = {}) {
    super(data, assets, pricing, opts);
    this.lang = data.template === "solid_en" ? "en" : "ar";
    this.rtl = this.lang === "ar";
    this.T = TEXT[this.lang];
    this.m = M[this.lang];
    this.s = (this.rtl ? data.solid : data.solid_en) || {};
    this.c.setDocumentProperties({ title: data.pdf_title || (this.rtl ? "عرض سعر - " : "Quotation - ") + (data.client || ""), author: "PLAN C" });
  }

  // jsPDF draws Helvetica without kerning, so measure it without kerning too
  width(t, size, f = "r", cs = 0) {
    if (f !== "h" && f !== "hb") return super.width(t, size, f, cs);
    this.font(f, size);
    const s = String(t);
    return this.c.getStringUnitWidth(s, { doKerning: false }) * size + cs * s.length;
  }

  // a field of data.solid, or its default when the field was never set
  // "-" hides that part
  field(k, def) {
    if (!has(this.s, k)) return def;
    const v = this.s[k];
    if (v === "-") return Array.isArray(def) || def === null ? [] : "";
    return v;
  }

  // weight r / b; the font follows the text: Plex for Arabic, Helvetica otherwise
  ff(t, w = "r") { return AR_RE.test(String(t ?? "")) ? w : w === "b" ? "hb" : "h"; }
  // text at the start edge of the reading direction (x is that edge)
  tx(x, base, t, size, color, w = "r", align) {
    return this.text(x, base, t, size, color, this.ff(t, w), align || (this.rtl ? "right" : "left"));
  }
  fitx(x, base, t, size, color, maxW, w = "r", align) {
    return this.fit(x, base, t, size, color, maxW, this.ff(t, w), align || (this.rtl ? "right" : "left"));
  }
  wrapx(t, size, maxW, w = "r") {
    // each paragraph picks its own font
    return String(t ?? "").split("\n").flatMap((p) => this.wrap(p, size, maxW, this.ff(p, w)));
  }
  get S() { return this.rtl ? R : L; } // start edge
  get E() { return this.rtl ? L : R; } // end edge
  in(x, d) { return this.rtl ? x - d : x + d; } // move inwards from a start edge

  // a heading ending in a red full stop
  headingx(base, t, size, align) {
    align ||= this.rtl ? "right" : "left";
    const f = this.ff(t, "b");
    const w = this.width(t, size, f);
    const dot = this.width(".", size, f);
    let x0; // left edge of the heading and its dot
    if (align === "center") x0 = (PW - w - dot) / 2;
    else x0 = this.rtl ? R - w - dot : L;
    if (this.rtl) {
      this.text(x0 + dot, base, t, size, NAVY, f, "left");
      this.text(x0, base, ".", size, RED, f, "left");
    } else {
      this.text(x0, base, t, size, NAVY, f, "left");
      this.text(x0 + w, base, ".", size, RED, f, "left");
    }
  }

  // ---- data ----
  days() {
    const a = parseDay(this.d.issue_date), b = parseDay(this.d.valid_until);
    return a && b ? Math.round((b - a) / 864e5) : 0;
  }
  firstOpt() { return this.opts[0]; }
  defaultSections() {
    return this.opts.map((o) => ({
      title: o.page.title || "",
      tag: "",
      text: this.intro(o.page).replace(/\n/g, " "),
      cells: o.items.map((it) => ({ title: it.title || it.label || "", text: it.desc || (it.value != null ? String(it.value) : "") })),
    }));
  }

  // ---- cover ----
  cover() {
    const c = this.c, d = this.d, cm = this.m.cover;
    const first = this.firstOpt();
    this.rect(0, 0, PW, PH, NAVY);
    if (this.assets.logoCover) c.addImage(this.assets.logoCover, "PNG", L, 62.25, 116.25, 54, "sigLogoCover", "FAST");
    const day = parseDay(d.issue_date);
    this.spaced(R, 69.75, `QUOTATION${day ? ` · ${pad2(day.getUTCDate())} ${MONTHS[day.getUTCMonth()]} ${day.getUTCFullYear()}` : ""}`, C_META);

    // the numbers sit on rules, left to right in English, right to left in Arabic
    let stats = this.field("stats", null);
    if (!stats) {
      stats = first ? coverStats(first.card, first.items, first.tot, first.card.vat !== false) : [];
      if (stats.length > 1) stats = stats.slice(0, -1); // counts only; the price is on the pricing page
    }
    let x = this.S;
    for (const st of stats.slice(0, 4)) {
      const lw = this.width(st.label || "", 9, this.ff(st.label));
      const vw = this.width(String(st.value ?? ""), 20, this.ff(st.value, "b"));
      const w = Math.min(Math.max(84.75, lw, vw), 160);
      this.rect(this.rtl ? x - w : x, cm.rule, w, 0.75, C_RULE);
      // the number starts at the left end of its rule in both languages
      this.fit(this.rtl ? x - w : x, cm.rule + cm.val, String(st.value ?? ""), 20, WHITE, w, this.ff(st.value, "b"), "left");
      this.fitx(x, cm.rule + cm.lab, st.label || "", 9, C_EYEBROW, w);
      x = this.in(x, w + 28.5);
    }

    const sub = this.wrapx(this.field("subtitle", this.intro(first?.page).replace(/\n/g, " ")), cm.sub, R - L).slice(0, 3);
    const subLast = cm.rule - cm.subUp;
    const subTop = subLast - cm.subLead * (sub.length - 1);
    sub.forEach((l, i) => this.tx(this.S, subTop + cm.subLead * i, l, cm.sub, C_SUB));
    const title = this.wrapx(this.T.title(d.client || ""), cm.title, R - L - 14, "b").slice(0, 3);
    const titleBase = (sub.length ? subTop : subLast) - cm.titleUp;
    title.forEach((l, i) => {
      const base = titleBase - cm.titleLead * (title.length - 1 - i);
      if (i === title.length - 1) {
        const f = this.ff(l, "b");
        const w = this.width(l, cm.title, f), dot = this.width(".", cm.title, f);
        if (this.rtl) { this.text(R, base, l, cm.title, WHITE, f, "right"); this.text(R - w - dot, base, ".", cm.title, RED, f, "left"); }
        else { this.text(L, base, l, cm.title, WHITE, f, "left"); this.text(L + w, base, ".", cm.title, RED, f, "left"); }
      } else this.tx(this.S, base, l, cm.title, WHITE, "b");
    });
    const eyebrow = this.field("eyebrow", first?.page.title || d.subtitle || "");
    this.fitx(this.S, titleBase - cm.titleLead * (title.length - 1) - cm.eyebrowUp, eyebrow, 13, C_EYEBROW, R - L);

    const days = this.days();
    this.spaced(L, 783.75, `REF ${d.quote_no || ""}${days > 0 ? ` · VALID ${days} DAYS` : ""}`, C_META, 8, "left");
    this.spaced(R, 783.75, "DIGITALPLANC.COM · RIYADH", C_META);
    if (this.rtl) {
      this.rect(327.53, 830.25, 179.25, PH - 830.25, WHITE);
      this.rect(506.78, 830.25, PW - 506.78, PH - 830.25, RED);
    } else {
      this.rect(327.75, 830.25, 87.75, PH - 830.25, RED);
      this.rect(415.5, 830.25, PW - 415.5, PH - 830.25, WHITE);
    }
  }

  // ---- white pages ----
  newPage(label = this.label) {
    this.label = label;
    this.c.addPage();
    this.page += 1;
    if (this.assets.logo) this.c.addImage(this.assets.logo, "PNG", L, 62.25, 91.5, 42.75, "sigLogo", "FAST");
    this.spaced(R, 69.75, `${label} · ${pad2(this.page)}`, MUTED);
    const sl = this.seller;
    const parts = this.T.footer(sl.cr, sl.email || "info@digitalplanc.com", this.d.quote_no).filter(Boolean).join(" · ");
    this.fitx(this.S, this.m.footBase, parts, 7.5, MUTED, R - L - 40);
    this.text(this.E, this.m.numBase, pad2(this.page), 7.5, MUTED, "h", this.rtl ? "left" : "right");
    return CONT_TOP;
  }
  // continue on a new page when h does not fit under y
  room(y, h) { return y + h <= BODY_LIMIT ? y : this.newPage(); }

  // ---- scope page ----
  section(top, sec) {
    const ms = this.m.sec;
    const iS = this.in(this.S, IN), iE = this.rtl ? L + IN : R - IN;
    const desc = sec.text ? this.wrapx(sec.text, 9.5, R - L - 2 * IN) : [];
    const cells = (sec.cells || []).filter((c) => c.title || c.text);
    const cw = 147, gap = 8.25, per = 3;
    const rows = [];
    for (let i = 0; i < cells.length; i += per) {
      const row = cells.slice(i, i + per).map((c) => ({ c, lines: c.text ? this.wrapx(c.text, 8.3, cw - 19.4) : [] }));
      const n = Math.max(...row.map((r) => r.lines.length), 0);
      rows.push({ row, h: n ? ms.cellD + 12.5 * (n - 1) + ms.cellEnd : ms.cellT + ms.cellEnd });
    }
    const cellsTop = desc.length ? ms.descY + ms.descLead * (desc.length - 1) + 14.25 : ms.cellsNoDesc;
    const cellsH = rows.reduce((s, r) => s + r.h, 0) + gap * Math.max(rows.length - 1, 0);
    const h = (rows.length ? cellsTop + cellsH : desc.length ? ms.descY + ms.descLead * (desc.length - 1) + 6 : ms.titleY + 6) + ms.end + 0.75;
    top = this.room(top, h);

    this.rect(L, top, R - L, 1.5, NAVY);
    this.rect(L, top + 1.5, 0.75, h - 1.5, LINE);
    this.rect(R - 0.75, top + 1.5, 0.75, h - 1.5, LINE);
    this.rect(L, top + h - 0.75, R - L, 0.75, LINE);
    if (sec.title) this.fitx(iS, top + ms.titleY, sec.title, ms.title, NAVY, 300, "b");
    if (sec.tag) this.spaced(this.rtl ? iE : iE + 1.8, top + ms.titleY, String(sec.tag).toUpperCase(), RED, 8, this.rtl ? "left" : "right");
    desc.forEach((l, i) => this.tx(iS, top + ms.descY + ms.descLead * i, l, 9.5, BODY));
    let y = top + cellsTop;
    for (const r of rows) {
      r.row.forEach(({ c, lines }, j) => {
        const x0 = this.rtl ? iS - cw - j * (cw + gap) : iS + j * (cw + gap);
        this.rect(x0, y, cw, r.h, BOX);
        const cs = this.rtl ? x0 + cw - 9.7 : x0 + 9.7;
        this.fitx(cs, y + ms.cellT, c.title || "", 10, NAVY, cw - 19.4, "b");
        lines.forEach((l, k) => this.tx(cs, y + ms.cellD + 12.5 * k, l, 8.3, MUTED));
      });
      y += r.h + gap;
    }
    return top + h;
  }

  chips(top, list) {
    const g = this.m.get;
    const sized = list.map((t) => ({ t, w: this.width(t, g.chipSize, this.ff(t, "b")) + 2 * g.pad }));
    // rows centred on the page, filled in reading order
    const rows = [[]];
    let rw = 0;
    for (const s of sized) {
      if (rows[rows.length - 1].length && rw + g.gapX + s.w > R - L) { rows.push([]); rw = 0; }
      rw += (rows[rows.length - 1].length ? g.gapX : 0) + s.w;
      rows[rows.length - 1].push(s);
    }
    let y = top;
    for (const row of rows) {
      const total = row.reduce((s, c) => s + c.w, 0) + g.gapX * (row.length - 1);
      let x = this.rtl ? (PW + total) / 2 : (PW - total) / 2;
      for (const c of row) {
        const x0 = this.rtl ? x - c.w : x;
        this.rect(x0, y, c.w, g.chipH, NAVY);
        this.text(x0 + c.w / 2, y + g.chipBase, c.t, g.chipSize, WHITE, this.ff(c.t, "b"), "center");
        x = this.rtl ? x0 - g.gapX : x0 + c.w + g.gapX;
      }
      y += g.chipH + g.gapX;
    }
    return y - g.gapX;
  }

  scope() {
    const m = this.m;
    let y = this.newPage("SCOPE");
    this.headingx(m.head.base, this.T.scope, m.head.size);
    let base = m.head.base;
    const quote = this.field("quote", this.T.quote);
    if (quote) {
      const open = this.rtl ? "«" : "“", close = this.rtl ? "»" : "”";
      const lines = this.wrapx(quote, m.quote.size, m.quote.w, "b");
      lines.forEach((l, i) => {
        base = m.head.base + m.quote.gap + m.quote.lead * i;
        const f = this.ff(l, "b");
        const lead = i === 0 ? open : "", tail = i === lines.length - 1 ? close : "";
        const w = this.width(l, m.quote.size, f), wl = lead ? this.width(lead, m.quote.size, f) : 0, wt = tail ? this.width(tail, m.quote.size, f) : 0;
        // the opening mark sits at the start of the reading direction
        const x0 = (PW - w - wl - wt) / 2;
        if (this.rtl) {
          if (tail) this.text(x0, base, tail, m.quote.size, RED, f, "left");
          this.text(x0 + wt, base, l, m.quote.size, NAVY, f, "left");
          if (lead) this.text(x0 + wt + w, base, lead, m.quote.size, RED, f, "left");
        } else {
          if (lead) this.text(x0, base, lead, m.quote.size, RED, f, "left");
          this.text(x0 + wl, base, l, m.quote.size, NAVY, f, "left");
          if (tail) this.text(x0 + wl + w, base, tail, m.quote.size, RED, f, "left");
        }
      });
    }
    const intro = this.field("intro", "");
    if (intro) {
      const lines = this.wrapx(intro, 12.5, m.intro.w);
      const first = quote ? base + m.intro.gap : m.head.base + m.quote.gap;
      lines.forEach((l, i) => { base = first + m.intro.lead * i; this.text(PW / 2, base, l, 12.5, BODY, this.ff(l), "center"); });
    }
    y = (quote || intro ? base : m.head.base) + 25.5;
    for (const sec of this.field("sections", this.defaultSections())) {
      if (!sec || !(sec.title || sec.text || sec.cells?.length)) continue;
      y = this.section(y, sec) + 14.25;
    }
    const chips = (this.field("chips", this.T.chips) || []).filter(Boolean);
    if (chips.length) {
      const g = m.get;
      y = this.room(y - 14.25, g.gap + g.chipTop + g.chipH + 10);
      const hb = y + g.gap;
      this.headingx(hb, this.T.get, 16, "center");
      this.chips(hb + g.chipTop, chips);
    }
  }

  // ---- pricing page ----
  infoBox(x, top, w, h, label, lines) {
    const mb = this.m.boxes;
    this.rect(x, top, w, h, BOX);
    this.c.setDrawColor(...LINE);
    this.c.setLineWidth(0.75);
    this.c.rect(x + 0.375, top + 0.375, w - 0.75, h - 0.75, "S");
    const s = this.rtl ? x + w - IN : x + IN;
    this.tx(s, top + mb.label, label, 11, NAVY, "b");
    lines.forEach((l, i) => this.fitx(s, top + mb.first + mb.lead * i, l, 9.5, i ? MUTED : BODY, w - 2 * IN));
  }

  packageBox(top, o, multi) {
    const mp = this.m.pkg, T = this.T, vatOn = o.card.vat !== false;
    const title = multi ? o.page.title || T.full : this.field("package", T.full);
    const descText = multi ? this.intro(o.page).replace(/\n/g, " ") : this.field("package_desc", this.intro(o.page).replace(/\n/g, " "));
    const desc = descText ? this.wrapx(descText, 9.5, mp.descW) : [];
    const sub = [vatOn ? T.excl : "", o.tot.discount ? T.after(fmt(o.tot.discount)) : ""].filter(Boolean).join(" · ");
    const priceEnd = vatOn ? mp.incl + mp.end : (sub ? mp.excl : mp.price) + mp.end;
    const h = Math.max(desc.length ? mp.desc + 16.5 * (desc.length - 1) + mp.descEnd : mp.title + mp.descEnd, priceEnd) + 0.75;
    top = this.room(top, h);
    this.rect(L, top, R - L, h, BOX);
    this.rect(L, top, R - L, 1.5, RED);
    this.rect(L, top + 1.5, 0.75, h - 1.5, LINE);
    this.rect(R - 0.75, top + 1.5, 0.75, h - 1.5, LINE);
    this.rect(L, top + h - 0.75, R - L, 0.75, LINE);
    const s = this.in(this.S, 23.46), e = this.rtl ? L + 23.68 : R - 23.47;
    this.fitx(s, top + mp.title, title, 14, NAVY, 300, "b");
    desc.forEach((l, i) => this.tx(s, top + mp.desc + 16.5 * i, l, 9.5, BODY));
    // the price block sits at the end edge: "1,000 SAR" / "ر.س 1,000"
    const num = fmt(o.tot.net);
    const cur = T.cur;
    const align = this.rtl ? "left" : "right";
    if (this.rtl) {
      const cw = this.text(e, top + mp.price, cur, 11, MUTED, this.ff(cur), "left");
      this.text(e + cw + this.width(" ", 32, "hb"), top + mp.price, num, 32, NAVY, "hb", "left");
    } else {
      const cw = this.text(e, top + mp.price, cur, 11, MUTED, "h", "right");
      this.text(e - cw - this.width(" ", 32, "hb"), top + mp.price, num, 32, NAVY, "hb", "right");
    }
    if (sub) this.text(e, top + mp.excl, sub, 9, MUTED, this.ff(sub), align);
    if (vatOn) { const inc = T.incl(fmt(o.tot.total)); this.text(e, top + mp.incl, inc, 10, MUTED, this.ff(inc), align); }
    return top + h;
  }

  bank(top) {
    const m = this.m, sl = this.seller, T = this.T;
    const vals = [sl.holder || sl.name || "", this.rtl ? sl.bank || sl.bank_en || "" : sl.bank_en || sl.bank || "", sl.account || "", sl.iban || ""];
    const cols = T.cols.map((label, i) => ({ label, value: vals[i] })).filter((c) => c.value);
    const crLine = T.cr(this.rtl ? sl.name || sl.holder || "" : sl.name_en || sl.name || "", sl.cr);
    const h = m.bankHead + m.table + m.tableH + (crLine ? m.crLine : 0) + 10;
    top = this.room(top, h);
    const hb = top + m.bankHead;
    this.headingx(hb, T.bank, 16);
    const tt = hb + m.table;
    this.rect(L, tt, R - L, m.tableH, BOX);
    this.rect(L, tt, R - L, 1.5, NAVY);
    this.rect(L, tt + 1.5, 0.75, m.tableH - 1.5, LINE);
    this.rect(R - 0.75, tt + 1.5, 0.75, m.tableH - 1.5, LINE);
    this.rect(L, tt + m.tableH - 0.75, R - L, 0.75, LINE);
    // columns as wide as their text; the last one takes the rest
    const ws = cols.map((c) => Math.max(this.width(c.label, 8, this.ff(c.label)), this.width(c.value, m.valSize, this.ff(c.value, "b"))) + 2 * m.pad);
    const fixed = ws.slice(0, -1).reduce((s, w) => s + w, 0);
    if (ws.length) ws[ws.length - 1] = Math.max(R - L - fixed, ws[ws.length - 1]);
    const scale = Math.min(1, (R - L) / ws.reduce((s, w) => s + w, 0));
    let x = this.S;
    cols.forEach((c, i) => {
      const w = ws[i] * scale;
      const cs = this.in(x, m.pad * scale);
      this.fitx(cs, tt + m.colLab, c.label, 8, MUTED, w - 2 * m.pad * scale);
      this.fitx(cs, tt + m.colVal, c.value, m.valSize, NAVY, w - 2 * m.pad * scale, "b");
      x = this.in(x, w);
      if (i < cols.length - 1) this.rect(this.rtl ? x - 0.75 : x, tt + 1.5, 0.75, m.tableH - 2.25, LINE);
    });
    let end = tt + m.tableH;
    if (crLine) { end += m.crLine; this.fitx(this.S, end, crLine, 7.5, MUTED, R - L); }
    return end;
  }

  signs(base) {
    const m = this.m, d = this.d;
    const half = 235.5;
    if (this.rtl) {
      this.text(R, base, this.T.approval(d.client || ""), 9, MUTED, this.ff(this.T.approval(d.client || "")), "right");
      this.text(R - half - 22.5, base - 1.5, "PLAN C", 9, MUTED, "h", "right");
    } else {
      this.text(L, base, this.T.approval(d.client || ""), 9, MUTED, this.ff(this.T.approval(d.client || "")), "left");
      this.text(L + half + 22.5, base, "PLAN C", 9, MUTED, "h", "left");
    }
    this.rect(L, base + m.signLine, half, 0.75, NAVY);
    this.rect(R - half, base + m.signLine, half, 0.75, NAVY);
  }

  pricingPage() {
    const m = this.m, T = this.T, d = this.d;
    this.newPage("PRICING");
    this.headingx(m.head.base, T.pricing, m.head.size);
    const first = this.firstOpt();
    const mb = m.boxes;
    const forLines = [d.client || "", this.field("client_desc", "")].filter(Boolean);
    const projLines = (this.field("project", [first?.page.title, d.subtitle].filter(Boolean)) || []).filter(Boolean).slice(0, 4);
    const n = Math.max(forLines.length, projLines.length, 1);
    const bh = mb.first + mb.lead * (n - 1) + mb.end;
    const startBox = this.rtl ? [306.53, 237.75] : [L, 238.5];
    const endBox = this.rtl ? [L, 238.5] : [306, 238.5];
    this.infoBox(startBox[0], mb.top, startBox[1], bh, T.for, forLines);
    this.infoBox(endBox[0], mb.top, endBox[1], bh, T.project, projLines);
    let y = mb.top + bh + m.pkg.gap;
    const multi = this.opts.length > 1;
    this.opts.forEach((o, i) => { y = this.packageBox(y + (i ? 12 : 0), o, multi); });
    const vatOn = first ? first.card.vat !== false : true;
    const note = T.note(vatOn ? fmt(this.vat) : "", this.days());
    y = this.room(y, m.note + 4);
    this.fitx(this.S, y + m.note, note, 9, MUTED, R - L);
    y += m.note;
    if (this.seller.iban) y = this.bank(y);
    y = this.room(y, m.sign + m.signLine + 2);
    this.signs(y + m.sign);
  }

  build() {
    this.opts = this.options();
    this.cover();
    this.scope();
    this.pricingPage();
    return this.c;
  }
}

// Returns { doc, warnings }. assets: { fontRegular, fontBold, logo, logoCover }.
export function buildSolid(data, assets, pricing, opts) {
  const q = new Solid(data, assets, pricing, opts);
  const doc = q.build();
  return { doc, warnings: q.warnings };
}
