// PLAN C invoice PDF: the three Saudi invoice models in the quote's fixed
// frame (navy bar, logo, header rules, footer, IBM Plex Sans Arabic, theme
// colours). Only the body below the header is invoice specific.
import QRCode from "qrcode";
import { Quote, ML, MR, HEADER_LINE, FOOTER_LINE, CONTENT_LIMIT } from "./engine.js";
import { invoiceTotals, zatcaQR, typeOf, money2, addressLines } from "../lib/invoice.js";

const CW = MR - ML;
const GAP = 12; // between the two party boxes

// table columns, right to left: [label, sub label, width]
const COLS = {
  standard: [
    ["وصف الخدمة", "", 170], ["الكمية", "", 40], ["سعر الوحدة", "قبل الضريبة", 66], ["الصافي", "قبل الضريبة", 66],
    ["نسبة", "الضريبة", 40], ["مبلغ", "الضريبة", 62], ["الإجمالي", "شامل الضريبة", 75],
  ],
  simplified: [["وصف الخدمة", "", 249], ["الكمية", "", 60], ["سعر الوحدة", "شامل الضريبة", 100], ["الإجمالي", "شامل الضريبة", 110]],
  plain: [["وصف الخدمة", "", 249], ["الكمية", "", 60], ["سعر الوحدة", "", 100], ["الإجمالي", "", 110]],
};

class Invoice extends Quote {
  constructor(inv, assets, theme) {
    super({ client: inv.buyer?.name || "" }, assets, { services: {} }, theme);
    this.inv = inv;
    this.type = inv.type || "standard";
    this.tot = invoiceTotals(inv);
    this.c.setDocumentProperties({ title: `${typeOf(this.type).label} ${inv.number || ""}`, author: "PLAN C" });
  }

  frame(n, total) {
    const c = this.c, t = this.t, inv = this.inv;
    this.rect(0, 0, c.internal.pageSize.getWidth(), 8, t.bar, false);
    if (this.logo) c.addImage(this.logo, "PNG", ML, 28.34, 140, 65.325138, "logo", "FAST");
    this.fitText(MR, 53.05, typeOf(this.type).label, 21, t.ink, MR - 198, this.emph());
    this.fitText(MR, 83.7, inv.subject || inv.buyer?.name || "", 14, t.muted, MR - 198);
    this.rule(HEADER_LINE, ML, MR, 0.7);
    this.rule(FOOTER_LINE, ML, MR, 0.7);
    c.setFont("helvetica", "normal");
    c.setFontSize(8);
    c.setTextColor(...t.footer);
    const right = `${inv.number || ""} | ${n} / ${total}`;
    c.text("PLAN C / CREATIVE SOLUTIONS", ML, 824, { baseline: "alphabetic" });
    c.text(right, MR - c.getTextWidth(right), 824, { baseline: "alphabetic" });
  }

  // invoice number, issue date and time, supply date
  meta(top) {
    const t = this.t, inv = this.inv, w = CW / 4;
    [["رقم الفاتورة", inv.number], ["تاريخ الإصدار", inv.issueDate], ["وقت الإصدار", inv.issueTime], ["تاريخ التوريد", inv.supplyDate]]
      .forEach(([label, value], i) => {
        const x = MR - i * w;
        this.text(x, top + 14, label, 10, t.muted);
        this.fitText(x, top + 33, value || "—", 13, t.ink, w - 10);
      });
    this.rule(top + 47, ML, MR, 0.5);
    return top + 47;
  }

