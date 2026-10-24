import { Link } from "react-router-dom";
import { useCollection } from "../lib/store.js";
import { STATUSES } from "../data/catalog.js";
import { StatusBadge, money } from "../ui.jsx";

export default function Dashboard() {
  const [quotes] = useCollection("quotes");
  const all = (quotes || []).filter((q) => q.data);
  const by = (s) => all.filter((q) => q.status === s);
  const sum = (qs) => qs.reduce((s, q) => s + (q.total || 0), 0);
  const decided = by("approved").length + by("rejected").length;
  const rate = decided ? Math.round((by("approved").length / decided) * 100) : 0;

  // last 6 months, value of quotes issued
  const months = [...Array(6)].map((_, i) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i));
    const k = d.toISOString().slice(0, 7);
    const qs = all.filter((q) => (q.createdAt || "").startsWith(k));
    return { k, label: d.toLocaleDateString("ar-SA-u-nu-latn-ca-gregory", { month: "short" }), total: sum(qs), won: sum(qs.filter((q) => q.status === "approved")) };
  });
  const max = Math.max(1, ...months.map((m) => m.total));

  const preparers = Object.entries(all.reduce((m, q) => {
    const p = q.answers?.preparer || q.createdBy || "—";
    m[p] = m[p] || { n: 0, v: 0 }; m[p].n++; m[p].v += q.total || 0; return m;
  }, {})).sort((a, b) => b[1].v - a[1].v);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="page-head"><h1>ملخص العروض</h1></div>
      <div className="grid g4">
        <div className="card stat"><span>كل العروض</span><b>{all.length}</b><span>{money(sum(all))}</span></div>
        <div className="card stat"><span>مرسلة بانتظار الرد</span><b>{by("sent").length}</b><span>{money(sum(by("sent")))}</span></div>
        <div className="card stat"><span>معتمدة</span><b>{by("approved").length}</b><span>{money(sum(by("approved")))}</span></div>
        <div className="card stat"><span>نسبة الاعتماد</span><b>{rate}%</b><span>من العروض التي حُسمت</span></div>
      </div>

      <div className="grid g2">
        <div className="card">
          <h2 style={{ fontSize: 16, marginBottom: 16 }}>قيمة العروض آخر 6 أشهر</h2>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 180 }}>
            {months.map((m) => (
              <div key={m.k} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }} title={`${money(m.total)} / المعتمد ${money(m.won)}`}>
                <div style={{ width: "100%", maxWidth: 40, height: `${(m.total / max) * 100}%`, minHeight: 2, background: "rgba(255,255,255,0.25)", borderRadius: 8, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: m.total ? `${(m.won / m.total) * 100}%` : 0, background: "#7ee2b8" }} />
                </div>
                <span className="sub" style={{ fontSize: 12 }}>{m.label}</span>
              </div>
            ))}
          </div>
          <div className="sub" style={{ fontSize: 12, marginTop: 10 }}>الجزء الأخضر: المعتمد</div>
        </div>
        <div className="card">
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>حسب الحالة</h2>
          <table className="t"><tbody>
            {STATUSES.map((s) => <tr key={s.id}><td><StatusBadge s={s.id} /></td><td>{by(s.id).length}</td><td>{money(sum(by(s.id)))}</td></tr>)}
          </tbody></table>
          <h2 style={{ fontSize: 16, margin: "20px 0 12px" }}>حسب معد العرض</h2>
          <table className="t"><tbody>
            {preparers.map(([p, v]) => <tr key={p}><td>{p}</td><td>{v.n}</td><td>{money(v.v)}</td></tr>)}
          </tbody></table>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>عروض تنتهي صلاحيتها قريبا</h2>
        {(() => {
          const soon = by("sent").filter((q) => {
            const [d, m, y] = (q.data.valid_until || "").split("/").map((x) => x.trim());
            const t = new Date(`${y}-${m}-${d}T23:59:59`).getTime() - Date.now();
            return t > -864e5 && t < 4 * 864e5;
          });
          return soon.length ? soon.map((q) => <div key={q.id} className="row" style={{ padding: "6px 0" }}><Link to={`/quote/${q.id}`}>{q.data.client}</Link><span className="sub">صالح حتى {q.data.valid_until}</span></div>) : <div className="sub">لا يوجد</div>;
        })()}
      </div>
    </div>
  );
}
