// The team's price guide (Admin > دليل الأسعار, stored in settings/priceGuide,
// never in the code). Shown while filling in a service and again before the
// quote is made; it never reaches the PDF.
const num = (n) => Number(n).toLocaleString("en-US");
function guideRange(it) {
  const n = (v) => <bdi className="nums" dir="ltr">{num(v)}</bdi>;
  if (it.from && it.to) return <>من {n(it.from)} إلى {n(it.to)} ريال</>;
  if (it.from || it.to) return <>{n(it.from || it.to)} ريال</>;
  return "—";
}
export default function PriceGuide({ guide, ids, open = true }) {
  const secs = (guide?.sections || []).filter((s) => ids.includes(s.service) && s.items?.length);
  if (!secs.length) return null;
  return (
    <details className="guide" open={open}>
      <summary>دليل الأسعار <small>للفريق فقط، لا يظهر في عرض السعر</small></summary>
      {secs.map((s) => (
        <div className="guide-sec" key={s.service}>
          {secs.length > 1 && <b>{s.title}</b>}
          <ul>
            {s.items.map((it, i) => (
              <li key={i} className={it.cost ? "cost" : undefined}>
                <span>{it.label}{it.note && <small>{it.note}</small>}</span>
                <span className="range">{guideRange(it)}{it.unit && <small>{it.unit}</small>}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </details>
  );
}