  partyLines(who) {
    const inv = this.inv, s = inv.seller || {}, b = inv.buyer || {};
    if (who === "seller") {
      const rows = [["السجل التجاري", s.cr]];
      if (this.type !== "plain") rows.push(["الرقم الضريبي", s.vat]);
      return { label: "المورّد", name: s.name || "—", rows: rows.filter((r) => r[1]), addr: addressLines(s) };
    }
    if (this.type === "simplified") {
      const rows = [["العميل", b.name], ["طريقة السداد", inv.payMethod], ["العملة", "ريال سعودي"]];
      return { label: "بيانات العملية", name: inv.txn || inv.subject || "عملية بيع", rows: rows.filter((r) => r[1]), addr: [] };
    }
    const rows = [];
    if (this.type === "standard") rows.push(["الرقم الضريبي", b.vat]);
    rows.push(["السجل التجاري", b.cr]);
    return { label: "المشتري", name: b.name || "—", rows: rows.filter((r) => r[1]), addr: addressLines(b) };
  }

  // seller on the right, buyer (or the sale, for a simplified invoice) on the left
  parties(top) {
    const w = (CW - GAP) / 2;
    const boxes = ["seller", "buyer"].map((who) => {
      const p = this.partyLines(who);
      const name = this.wrap(p.name, 14, w - 28).slice(0, 2);
      const h = 34 + name.length * 20 + p.rows.length * 17 + (p.addr.length ? 17 + p.addr.length * 15 : 0) + 6;
      return { p, name, h };
    });
    const h = Math.max(...boxes.map((b) => b.h));
    boxes.forEach(({ p, name }, i) => {
      const right = MR - i * (w + GAP);
      const t = this.t;
      this.rect(right - w, top, w, h, t.box);
      const x = right - 14;
      let y = top + 22;
      this.text(x, y, p.label, 11, t.muted);
      y += 6;
      for (const line of name) { y += 20; this.text(x, y, line, 14, t.ink, "right", this.emph()); }
      y += 4;
      for (const [label, value] of p.rows) {
        y += 17;
        this.text(x, y, label, 10, t.muted);
        const lw = this.width(label, 10) + 8;
        this.fitText(x - lw, y, value, 10.5, t.ink, w - 28 - lw);
      }
      if (p.addr.length) {
        y += 17;
        this.text(x, y, "العنوان الوطني", 10, t.muted);
        for (const line of p.addr) { y += 15; this.fitText(x, y, line, 10, t.ink, w - 28); }
      }
    });
    return top + h;
  }

  sectionHead(base) {
    const t = this.t;
    this.text(MR, base, "تفاصيل الخدمات", 16, t.ink, "right", this.emph());
    this.text(ML, base, "جميع المبالغ بالريال السعودي", 9.5, t.muted, "left");
    return base;
  }

  tableHead(top) {
    const t = this.t, cols = COLS[this.type];
    this.rect(ML, top, CW, 34, t.box2, false);
    let right = MR;
    cols.forEach(([label, sub, w], i) => {
      const cx = right - w / 2;
      const x = i === 0 ? right - 10 : cx;
      const align = i === 0 ? "right" : "center";
      if (sub) {
        this.text(x, top + 15, label, 9.5, t.ink, align);
        this.text(x, top + 27, sub, 7.5, t.muted, align);
      } else this.text(x, top + 21, label, 9.5, t.ink, align);
      right -= w;
    });
    return top + 34;
  }

  rowLayout(it) {
    const w = COLS[this.type][0][2] - 16;
    const title = this.wrap(it.title || "", 11.5, w);
    const desc = it.desc ? this.wrap(it.desc, 9, w) : [];
    return { title, desc, h: 16 + title.length * 16 + desc.length * 13 + 4 };
  }

  row(top, it, line, lay) {
    const t = this.t, cols = COLS[this.type];
    let y = top + 4;
    for (const s of lay.title) { y += 16; this.text(MR - 10, y, s, 11.5, t.ink); }
    for (const s of lay.desc) { y += 13; this.text(MR - 10, y, s, 9, t.muted); }
    const r = this.tot.rate;
    const nums = this.type === "standard"
      ? [fmtQty(line.qty), money2(line.price), money2(line.net), `${r}%`, money2(line.vat), money2(line.total)]
      : [fmtQty(line.qty), money2(line.price), money2(line.total)];
    let right = MR - cols[0][2];
    nums.forEach((v, i) => {
      const w = cols[i + 1][2];
      this.fitText(right - w / 2 + this.width(v, 10.5) / 2, top + 20, v, 10.5, t.ink, w - 6);
      right -= w;
    });
    this.rule(top + lay.h, ML, MR, 0.5);
    return top + lay.h;
  }

