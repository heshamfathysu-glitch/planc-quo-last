import { useEffect, useState } from "react";
import { statusLabel } from "./data/catalog.js";
import { fmt } from "./lib/format.js";
import { toast, setToastSink } from "./lib/notify.js";

export { toast };

export const money = (n) => `${fmt(n || 0)} ر.س`;

export function StatusBadge({ s }) {
  return <span className={`badge st-${s}`}>{statusLabel(s)}</span>;
}

export function Toaster() {
  const [t, setT] = useState(null);
  useEffect(() => { setToastSink(setT); return () => setToastSink(null); }, []);
  useEffect(() => {
    if (!t) return;
    const h = setTimeout(() => setT(null), t.kind === "error" ? 5000 : 2600);
    return () => clearTimeout(h);
  }, [t]);
  return (
    <div className="toast-zone" role={t?.kind === "error" ? "alert" : "status"} aria-live={t?.kind === "error" ? "assertive" : "polite"}>
      {t && <div key={t.at} className={`toast${t.kind === "error" ? " error" : ""}`} onClick={() => setT(null)}>{t.msg}</div>}
    </div>
  );
}

export function Footer() {
  return <footer className="foot" dir="ltr">© {new Date().getFullYear()} PLAN C · Creative Solutions</footer>;
}

export function Loading() {
  return <div className="empty" role="status">جار التحميل...</div>;
}

// phone numbers and emails as tap-to-call / tap-to-mail links
const telHref = (p) => "tel:" + p.replace(/[^\d+]/g, "");
export function Contact({ phone, email }) {
  const phones = String(phone || "").split(/[,،/|\n]+/).map((x) => x.trim()).filter((x) => x.replace(/\D/g, "").length >= 5);
  if (!phones.length && !email) return "—";
  return (
    <span className="contact">
      {phones.map((p) => <a key={p} href={telHref(p)} dir="ltr">{p}</a>)}
      {email && <a href={`mailto:${email.trim()}`} dir="ltr">{email.trim()}</a>}
    </span>
  );
}

// CSV helpers (Excel opens UTF-8 CSV with BOM correctly)
export function toCSV(rows, cols) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "﻿" + [cols.map((c) => esc(c.label)).join(","), ...rows.map((r) => cols.map((c) => esc(r[c.key])).join(","))].join("\r\n");
}
export function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === "," || ch === ";" || ch === "\t") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}
export function download(name, content, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

// two-step delete button (no browser dialogs: they are blocked in some views)
export function ConfirmButton({ onConfirm, children, ask = "اضغط مرة أخرى للتأكيد", className = "lq danger", ...rest }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" className={className} {...rest} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? ask : children}
    </button>
  );
}
