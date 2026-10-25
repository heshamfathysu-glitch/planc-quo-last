import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { useCollection, useSetting } from "../lib/store.js";
import { createDraft } from "../lib/newQuote.js";
import { StatusBadge, money } from "../ui.jsx";

export default function Home() {
  const nav = useNavigate();
  const { user, isAdmin } = useAuth();
  const [quotes] = useCollection("quotes");
  const pricing = useSetting("pricing", null);

  async function start() {
    const q = await createDraft(user);
    nav(`/new/${q.id}`);
  }

  const recent = (quotes || []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <section className="hero">
        <h1>أهلا {user.name}</h1>
        <p className="sub" style={{ margin: 0 }}>عرض سعر احترافي بقالب PLAN C في دقائق، سؤال واحد في كل خطوة.</p>
        <button className="lq primary xl" onClick={start}>إنشاء عرض سعر سريع</button>
        {!pricing && (
          <p className="warn">
            قائمة الأسعار الداخلية غير مضافة بعد، فستُكتب الأسعار يدويا.{" "}
            {isAdmin && <Link to="/admin">أضفها من لوحة التحكم</Link>}
          </p>
        )}
      </section>

      <section className="card">
        <div className="page-head" style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: 18 }}>آخر العروض</h2>
          <Link className="lq sm" to="/quotes">كل العروض</Link>
        </div>
        {!recent.length ? <div className="empty">لا توجد عروض بعد</div> : (
          <div className="tablewrap">
            <table className="t cards">
              <tbody>
                {recent.map((q) => (
                  <tr key={q.id}>
                    <td className="lead"><Link to={q.data ? `/quote/${q.id}` : `/new/${q.id}`}>{q.data?.client || q.answers?.addressedTo || "عرض بدون اسم"}</Link></td>
                    <td className="sub">{q.data?.quote_no || "لم يكتمل"}</td>
                    <td>{q.total ? money(q.total) : "—"}</td>
                    <td className="end"><StatusBadge s={q.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
