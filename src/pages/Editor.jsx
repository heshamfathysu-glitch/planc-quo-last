import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { get, put, remove, useSetting } from "../lib/store.js";
import { renderQuote, downloadQuote } from "../pdf/render.js";
import Preview from "../pdf/Preview.jsx";
import { quoteTotal, clientTypeLabel } from "../lib/compose.js";
import { STATUSES, DEFAULT_TERMS, ORDINALS } from "../data/catalog.js";
import { money, toast } from "../ui.jsx";
import { resolveItem, cardTotals } from "../pdf/engine.js";

const BLOCK_TYPES = [
  { type: "card", label: "خيار سعري" },
  { type: "intro", label: "سطر تمهيدي" },
  { type: "note", label: "ملاحظة" },
  { type: "terms", label: "شروط وأحكام" },
  { type: "image", label: "صورة / شعار / رسم بياني PNG" },
  { type: "chart", label: "رسم بياني من أرقام" },
  { type: "info", label: "مربع بيانات العرض" },
  { type: "approval", label: "مربع الاعتماد" },
];
const blockLabel = (t) => BLOCK_TYPES.find((b) => b.type === t)?.label || t;

function newBlock(type, n) {
  if (type === "card") return { type, number: String(n).padStart(2, "0"), title: `الخيار ${ORDINALS[n - 1] || n} | `, items: [{ title: "", desc: "", amount: 0 }] };
  if (type === "intro" || type === "note") return { type, text: "" };
  if (type === "terms") return { type, items: [{ title: "", text: "" }] };
  if (type === "image") return { type, src: "", width_pct: 40, align: "right" };
  if (type === "chart") return { type, title: "", rows: [{ label: "", value: 0 }, { label: "", value: 0 }] };
  return { type };
}

const move = (arr, i, d) => {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const c = [...arr];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
};

