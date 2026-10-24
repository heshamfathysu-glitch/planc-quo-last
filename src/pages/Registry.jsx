// Generic registry page (clients, companies): table, form, search, CSV import/export.
import { useRef, useState } from "react";
import { useAuth } from "../auth.jsx";
import { put, remove, useCollection } from "../lib/store.js";
import { toCSV, parseCSV, download, toast, ConfirmButton } from "../ui.jsx";

export default function Registry({ col, title, fields, columns, extra }) {
  const { user } = useAuth();
  const [items] = useCollection(col);
  const [edit, setEdit] = useState(null);
  const [qx, setQx] = useState("");
  const fileRef = useRef();

  const rows = (items || [])
    .filter((r) => !qx || JSON.stringify(r).includes(qx))
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));

  async function saveItem(e) {
    e.preventDefault();
    if (!edit.name?.trim()) return;
    await put(col, edit, user);
    setEdit(null);
    toast("تم الحفظ");
  }

  async function importCSV(file) {
    const rowsIn = parseCSV(await file.text());
    if (rowsIn.length < 2) return toast("الملف فارغ");
    const head = rowsIn[0].map((h) => h.trim());
    const map = head.map((h) => fields.find((f) => f.label === h || f.key === h)?.key);
    let n = 0;
    for (const r of rowsIn.slice(1)) {
      const o = {};
      r.forEach((v, i) => { if (map[i]) o[map[i]] = v.trim(); });
      if (!o.name) continue;
      const existing = (items || []).find((x) => x.name === o.name);
      await put(col, { ...(existing || {}), ...o }, user);
      n++;
    }
    toast(`تم استيراد ${n} سجل`);
  }

  return (
    <div>
      <div className="page-head">
        <h1>{title}</h1>
        <div className="row">
          <input className="in" style={{ width: 200 }} placeholder="بحث..." value={qx} onChange={(e) => setQx(e.target.value)} />
          <button className="lq sm" onClick={() => fileRef.current.click()}>استيراد</button>
          <button className="lq sm" onClick={() => download(`${col}.csv`, toCSV(rows, fields))}>تصدير Excel</button>
          <button className="lq sm" onClick={() => download(`${col}-template.csv`, toCSV([], fields))}>نموذج الاستيراد</button>
          <button className="lq primary sm" onClick={() => setEdit({})}>+ إضافة</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files[0] && importCSV(e.target.files[0]).finally(() => (e.target.value = ""))} />
        </div>
      </div>

      {edit && (
        <form className="card grid g2" style={{ marginBottom: 16 }} onSubmit={saveItem}>
          {fields.map((f) => (
            <label key={f.key} className="f" style={f.wide ? { gridColumn: "1 / -1" } : null}>{f.label}
              {f.options ? (
                <select className="in" value={edit[f.key] || ""} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })}>
                  <option value="">—</option>
                  {f.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              ) : f.wide ? (
                <textarea className="in" value={edit[f.key] || ""} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} />
              ) : (
                <input className="in" dir={f.ltr ? "ltr" : undefined} value={edit[f.key] || ""} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} required={f.key === "name"} />
              )}
            </label>
          ))}
          <div className="row" style={{ gridColumn: "1 / -1" }}>
            <button className="lq primary">حفظ</button>
            <button type="button" className="lq" onClick={() => setEdit(null)}>إلغاء</button>
            <span className="spacer" />
            {edit.id && <ConfirmButton onConfirm={async () => { await remove(col, edit.id); setEdit(null); }}>حذف</ConfirmButton>}
          </div>
        </form>
      )}

      <div className="card tablewrap">
        {!rows.length ? <div className="empty">لا توجد سجلات بعد</div> : (
          <table className="t">
            <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}{extra && <th>{extra.label}</th>}<th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {columns.map((c) => <td key={c.key} dir={c.ltr ? "ltr" : undefined} style={c.ltr ? { textAlign: "right" } : null}>{c.render ? c.render(r) : r[c.key] || "—"}</td>)}
                  {extra && <td>{extra.render(r)}</td>}
                  <td><button className="lq sm" onClick={() => setEdit(r)}>تعديل</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