  totalsRows() {
    const T = this.tot, r = T.rate;
    const rows = [];
    if (this.type === "plain") {
      rows.push(["إجمالي الخدمات", T.subtotal], ["الخصم", T.discount]);
      return { rows, label: "الإجمالي المستحق" };
    }
    if (T.discount) rows.push([this.type === "simplified" ? "الإجمالي قبل الخصم" : "الإجمالي قبل الخصم", T.subtotal], ["الخصم", T.discount]);
    rows.push(["المبلغ الخاضع للضريبة", T.taxable], [`ضريبة القيمة المضافة (${r}%)`, T.vat]);
    return { rows, label: "الإجمالي شامل الضريبة" };
  }
  totalsHeight() { return this.totalsRows().rows.length * 27 + 12 + 42; }

  totals(top) {
    const t = this.t, T = this.tot;
    const { rows, label } = this.totalsRows();
    const w = 262, x0 = MR - w;
    let y = top;
    for (const [l, v] of rows) {
      this.text(MR - 8, y + 18, l, 11.5, t.ink);
      this.text(x0 + 10, y + 18, money2(v), 11.5, t.ink, "left");
      y += 27;
      this.rule(y, x0, MR, 0.4);
    }
    y += 12;
    this.rect(x0, y, w, 42, t.totalBg, false);
    this.text(MR - 12, y + 26, label, 12.5, t.ink, "right", this.emph());
    this.text(x0 + 12, y + 27, `${money2(T.total)} SAR`, 15, t.accent, "left", this.emph());
    const end = y + 42;

    // left: the ZATCA QR code, or the transfer details on a plain invoice
    if (this.type !== "plain") {
      const size = 96;
      this.qr(ML, top + 2, size);
      const x = ML + size + 14 + 120;
      this.text(x, top + 26, "رمز الاستجابة السريعة", 10.5, t.ink);
      this.para2(x, top + 42, "امسح الرمز للتحقق من بيانات الفاتورة عبر تطبيق هيئة الزكاة والضريبة والجمارك.", 8.5, 12.5, 120, t.muted);
    } else {
      const s = this.inv.seller || {};
      const lines = [["اسم المستفيد", s.holder || s.name], ["البنك", s.bank], ["الآيبان", s.iban]].filter((r) => r[1]);
      if (lines.length) {
        const bw = 230, right = ML + bw;
        this.rect(ML, top, bw, 30 + lines.length * 18, t.box);
        this.text(right - 12, top + 20, "بيانات التحويل", 11, t.muted);
        lines.forEach(([l, v], i) => {
          const yy = top + 38 + i * 18;
          this.text(right - 12, yy, l, 9.5, t.muted);
          this.fitText(right - 20 - this.width(l, 9.5), yy, v, 10, t.ink, bw - 40 - this.width(l, 9.5));
        });
      }
    }
    return end;
  }

  para2(x, base, text, size, lead, maxW, color) {
    this.wrap(text, size, maxW).forEach((l, i) => this.text(x, base + i * lead, l, size, color));
  }

  qr(x, top, size) {
    if (this.dry) return;
    const q = QRCode.create(zatcaQR(this.inv, this.tot), { errorCorrectionLevel: "M" });
    const n = q.modules.size, cell = size / n, c = this.c;
    c.setFillColor(255, 255, 255);
    c.rect(x - 4, top - 4, size + 8, size + 8, "F");
    c.setFillColor(...this.t.ink);
    for (let r = 0; r < n; r++) {
      for (let col = 0; col < n; col++) {
        if (q.modules.data[r * n + col]) c.rect(x + col * cell, top + r * cell, cell + 0.05, cell + 0.05, "F");
      }
    }
  }

