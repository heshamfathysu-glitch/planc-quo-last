// One invoice: every field saves as you type, with a live PDF preview.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { get, put, remove, list, useSetting, useCollection } from "../lib/store.js";
import { renderInvoice, downloadInvoice } from "../pdf/render.js";
import Preview from "../pdf/Preview.jsx";
import {
  INVOICE_TYPES, INVOICE_STATUSES, PAY_METHODS, typeOf, invoiceTotals, money2, missing, nextNumber, DEFAULT_SELLER,
} from "../lib/invoice.js";
import { toast, ConfirmButton, Loading } from "../ui.jsx";
import NotFound from "./NotFound.jsx";

const ADDRESS = [
  ["building", "رقم المبنى"], ["street", "الشارع"], ["district", "الحي"], ["city", "المدينة"], ["postal", "الرمز البريدي"],
];

export default function InvoiceEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const theme = useSetting("theme", null);
  const seller = useSetting("seller", null);
  const [clients] = useCollection("clients");
  const [inv, setInv] = useState(undefined);
  const [pdf, setPdf] = useState({ blob: null, error: "" });
  const [saved, setSaved] = useState("");
  const [view, setView] = useState("edit");
  const timer = useRef(null);

  useEffect(() => { get("invoices", id).then(setInv); }, [id]);

  useEffect(() => {
    if (!inv) return;
    const t = setTimeout(async () => {
      try {
        const r = await renderInvoice(inv, theme);
        URL.revokeObjectURL(r.url);
        setPdf({ blob: r.blob, error: "" });
      } catch (e) {
        setPdf((p) => ({ ...p, error: String(e.message || e) }));
      }
    }, 450);
    return () => clearTimeout(t);
  }, [inv, theme]);

  if (inv === undefined) return <Loading />;
  if (!inv) return <NotFound text="هذه الفاتورة غير موجودة، ربما تم حذفها." />;

  const T = invoiceTotals(inv);
  const type = typeOf(inv.type);
  const gaps = missing(inv);

  function save(next, now) {
    next = { ...next, total: invoiceTotals(next).total };
    setInv(next);
    setSaved("جار الحفظ...");
    clearTimeout(timer.current);
    const go = async () => {
      try { await put("invoices", next, user); setSaved("تم الحفظ"); } catch { setSaved("تعذر الحفظ، ستُحفظ التعديلات عند التعديل التالي"); }
    };
    if (now) return go();
    timer.current = setTimeout(go, 500);
  }
  const set = (patch) => save({ ...inv, ...patch });
  const setBuyer = (patch) => set({ buyer: { ...inv.buyer, ...patch } });
  const setSeller = (patch) => set({ seller: { ...inv.seller, ...patch } });
  const setItem = (i, patch) => set({ items: inv.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });

  // picking a saved client fills the tax number and city
  function buyerName(name) {
    const c = (clients || []).find((x) => x.name === name);
    setBuyer(c ? { name, vat: inv.buyer.vat || c.vat || "", city: inv.buyer.city || c.city || "" } : { name });
  }

  async function archive(on) {
    await save({ ...inv, archived: on }, true);
    toast(on ? "تم نقل الفاتورة إلى الأرشيف" : "تمت استعادة الفاتورة من الأرشيف");
  }
  async function duplicate() {
    const { id: _id, createdAt, updatedAt, createdBy, updatedBy, ...rest } = inv; // eslint-disable-line no-unused-vars
    const all = await list("invoices");
    const copy = await put("invoices", { ...rest, status: "draft", archived: false, number: nextNumber(all, rest.issueDate.slice(0, 4)) }, user);
    toast("تم نسخ الفاتورة");
    nav(`/invoice/${copy.id}`);
  }
  async function del() {
    await remove("invoices", id);
    toast("تم حذف الفاتورة");
    nav("/invoices");
  }
  const exportPDF = () => downloadInvoice(inv, theme).then(() => toast("تم تصدير ملف PDF"), () => toast("تعذر إنشاء ملف PDF. حاول مرة أخرى.", "error"));
  const priceLabel = inv.type === "simplified" ? "سعر الوحدة شامل الضريبة" : inv.type === "plain" ? "سعر الوحدة" : "سعر الوحدة قبل الضريبة";

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{type.label} {inv.archived && <span className="badge st-expired" style={{ fontSize: 13 }}>مؤرشفة</span>}</h1>
          <div className="sub"><span dir="ltr">{inv.number}</span> · {money2(T.total)} ر.س · {inv.buyer?.name || inv.txn || "بدون عميل"}</div>
        </div>
        <div className="row editor-actions">
          <select className="in auto" aria-label="حالة الفاتورة" value={inv.status} onChange={(e) => set({ status: e.target.value })}>
            {INVOICE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button className="lq primary" onClick={exportPDF}>تصدير PDF</button>
          <button className="lq" onClick={duplicate}>نسخ</button>
          <button className="lq" onClick={() => archive(!inv.archived)}>{inv.archived ? "إلغاء الأرشفة" : "أرشفة"}</button>
          <ConfirmButton onConfirm={del}>حذف</ConfirmButton>
        </div>
      </div>

      <div className="tabs viewswitch">
        <button className={`tab${view === "edit" ? " on" : ""}`} onClick={() => setView("edit")}>تعديل</button>
        <button className={`tab${view === "preview" ? " on" : ""}`} onClick={() => setView("preview")}>معاينة</button>
      </div>

      <div className="editor" data-view={view}>
        <div className="edit-col">
          {gaps.length > 0 && <div className="card warn" role="status" style={{ fontSize: 13 }}>ينقص الفاتورة: {gaps.join("، ")}.</div>}

          <div className="card grid g2">
            <label className="f">نوع الفاتورة
              <select className="in" value={inv.type} onChange={(e) => set({ type: e.target.value })}>
                {INVOICE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label className="f">رقم الفاتورة<input className="in" dir="ltr" value={inv.number} onChange={(e) => set({ number: e.target.value })} /></label>
            <label className="f">تاريخ الإصدار<input className="in" type="date" dir="ltr" value={inv.issueDate} onChange={(e) => set({ issueDate: e.target.value })} /></label>
            <label className="f">وقت الإصدار<input className="in" type="time" step="1" dir="ltr" value={inv.issueTime} onChange={(e) => set({ issueTime: e.target.value })} /></label>
            <label className="f">تاريخ التوريد<input className="in" type="date" dir="ltr" value={inv.supplyDate} onChange={(e) => set({ supplyDate: e.target.value })} /></label>
            <label className="f">موضوع الفاتورة (تحت العنوان)<input className="in" placeholder="مثل: خدمات تصوير وإنتاج فيديو" value={inv.subject || ""} onChange={(e) => set({ subject: e.target.value })} /></label>
          </div>

          <div className="card grid">
            <b>{inv.type === "simplified" ? "العميل (اختياري)" : "المشتري"}</b>
            <div className="grid g2">
              <label className="f">الاسم كما في السجل التجاري
                <input className="in" list="inv-clients" value={inv.buyer.name} onChange={(e) => buyerName(e.target.value)} />
                <datalist id="inv-clients">{(clients || []).map((c) => <option key={c.id} value={c.name} />)}</datalist>
              </label>
              {inv.type === "standard" && <label className="f">الرقم الضريبي (15 رقما)<input className="in" dir="ltr" inputMode="numeric" maxLength={15} value={inv.buyer.vat} onChange={(e) => setBuyer({ vat: e.target.value.replace(/\D/g, "") })} /></label>}
              {inv.type !== "simplified" && <label className="f">السجل التجاري<input className="in" dir="ltr" value={inv.buyer.cr || ""} onChange={(e) => setBuyer({ cr: e.target.value })} /></label>}
              {inv.type === "simplified" && <label className="f">وصف العملية<input className="in" placeholder="مثل: جلسة تصوير لفرد" value={inv.txn || ""} onChange={(e) => set({ txn: e.target.value })} /></label>}
            </div>
            {inv.type !== "simplified" && (
              <div className="grid g3">
                {ADDRESS.map(([k, l]) => <label className="f" key={k}>{l}<input className="in" value={inv.buyer[k] || ""} onChange={(e) => setBuyer({ [k]: e.target.value })} /></label>)}
              </div>
            )}
          </div>

          <div className="card grid">
            <b>الخدمات</b>
            {inv.items.map((it, i) => (
              <div className="block" key={i} style={{ display: "grid", gap: 8 }}>
                <div className="row">
                  <input className="in auto" style={{ flex: 1 }} placeholder="اسم الخدمة" aria-label="اسم الخدمة" value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} />
                  <button className="lq sm danger" aria-label="حذف الخدمة" disabled={inv.items.length < 2} onClick={() => set({ items: inv.items.filter((_, j) => j !== i) })}>حذف</button>
                </div>
                <input className="in" placeholder="وصف مختصر (اختياري)" aria-label="وصف الخدمة" value={it.desc || ""} onChange={(e) => setItem(i, { desc: e.target.value })} />
                <div className="grid g3">
                  <label className="f">الكمية<input className="in" type="number" min="0" dir="ltr" value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value === "" ? "" : Number(e.target.value) })} /></label>
                  <label className="f">{priceLabel}<input className="in" type="number" min="0" step="0.01" dir="ltr" value={it.price} onChange={(e) => setItem(i, { price: e.target.value === "" ? "" : Number(e.target.value) })} /></label>
                  <label className="f">الإجمالي<input className="in" dir="ltr" readOnly value={money2(T.lines[i]?.total || 0)} /></label>
                </div>
              </div>
            ))}
            <div className="row">
              <button className="lq sm" onClick={() => set({ items: [...inv.items, { title: "", desc: "", qty: 1, price: 0 }] })}>+ إضافة خدمة</button>
            </div>
            <div className="grid g3">
              <label className="f">الخصم (ر.س){inv.type === "simplified" ? " من المبلغ الشامل" : " قبل الضريبة"}<input className="in" type="number" min="0" step="0.01" dir="ltr" value={inv.discount || 0} onChange={(e) => set({ discount: Number(e.target.value) || 0 })} /></label>
              {inv.type !== "plain" && <label className="f">نسبة الضريبة %<input className="in" type="number" min="0" dir="ltr" value={inv.vatRate} onChange={(e) => set({ vatRate: Number(e.target.value) || 0 })} /></label>}
            </div>
            <div className="sub" style={{ fontSize: 14 }}>
              {inv.type !== "plain" && <>الخاضع للضريبة {money2(T.taxable)} · الضريبة {money2(T.vat)} · </>}
              <b>الإجمالي {money2(T.total)} ر.س</b>
            </div>
          </div>

          <div className="card grid g2">
            <label className="f">طريقة السداد
              <input className="in" list="inv-pay" value={inv.payMethod || ""} onChange={(e) => set({ payMethod: e.target.value })} />
              <datalist id="inv-pay">{PAY_METHODS.map((m) => <option key={m} value={m} />)}</datalist>
            </label>
            <label className="f">تاريخ الاستحقاق<input className="in" type="date" dir="ltr" value={inv.dueDate || ""} onChange={(e) => set({ dueDate: e.target.value })} /></label>
            <label className="f" style={{ gridColumn: "1 / -1" }}>ملاحظات (اختياري)<textarea className="in" rows={2} value={inv.notes || ""} onChange={(e) => set({ notes: e.target.value })} /></label>
          </div>

          <details className="card">
            <summary><b>بيانات المورّد في هذه الفاتورة</b> <span className="sub">{inv.seller?.name || "غير مكتملة"}</span></summary>
            <div className="grid g2" style={{ marginTop: 12 }}>
              {[["name", "اسم المنشأة"], ["cr", "السجل التجاري"], ["vat", "الرقم الضريبي"], ...ADDRESS, ["bank", "البنك"], ["iban", "الآيبان"], ["holder", "اسم المستفيد"]].map(([k, l]) => (
                <label className="f" key={k}>{l}<input className="in" dir={["cr", "vat", "iban"].includes(k) ? "ltr" : undefined} value={inv.seller?.[k] || ""} onChange={(e) => setSeller({ [k]: e.target.value })} /></label>
              ))}
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="lq sm" disabled={!seller} onClick={() => set({ seller: { ...DEFAULT_SELLER, ...seller } })}>تحديث من لوحة التحكم</button>
              <span className="sub" style={{ fontSize: 13 }}>{seller ? "تُنسخ البيانات من لوحة التحكم > بيانات الفواتير عند إنشاء الفاتورة." : "أضف بيانات المنشأة مرة واحدة من لوحة التحكم > بيانات الفواتير."}</span>
            </div>
          </details>
          <div className="sub" role="status">{saved}</div>
        </div>

        <div className="preview">
          {pdf.error && <div className="err">{pdf.error}</div>}
          <Preview blob={pdf.blob} />
        </div>
      </div>
    </div>
  );
}
