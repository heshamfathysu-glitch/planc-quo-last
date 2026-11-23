import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { useCollection, useSetting, remove } from "../lib/store.js";
import { STATUSES, statusLabel } from "../data/catalog.js";
import { StatusBadge, money, toCSV, download, toast, ConfirmButton } from "../ui.jsx";
import { cardItems, duplicateQuote, quoteToInvoice } from "../lib/quoteOps.js";
import { downloadQuote } from "../pdf/render.js";

// stroke icons for the card actions (24-grid)
const IC = {
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  pdf: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 11v6M9 14l3 3 3-3",
  invoice: "M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM14.5 8.5h-3.2a1.6 1.6 0 0 0 0 3.2h1.4a1.6 1.6 0 0 1 0 3.2H9.5M12 7v1.5M12 15v1.5",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
};
export const Ico = ({ d }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

function QuoteCard({ q, pricing, theme, seller, user }) {
  const nav = useNavigate();
  const [busy, setBusy] = useState("");
  const ready = !!q.data;
  const open = (view) => nav(ready ? `/quote/${q.id}${view ? "?view=preview" : ""}` : `/new/${q.id}`);
  const n = ready ? cardItems(q.data, pricing).length : 0;
  const date = q.data?.issue_date?.replace(/ /g, "") || new Date(q.createdAt || q.updatedAt).toLocaleDateString("en-CA").replace(/-/g, "/");

  async function run(key, fn) {
    if (busy) return;
    setBusy(key);
    try { await fn(); } catch { /* the store already showed the error */ } finally { setBusy(""); }
  }
  const pdf = () => run("pdf", () => downloadQuote(q.data, pricing || { services: {} }, theme, { seller }).then(
    () => toast("تم تصدير ملف PDF"), () => toast("تعذر إنشاء ملف PDF. حاول مرة أخرى.", "error")));
  const invoice = () => run("inv", async () => {
    const inv = await quoteToInvoice(q, pricing, user);
    toast("تم إنشاء فاتورة من العرض");
    nav(`/invoice/${inv.id}`);
  });
  const copy = () => run("copy", async () => {
    const c = await duplicateQuote(q, user);
    toast("تم نسخ العرض");
    nav(c.data ? `/quote/${c.id}` : `/new/${c.id}`);
  });

  return (
    <article className="qcard">
      <div className="qcard-top">
        <span className="qno" dir="ltr">{q.data?.quote_no || "مسودة"}</span>
        <StatusBadge s={q.status} />
      </div>
      <h3><Link to={ready ? `/quote/${q.id}` : `/new/${q.id}`}>{q.data?.client || q.answers?.addressedTo || "مسودة غير مكتملة"}{q.data?.subtitle ? ` — ${q.data.subtitle}` : ""}</Link></h3>
      <div className="sub">صدر <bdi dir="ltr">{date}</bdi> · {n} بنود/خدمات · أعده {q.answers?.preparer || q.createdBy}</div>
      <div className="qcard-foot">
        <b className="qtotal">{q.total ? money(q.total) : "—"}</b>
        <div className="qactions">
          <button className="act" title="معاينة" aria-label="معاينة" onClick={() => open(true)}><Ico d={IC.eye} /></button>
          <button className="act dark" title="تعديل" aria-label="تعديل" onClick={() => open(false)}><Ico d={IC.edit} /></button>
          <button className="act" title="تنزيل PDF" aria-label="تنزيل PDF" disabled={!ready || !!busy} onClick={pdf}><Ico d={IC.pdf} /></button>
          <button className="act navy" title="تحويل إلى فاتورة" aria-label="تحويل إلى فاتورة" disabled={!ready || !!busy} onClick={invoice}><Ico d={IC.invoice} /></button>
          <button className="act" title="نسخ العرض" aria-label="نسخ العرض" disabled={!!busy} onClick={copy}><Ico d={IC.copy} /></button>
          <ConfirmButton className="act danger" title="حذف" aria-label="حذف العرض" ask={<Ico d={IC.trash} />} onConfirm={() => remove("quotes", q.id).then(() => toast("تم حذف العرض"))}>
            <Ico d={IC.trash} />
          </ConfirmButton>
        </div>
      </div>
    </article>
  );
}

export default function Quotes() {
  const { user } = useAuth();
  const [quotes] = useCollection("quotes");
  const pricing = useSetting("pricing", null);
  const theme = useSetting("theme", null);
  const seller = useSetting("seller", null);
  const [st, setSt] = useState("all");
  const [qx, setQx] = useState("");

  const rows = (quotes || [])
    .filter((q) => st === "all" || q.status === st)
    .filter((q) => !qx || JSON.stringify([q.data?.client, q.data?.quote_no, q.data?.subtitle, q.answers?.partyName, q.answers?.preparer]).includes(qx))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const exportCSV = () => (toast("تم تصدير الملف"), download("quotes.csv", toCSV(rows.map((q) => ({
    no: q.data?.quote_no, client: q.data?.client, party: q.answers?.partyName, prep: q.answers?.preparer,
    date: q.data?.issue_date, valid: q.data?.valid_until, total: q.total, status: statusLabel(q.status),
  })), [
    { key: "no", label: "رقم العرض" }, { key: "client", label: "مقدم إلى" }, { key: "party", label: "الجهة" },
    { key: "prep", label: "أعده" }, { key: "date", label: "تاريخ الإصدار" }, { key: "valid", label: "صالح حتى" },
    { key: "total", label: "الإجمالي" }, { key: "status", label: "الحالة" },
  ])));

  return (
    <div>
      <div className="page-head">
        <h1>سجل العروض</h1>
        <div className="row">
          <input className="in search" type="search" aria-label="بحث في العروض" placeholder="بحث..." value={qx} onChange={(e) => setQx(e.target.value)} />
          <button className="lq sm" onClick={exportCSV}>تصدير Excel</button>
        </div>
      </div>
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab${st === "all" ? " on" : ""}`} onClick={() => setSt("all")}>الكل</button>
        {STATUSES.map((s) => <button key={s.id} className={`tab${st === s.id ? " on" : ""}`} onClick={() => setSt(s.id)}>{s.label}</button>)}
      </div>
      {!rows.length ? <div className="card empty">{quotes === null ? "جار التحميل..." : qx || st !== "all" ? "لا توجد عروض مطابقة" : "لا توجد عروض بعد"}</div> : (
        <div className="qgrid">
          {rows.map((q) => <QuoteCard key={q.id} q={q} pricing={pricing} theme={theme} seller={seller} user={user} />)}
        </div>
      )}
    </div>
  );
}