export default function Editor() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const pricing = useSetting("pricing", null);
  const theme = useSetting("theme", null);
  const termsLib = useSetting("terms", DEFAULT_TERMS);
  const [q, setQ] = useState(null);
  const [pdf, setPdf] = useState({ blob: null, warnings: [], error: "" });
  const [saved, setSaved] = useState("");
  const timer = useRef(null);

  useEffect(() => { get("quotes", id).then(setQ); }, [id]);

  // live preview
  useEffect(() => {
    if (!q?.data) return;

    const t = setTimeout(async () => {
      try {
        const r = await renderQuote(q.data, pricing || { services: {} }, theme);

        URL.revokeObjectURL(r.url);
        setPdf({ blob: r.blob, warnings: r.warnings, error: "" });
      } catch (e) {
        setPdf((p) => ({ ...p, error: String(e.message || e) }));
      }
    }, 450);
    return () => clearTimeout(t);
  }, [q?.data, pricing, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!q) return <div className="empty">...</div>;
  if (!q.data) return <div className="empty">هذا العرض لم يكتمل بعد. <Link to={`/new/${id}`}>أكمل المعالج</Link></div>;

  const d = q.data;
  function save(next) {
    next = { ...next, total: quoteTotal(next.data, pricing), client: next.data.client };
    setQ(next);
    setSaved("جار الحفظ...");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => { await put("quotes", next, user); setSaved("تم الحفظ"); }, 500);
  }
  const setData = (patch) => save({ ...q, data: { ...d, ...patch } });
  const setPages = (pages) => setData({ pages });
  const setPage = (pi, patch) => setPages(d.pages.map((p, i) => (i === pi ? { ...p, ...patch } : p)));
  const setBlock = (pi, bi, patch) => setPage(pi, { blocks: d.pages[pi].blocks.map((b, i) => (i === bi ? { ...b, ...patch } : b)) });

  function setStatus(status) {
    save({ ...q, status, history: [...(q.history || []), { status, at: new Date().toISOString(), by: user.name }] });
  }

  async function duplicate() {
    const { id: _id, createdAt, updatedAt, history, ...rest } = q; // eslint-disable-line no-unused-vars
    const copy = await put("quotes", { ...rest, status: "draft", data: { ...d, quote_no: d.quote_no + "-2" }, history: [] }, user);
    toast("تم نسخ العرض");
    nav(`/quote/${copy.id}`);
  }
  async function del() {
    if (!confirm("حذف هذا العرض نهائيا؟")) return;
    await remove("quotes", id);
    nav("/quotes");
  }

  const cardsCount = d.pages.flatMap((p) => p.blocks).filter((b) => b.type === "card").length;
  const a = q.answers || {};

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{d.client}</h1>
          <div className="sub">{d.quote_no} · {money(q.total)} · أعده {a.preparer || q.createdBy}</div>
        </div>
        <div className="row">
          <select className="in" style={{ width: "auto" }} value={q.status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button className="lq primary" onClick={() => downloadQuote(d, pricing || { services: {} }, theme)}>تصدير PDF</button>
          <button className="lq" onClick={duplicate}>نسخ</button>
          <button className="lq danger" onClick={del}>حذف</button>
        </div>
      </div>

      <div className="editor">
        <div style={{ display: "grid", gap: 16 }}>
          <div className="card grid g2">
            <label className="f">مقدم إلى<input className="in" value={d.client} onChange={(e) => setData({ client: e.target.value })} /></label>
            <label className="f">رقم العرض<input className="in" dir="ltr" value={d.quote_no} onChange={(e) => setData({ quote_no: e.target.value })} /></label>
            <label className="f">تاريخ الإصدار<input className="in" dir="ltr" value={d.issue_date} onChange={(e) => setData({ issue_date: e.target.value })} /></label>
            <label className="f">صالح حتى<input className="in" dir="ltr" value={d.valid_until} onChange={(e) => setData({ valid_until: e.target.value })} /></label>
            <label className="f" style={{ gridColumn: "1 / -1" }}>العنوان الفرعي (أعلى كل صفحة)<input className="in" value={d.subtitle} onChange={(e) => setData({ subtitle: e.target.value })} /></label>
          </div>

          {(a.clientType || a.partyName) && (
            <div className="card sub" style={{ fontSize: 13 }}>
              بيانات داخلية لا تظهر في العرض: {clientTypeLabel(a.clientType)}{a.partyName ? ` · ${a.partyName}` : ""}
            </div>
          )}

          {d.pages.map((p, pi) => (
            <div className="pagebox" key={pi}>
              <div className="block-head">
                <b>صفحة {pi + 1}</b>
                <button className="lq icon sm" title="أعلى" onClick={() => setPages(move(d.pages, pi, -1))}>↑</button>
                <button className="lq icon sm" title="أسفل" onClick={() => setPages(move(d.pages, pi, 1))}>↓</button>
                {d.pages.length > 1 && <button className="lq sm danger" onClick={() => confirm("حذف الصفحة؟") && setPages(d.pages.filter((_, i) => i !== pi))}>حذف الصفحة</button>}
              </div>
              <label className="f">عنوان الصفحة<input className="in" value={p.title} onChange={(e) => setPage(pi, { title: e.target.value })} /></label>

              {p.blocks.map((b, bi) => (
                <div className="block" key={bi}>
                  <div className="block-head">
                    <b>{blockLabel(b.type)}</b>
                    <button className="lq icon sm" onClick={() => setPage(pi, { blocks: move(p.blocks, bi, -1) })}>↑</button>
                    <button className="lq icon sm" onClick={() => setPage(pi, { blocks: move(p.blocks, bi, 1) })}>↓</button>
                    {pi > 0 && <button className="lq sm" title="نقل للصفحة السابقة" onClick={() => {
                      const pages = d.pages.map((x) => ({ ...x, blocks: [...x.blocks] }));
                      const [blk] = pages[pi].blocks.splice(bi, 1);
                      pages[pi - 1].blocks.push(blk);
                      setPages(pages);
                    }}>للصفحة السابقة</button>}
                    {pi < d.pages.length - 1 && <button className="lq sm" onClick={() => {
                      const pages = d.pages.map((x) => ({ ...x, blocks: [...x.blocks] }));
                      const [blk] = pages[pi].blocks.splice(bi, 1);
                      pages[pi + 1].blocks.unshift(blk);
                      setPages(pages);
                    }}>للصفحة التالية</button>}
                    <button className="lq sm danger" onClick={() => setPage(pi, { blocks: p.blocks.filter((_, i) => i !== bi) })}>حذف</button>
                  </div>
                  <BlockEditor b={b} set={(patch) => setBlock(pi, bi, patch)} pricing={pricing} termsLib={termsLib} />
                </div>
              ))}

              <div className="row">
                <select className="in" style={{ width: "auto" }} value="" onChange={(e) => e.target.value && setPage(pi, { blocks: [...p.blocks, newBlock(e.target.value, cardsCount + 1)] })}>
                  <option value="">+ إضافة قسم...</option>
                  {BLOCK_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
                </select>
              </div>
            </div>
          ))}
          <button className="lq" onClick={() => setPages([...d.pages, { title: "صفحة جديدة", blocks: [] }])}>+ إضافة صفحة بنفس الأسلوب</button>
          <div className="sub">{saved}</div>
        </div>

        <div className="preview">
          {pdf.error && <div className="err" style={{ padding: 16, background: "#000" }}>{pdf.error}</div>}
          {pdf.warnings?.length > 0 && (
            <div className="warn" style={{ padding: "8px 14px", background: "#1b1446" }}>
              {pdf.warnings.map((w) => `الصفحة ${w.page} تتجاوز المساحة بـ ${w.overflow} نقطة، انقل قسما إلى صفحة أخرى.`).join(" ")}
            </div>
          )}
          <Preview blob={pdf.blob} />
        </div>
      </div>
    </div>
  );
}