  payment(top) {
    const t = this.t, inv = this.inv, s = inv.seller || {};
    this.rule(top, ML, MR, 0.5);
    const base = top + 26;
    this.text(MR, base, "السداد", 13, t.ink, "right", this.emph());
    let x = MR - 70;
    const pair = (l, v) => {
      if (!v) return;
      this.text(x, base, l, 10, t.muted);
      x -= this.width(l, 10) + 8;
      this.text(x, base, v, 11, t.ink);
      x -= this.width(v, 11) + 26;
    };
    pair("الطريقة", inv.payMethod);
    pair("تاريخ الاستحقاق", inv.dueDate);
    let end = base + 14;
    if (this.type !== "plain" && /تحويل/.test(inv.payMethod || "") && s.iban) {
      const line = [s.bank, s.iban, s.holder ? `المستفيد: ${s.holder}` : ""].filter(Boolean).join("   ·   ");
      this.fitText(MR - 70, base + 20, line, 9.5, t.muted, CW - 70);
      end = base + 28;
    }
    return end;
  }

  notesHeight() {
    return this.inv.notes ? 22 + this.wrap(this.inv.notes, 10, CW - 90).length * 15 : 0;
  }
  notes(top) {
    if (!this.inv.notes) return top;
    const t = this.t;
    this.text(MR, top + 18, "ملاحظات", 11, t.ink, "right", this.emph());
    this.wrap(this.inv.notes, 10, CW - 90).forEach((l, i) => this.text(MR - 80, top + 18 + i * 15, l, 10, t.muted));
    return top + this.notesHeight();
  }

  build() {
    const items = (this.inv.items || []).filter((it) => it.title || Number(it.price));
    const pages = [];
    // plan the pages first, then paint
    const plan = () => {
      this.dry = true;
      let page = { rows: [] };
      let y = this.parties(this.meta(HEADER_LINE + 12) + 14) + 34 + 12 + 34;
      items.forEach((it, i) => {
        const lay = this.rowLayout(it);
        if (y + lay.h > CONTENT_LIMIT) { pages.push(page); page = { rows: [] }; y = HEADER_LINE + 22 + 34; }
        page.rows.push(i);
        y += lay.h;
      });
      const tail = 18 + this.totalsHeight() + 20 + 44 + (this.inv.notes ? 14 + this.notesHeight() : 0);
      page.tailOnNext = y + tail > CONTENT_LIMIT;
      pages.push(page);
      if (page.tailOnNext) pages.push({ rows: [], tailOnly: true });
      this.dry = false;
    };
    plan();
    const lines = this.tot.lines;
    const all = this.inv.items || [];
    pages.forEach((page, idx) => {
      if (idx) this.c.addPage();
      this.frame(idx + 1, pages.length);
      let y;
      if (idx === 0) {
        y = this.parties(this.meta(HEADER_LINE + 12) + 14) + 34;
        this.sectionHead(y);
        y = this.tableHead(y + 12);
      } else if (!page.tailOnly) y = this.tableHead(HEADER_LINE + 22);
      else y = HEADER_LINE + 10;
      for (const i of page.rows) {
        const it = items[i];
        y = this.row(y, it, lines[all.indexOf(it)], this.rowLayout(it));
      }
      const last = idx === pages.length - 1;
      if (last) {
        y = this.totals(y + 18);
        y = this.payment(y + 20);
        if (this.inv.notes) this.notes(y + 14);
      }
    });
    return this.c;
  }
}

const fmtQty = (n) => String(Math.round(Number(n) * 100) / 100);

// Returns the jsPDF document. assets: { fontRegular, fontBold?, logo }.
export function buildInvoice(inv, assets, theme) {
  return new Invoice(inv, assets, theme).build();
}
