import { useState } from "react";
import { Link } from "react-router-dom";
import { useCollection } from "../lib/store.js";
import { STATUSES, statusLabel } from "../data/catalog.js";
import { StatusBadge, money, toCSV, download } from "../ui.jsx";

export default function Quotes() {
  const [quotes] = useCollection("quotes");
  const [st, setSt] = useState("all");
  const [qx, setQx] = useState("");

  const rows = (quotes || [])
    .filter((q) => st === "all" || q.status === st)
    .filter((q) => !qx || JSON.stringify([q.data?.client, q.data?.quote_no, q.answers?.partyName, q.answers?.preparer]).includes(qx))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const exportCSV = () => download("quotes.csv", toCSV(rows.map((q) => ({
    no: q.data?.quote_no, client: q.data?.client, party: q.answers?.partyName, prep: q.answers?.preparer,
    date: q.data?.issue_date, valid: q.data?.valid_until, total: q.total, status: statusLabel(q.status),
  })), [
    { key: "no", label: "رقم العرض" }, { key: "client", label: "مقدم إلى" }, { key: "party", label: "الجهة" },
    { key: "prep", label: "أعده" }, { key: "date", label: "تاريخ الإصدار" }, { key: "valid", label: "صالح حتى" },
    { key: "total", label: "الإجمالي" }, { key: "status", label: "الحالة" },
  ]));

  return (
    <div>
      <div className="page-head">
        <h1>سجل العروض</h1>
        <div className="row">
          <input className="in" style={{ width: 220 }} placeholder="بحث..." value={qx} onChange={(e) => setQx(e.target.value)} />
          <button className="lq sm" onClick={exportCSV}>تصدير Excel</button>
        </div>
      </div>
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab${st === "all" ? " on" : ""}`} onClick={() => setSt("all")}>الكل</button>
        {STATUSES.map((s) => <button key={s.id} className={`tab${st === s.id ? " on" : ""}`} onClick={() => setSt(s.id)}>{s.label}</button>)}
      </div>
      <div className="card tablewrap">
        {!rows.length ? <div className="empty">لا توجد عروض</div> : (
          <table className="t">
            <thead><tr><th>رقم العرض</th><th>مقدم إلى</th><th>أعده</th><th>تاريخ الإصدار</th><th>الإجمالي</th><th>الحالة</th><th>آخر تحديث</th></tr></thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.id}>
                  <td dir="ltr" style={{ textAlign: "right" }}><Link to={q.data ? `/quote/${q.id}` : `/new/${q.id}`}>{q.data?.quote_no || "مسودة غير مكتملة"}</Link></td>
                  <td>{q.data?.client || q.answers?.addressedTo || "—"}</td>
                  <td className="sub">{q.answers?.preparer || q.createdBy}</td>
                  <td className="sub">{q.data?.issue_date || "—"}</td>
                  <td>{q.total ? money(q.total) : "—"}</td>
                  <td><StatusBadge s={q.status} /></td>
                  <td className="sub">{new Date(q.updatedAt).toLocaleDateString("ar-SA-u-nu-latn")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