function BlockEditor({ b, set, pricing, termsLib }) {
  if (b.type === "intro" || b.type === "note") {
    return <input className="in" value={b.text} onChange={(e) => set({ text: e.target.value })} />;
  }
  if (b.type === "info") return <div className="sub">يعرض: مقدم إلى، تاريخ الإصدار، صالح حتى، رقم العرض</div>;
  if (b.type === "approval") return <div className="sub">مربع اعتماد العرض والتوقيع</div>;
  if (b.type === "terms") {
    const upd = (i, p) => set({ items: b.items.map((it, j) => (j === i ? { ...it, ...p } : it)) });
    return (
      <div style={{ display: "grid", gap: 10 }}>
        {b.items.map((it, i) => (
          <div key={i} style={{ display: "grid", gap: 6 }}>
            <div className="row">
              <span className="badge">{String(i + 1).padStart(2, "0")}</span>
              <input className="in" style={{ flex: 1, width: "auto" }} placeholder="العنوان" value={it.title} onChange={(e) => upd(i, { title: e.target.value })} />
              <button className="lq icon sm" onClick={() => set({ items: move(b.items, i, -1) })}>↑</button>
              <button className="lq icon sm danger" onClick={() => set({ items: b.items.filter((_, j) => j !== i) })}>×</button>
            </div>
            <textarea className="in" value={it.text} onChange={(e) => upd(i, { text: e.target.value })} />
          </div>
        ))}
        <div className="row">
          <button className="lq sm" onClick={() => set({ items: [...b.items, { title: "", text: "" }] })}>+ بند</button>
          <select className="in" style={{ width: "auto" }} value="" onChange={(e) => {
            const t = termsLib[Number(e.target.value)];
            if (t) set({ items: [...b.items, { title: t.title, text: t.text }] });
          }}>
            <option value="">+ من مكتبة الشروط...</option>
            {termsLib.map((t, i) => <option key={i} value={i}>{t.title}</option>)}
          </select>
        </div>
      </div>
    );
  }
  if (b.type === "card") return <CardEditor b={b} set={set} pricing={pricing} />;
  if (b.type === "image") return <ImageEditor b={b} set={set} />;
  if (b.type === "chart") {
    const upd = (i, p) => set({ rows: b.rows.map((r, j) => (j === i ? { ...r, ...p } : r)) });
    return (
      <div style={{ display: "grid", gap: 8 }}>
        <input className="in" placeholder="عنوان الرسم (اختياري)" value={b.title || ""} onChange={(e) => set({ title: e.target.value })} />
        {b.rows.map((r, i) => (
          <div className="row" key={i}>
            <input className="in" style={{ flex: 1, width: "auto" }} placeholder="التسمية" value={r.label} onChange={(e) => upd(i, { label: e.target.value })} />
            <input className="in" style={{ width: 130 }} type="number" placeholder="القيمة" value={r.value} onChange={(e) => upd(i, { value: Number(e.target.value) || 0 })} />
            <button className="lq icon sm danger" onClick={() => set({ rows: b.rows.filter((_, j) => j !== i) })}>×</button>
          </div>
        ))}
        <div className="row">
          <button className="lq sm" onClick={() => set({ rows: [...b.rows, { label: "", value: 0 }] })}>+ عمود</button>
          <label className="row sub"><input type="checkbox" checked={!!b.highlight_first} onChange={(e) => set({ highlight_first: e.target.checked })} /> إبراز العمود الأول فقط</label>
        </div>
      </div>
    );
  }
  return null;
}

