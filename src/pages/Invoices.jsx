// Invoices log: current and archived invoices, search, type filter, and a new
// invoice of any of the three Saudi models.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { put, list, getSetting, useCollection } from "../lib/store.js";
import { INVOICE_TYPES, typeOf, invoiceStatusLabel, newInvoice, invoiceTotals, money2 } from "../lib/invoice.js";
import { toCSV, download, toast } from "../ui.jsx";

export async function createInvoice(type, user, from) {
  const [all, seller] = await Promise.all([list("invoices"), getSetting("seller", null)]);
  const inv = newInvoice(type, all, seller, from);
  return put("invoices", { ...inv, total: invoiceTotals(inv).total }, user);
}

const STATUS_CLASS = { draft: "draft", issued: "sent", paid: "approved" };

export default function Invoices() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [items] = useCollection("invoices");
  const [archived, setArchived] = useState(false);
  const [type, setType] = useState("all");
  const [qx, setQx] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = (items || [])
    .filter((i) => !!i.archived === archived)
    .filter((i) => type === "all" || i.type === type)
    .filter((i) => !qx || JSON.stringify([i.number, i.buyer?.name, i.subject, i.txn]).includes(qx))
    .sort((a, b) => String(b.number).localeCompare(String(a.number)) || b.updatedAt.localeCompare(a.updatedAt));
  const nArchived = (items || []).filter((i) => i.archived).length;

  async function start(t) {
    if (busy) return;
    setBusy(true);
    try { nav(`/invoice/${(await createInvoice(t, user)).id}`); } catch { setBusy(false); }
  }

  const exportCSV = () => (toast("تم تصدير الملف"), download("invoices.csv", toCSV(rows.map((i) => {
    const T = invoiceTotals(i);
    return { no: i.number, type: typeOf(i.type).label, buyer: i.buyer?.name, date: i.issueDate, taxable: T.taxable, vat: T.vat, total: T.total, status: invoiceStatusLabel(i.status) };
  }), [
    { key: "no", label: "رقم الفاتورة" }, { key: "type", label: "النوع" }, { key: "buyer", label: "العميل" },
    { key: "date", label: "تاريخ الإصدار" }, { key: "taxable", label: "الخاضع للضريبة" }, { key: "vat", label: "الضريبة" },
    { key: "total", label: "الإجمالي" }, { key: "status", label: "الحالة" },
  ])));

  return (
    <div>
      <div className="page-head">
        <h1>الفواتير</h1>
        <div className="row">
          <input className="in search" type="search" aria-label="بحث في الفواتير" placeholder="بحث..." value={qx} onChange={(e) => setQx(e.target.value)} />
          <button className="lq sm" onClick={exportCSV}>تصدير Excel</button>
        </div>
      </div>

      <div className="grid g3" style={{ marginBottom: 20 }}>
        {INVOICE_TYPES.map((t) => (
          <button key={t.id} className="card tile invoice-new" disabled={busy} onClick={() => start(t.id)} style={{ textAlign: "start", display: "grid", gap: 6 }}>
            <b>+ {t.label}</b>
            <span className="sub" style={{ fontSize: 13 }}>{t.hint}</span>
          </button>
        ))}
      </div>

      <div className="tabs" style={{ marginBottom: 10 }}>
        <button className={`tab${!archived ? " on" : ""}`} onClick={() => setArchived(false)}>الحالية</button>
        <button className={`tab${archived ? " on" : ""}`} onClick={() => setArchived(true)}>الأرشيف{nArchived ? ` (${nArchived})` : ""}</button>
      </div>
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab${type === "all" ? " on" : ""}`} onClick={() => setType("all")}>كل الأنواع</button>
        {INVOICE_TYPES.map((t) => <button key={t.id} className={`tab${type === t.id ? " on" : ""}`} onClick={() => setType(t.id)}>{t.label}</button>)}
      </div>

      <div className="card tablewrap">
        {!rows.length ? <div className="empty">{items === null ? "جار التحميل..." : archived ? "لا توجد فواتير في الأرشيف" : "لا توجد فواتير بعد. اختر نوع الفاتورة بالأعلى لإنشاء أول فاتورة."}</div> : (
          <table className="t cards">
            <thead><tr><th>رقم الفاتورة</th><th>النوع</th><th>العميل</th><th>تاريخ الإصدار</th><th>الضريبة</th><th>الإجمالي</th><th>الحالة</th></tr></thead>
            <tbody>
              {rows.map((i) => {
                const T = invoiceTotals(i);
                return (
                  <tr key={i.id}>
                    <td className="lead ltr-cell"><Link to={`/invoice/${i.id}`}>{i.number || "بدون رقم"}</Link></td>
                    <td data-label="النوع">{typeOf(i.type).short}</td>
                    <td data-label="العميل">{i.buyer?.name || i.txn || "—"}</td>
                    <td className="sub" data-label="الإصدار">{i.issueDate}</td>
                    <td className="sub" data-label="الضريبة">{money2(T.vat)}</td>
                    <td data-label="الإجمالي">{money2(T.total)} ر.س</td>
                    <td className="end"><span className={`badge st-${STATUS_CLASS[i.status] || "draft"}`}>{invoiceStatusLabel(i.status)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
