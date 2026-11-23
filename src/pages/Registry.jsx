// Generic registry page (clients, companies): table, form, search, CSV import/export.
import { useRef, useState } from "react";
import { useAuth } from "../auth.jsx";
import { put, remove, useCollection } from "../lib/store.js";
import { toCSV, parseCSV, download, toast, ConfirmButton } from "../ui.jsx";
import { readDocFile, FIELD_LABELS, DOC_KINDS } from "../lib/docExtract.js";

// fills the form from one client document (CR, VAT certificate or national
// address PDF); the person checks the fields before saving. Empty fields
// only, so nothing typed is overwritten.
export async function fillFromFile(file, kind, current, keys) {
  const found = await readDocFile(file, kind);
  const patch = {};
  for (const [k, v] of Object.entries(found)) if (keys.includes(k) && v && !current[k]) patch[k] = v;
  const names = Object.keys(patch).map((k) => FIELD_LABELS[k] || k);
  if (!names.length) toast("البيانات الموجودة في الملف مكتوبة مسبقا");
  else toast(`تمت تعبئة: ${names.join("، ")}. راجعها قبل الحفظ.`);
  return patch;
}

// three buttons, one hidden file input per document type
export function DocButtons({ onPatch, current, keys, kinds = ["cr", "vat", "address"] }) {
  const refs = { cr: useRef(null), vat: useRef(null), address: useRef(null) };
  const [busy, setBusy] = useState("");
  async function pick(kind, file) {
    setBusy(kind);
    try {
      const patch = await fillFromFile(file, kind, current, keys);
      if (Object.keys(patch).length) onPatch(patch);
    } catch (err) {
      toast(err?.message || "تعذرت قراءة الملف", "error");
    } finally {
      setBusy("");
    }
  }
  return kinds.map((kind) => (
    <span key={kind} style={{ display: "contents" }}>
      <button type="button" className="lq sm" disabled={!!busy} onClick={() => refs[kind].current.click()}>
        {busy === kind ? "جار القراءة..." : `${DOC_KINDS[kind].label} (PDF)`}
      </button>
      <input ref={refs[kind]} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) pick(kind, f); }} />
    </span>
  ));
}

export default function Registry({ col, title, fields, columns, extra, fromFile }) {
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
          {fromFile && (
            <div className="row" style={{ gridColumn: "1 / -1" }}>
              <span className="sub" style={{ fontSize: 13 }}>تعبئة من:</span>
              <DocButtons current={edit} keys={fields.map((f) => f.key)} onPatch={(patch) => setEdit((e) => ({ ...e, ...patch }))} />
              <span className="sub" style={{ fontSize: 13 }}>يُقرأ الملف داخل المتصفح ولا يُرفع لأي جهة.</span>
            </div>
          )}
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