function CardEditor({ b, set, pricing }) {
  const upd = (i, p) => set({ items: b.items.map((it, j) => (j === i ? { ...it, ...p } : it)) });
  const svcs = Object.entries(pricing?.services || {});
  let totals = null;
  try { totals = cardTotals(b, b.items.map((i) => resolveItem(i, pricing))); } catch { /* missing price */ }
  const isPackage = "price" in b;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="row">
        <input className="in" style={{ width: 70 }} dir="ltr" value={b.number} onChange={(e) => set({ number: e.target.value })} />
        <input className="in" style={{ flex: 1, width: "auto" }} value={b.title} onChange={(e) => set({ title: e.target.value })} />
      </div>
      {b.items.map((it, i) => {
        const kind = "service" in it ? "service" : "value" in it ? "value" : "amount";
        return (
          <div key={i} className="card" style={{ padding: 12, display: "grid", gap: 8 }}>
            <div className="row">
              <select className="in" style={{ width: "auto" }} value={kind} onChange={(e) => {
                const k = e.target.value;
                if (k === "service") upd(i, { service: svcs[0]?.[0], qty: 1, title: undefined, desc: undefined, amount: undefined, value: undefined });
                else if (k === "value") upd(i, { service: undefined, qty: undefined, amount: undefined, value: "" });
                else upd(i, { service: undefined, qty: undefined, value: undefined, amount: 0 });
              }}>
                {svcs.length > 0 && <option value="service">من قائمة الأسعار</option>}
                <option value="amount">بند بسعر</option>
                <option value="value">بند نصي (للباقات)</option>
              </select>
              <span className="spacer" />
              <button className="lq icon sm" onClick={() => set({ items: move(b.items, i, -1) })}>↑</button>
              <button className="lq icon sm danger" onClick={() => set({ items: b.items.filter((_, j) => j !== i) })}>×</button>
            </div>
            {kind === "service" ? (
              <div className="row">
                <select className="in" style={{ flex: 1, width: "auto" }} value={it.service} onChange={(e) => upd(i, { service: e.target.value })}>
                  {svcs.map(([k, s]) => <option key={k} value={k}>{s.title}</option>)}
                </select>
                <input className="in" style={{ width: 110 }} type="number" min="1" value={it.qty} onChange={(e) => upd(i, { qty: Number(e.target.value) || 1 })} />
              </div>
            ) : (
              <>
                <input className="in" placeholder="البند" value={it.title || ""} onChange={(e) => upd(i, { title: e.target.value })} />
                <input className="in" placeholder="وصف (اختياري)" value={it.desc || ""} onChange={(e) => upd(i, { desc: e.target.value || undefined })} />
                {kind === "amount"
                  ? <input className="in" type="number" placeholder="المبلغ" value={it.amount ?? 0} onChange={(e) => upd(i, { amount: Number(e.target.value) || 0 })} />
                  : <input className="in" placeholder="القيمة، مثل: 12 صورة" value={it.value} onChange={(e) => upd(i, { value: e.target.value })} />}
              </>
            )}
          </div>
        );
      })}
      <button className="lq sm" onClick={() => set({ items: [...b.items, { title: "", amount: 0 }] })}>+ بند</button>
      <div className="grid g2">
        <label className="f">خصم (%)<input className="in" type="number" min="0" max="100" value={b.discount_pct ?? ""} onChange={(e) => set({ discount_pct: Number(e.target.value) || undefined })} /></label>
        <label className="f">سعر الباقة (بدل مجموع البنود)<input className="in" type="number" value={b.price ?? ""} onChange={(e) => set(e.target.value === "" ? { price: undefined } : { price: Number(e.target.value) })} /></label>
        {isPackage && <label className="f">عنوان سطر قيمة الباقة<input className="in" value={b.subtotal_label || ""} onChange={(e) => set({ subtotal_label: e.target.value || undefined })} /></label>}
        <label className="f">عنوان الإجمالي<input className="in" placeholder="الإجمالي شامل الضريبة" value={b.total_label || ""} onChange={(e) => set({ total_label: e.target.value || undefined })} /></label>
        <label className="f row" style={{ flexDirection: "row" }}><input type="checkbox" checked={b.vat !== false} onChange={(e) => set({ vat: e.target.checked ? undefined : false })} /> يشمل ضريبة القيمة المضافة 15%</label>
      </div>
      {totals && <div className="sub">الإجمالي: <b style={{ color: "#fff" }}>{money(totals.total)}</b></div>}
    </div>
  );
}

