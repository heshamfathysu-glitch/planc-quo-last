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
    let rowsIn;
    try { rowsIn = parseCSV(await file.text()); } catch { return toast("تعذرت قراءة الملف. استخدم ملف CSV من نموذج الاستيراد.", "error"); }
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
    toast(n ? `تم استيراد ${n} سجل` : "لم يُستورد شيء: تأكد أن الملف فيه عمود الاسم", n ? "ok" : "error");
  }

  return (
    <div>
      <div className="page-head">
        <h1>{title}</h1>
        <div className="row">
          <input className="in search" type="search" aria-label="بحث" placeholder="بحث..." value={qx} onChange={(e) => setQx(e.target.value)} />
          <button className="lq sm" onClick={() => fileRef.current.click()}>استيراد</button>
          <button className="lq sm" onClick={() => { download(`${col}.csv`, toCSV(rows, fields)); toast("تم تصدير الملف"); }}>تصدير Excel</button>
          <button className="lq sm" onClick={() => download(`${col}-template.csv`, toCSV([], fields))}>نموذج الاستيراد</button>
          <button className="lq primary sm" onClick={() => { setEdit({}); window.scrollTo({ top: 0, behavior: "smooth" }); }}>+ إضافة</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files[0] && importCSV(e.target.files[0]).finally(() => (e.target.value = ""))} />
        </div>
      </div>

      {edit && (
        <form className="card grid g2" style={{ marginBottom: 16 }} onSubmit={saveItem}>
          <h2 style={{ gridColumn: "1 / -1", fontSize: 16 }}>{edit.id ? "تعديل السجل" : "إضافة سجل جديد"}</h2>
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
                <input className="in" dir={f.ltr ? "ltr" : undefined} type={f.key === "email" ? "email" : f.key === "phone" ? "tel" : "text"} inputMode={f.key === "phone" ? "tel" : undefined} value={edit[f.key] || ""} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} required={f.key === "name"} />
              )}
            </label>
          ))}
          <div className="row" style={{ gridColumn: "1 / -1" }}>
            <button className="lq primary">حفظ</button>
            <button type="button" className="lq" onClick={() => setEdit(null)}>إلغاء</button>
            <span className="spacer" />
            {edit.id && <ConfirmButton onConfirm={async () => { await remove(col, edit.id); setEdit(null); toast("تم الحذف"); }}>حذف</ConfirmButton>}
          </div>
        </form>
      )}

      <div className="card tablewrap">
        {!rows.length ? <div className="empty">{qx ? "لا توجد نتائج مطابقة للبحث" : "لا توجد سجلات بعد. اضغط \"+ إضافة\" للبدء."}</div> : (
          <table className="t cards">
            <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}{extra && <th>{extra.label}</th>}<th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {columns.map((c, i) => <td key={c.key} className={[i === 0 && "lead", c.ltr && "ltr-cell", c.wide && "wide"].filter(Boolean).join(" ") || undefined} data-label={i ? c.label : undefined}>{c.render ? c.render(r) : r[c.key] || "—"}</td>)}
                  {extra && <td data-label={extra.label}>{extra.render(r)}</td>}
                  <td className="end"><button className="lq sm" aria-label={`تعديل ${r.name}`} onClick={() => { setEdit(r); window.scrollTo({ top: 0, behavior: "smooth" }); }}>تعديل</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