// downscale before saving so the quote stays small in the database
function readImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 1400;
      const k = Math.min(1, max / img.width);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const png = file.type === "image/png";
      resolve({ src: c.toDataURL(png ? "image/png" : "image/jpeg", 0.88), ratio: c.height / c.width });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function ImageEditor({ b, set }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="row">
        <label className="lq sm" style={{ cursor: "pointer" }}>
          {b.src ? "تغيير الصورة" : "رفع صورة PNG / JPG"}
          <input type="file" accept="image/png,image/jpeg" hidden onChange={async (e) => {
            const f = e.target.files[0];
            if (!f) return;
            const r = await readImage(f);
            if (r.src.length > 900000) return toast("الصورة كبيرة جدا، جرّب صورة أصغر");
            set(r);
          }} />
        </label>
        {b.src && <img src={b.src} alt="" style={{ height: 40, background: "#fff", borderRadius: 6, padding: 2 }} />}
      </div>
      <div className="grid g2">
        <label className="f">العرض ({b.width_pct || 100}% من عرض الصفحة)
          <input type="range" min="10" max="100" step="5" value={b.width_pct || 100} onChange={(e) => set({ width_pct: Number(e.target.value) })} />
        </label>
        <label className="f">المحاذاة
          <select className="in" value={b.align || "right"} onChange={(e) => set({ align: e.target.value })}>
            <option value="right">يمين</option><option value="center">وسط</option><option value="left">يسار</option>
          </select>
        </label>
      </div>
      <input className="in" placeholder="تعليق أسفل الصورة (اختياري)" value={b.caption || ""} onChange={(e) => set({ caption: e.target.value || undefined })} />
    </div>
  );
}
