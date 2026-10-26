// Tiny toast bus, kept free of heavy imports so the data layer can use it.
let sink = null;
export const setToastSink = (fn) => { sink = fn; };
export function toast(msg, kind = "ok") { sink?.({ msg, kind, at: Date.now() }); }

// A readable Arabic message for a failed action.
export function errorText(e) {
  const code = String(e?.code || e?.name || "");
  if (code.includes("permission-denied")) return "ليست لديك صلاحية لهذا الإجراء.";
  if (code.includes("unavailable") || code.includes("network") || (typeof navigator !== "undefined" && navigator.onLine === false))
    return "تعذر الاتصال بالخادم. تحقق من الإنترنت ثم حاول مرة أخرى.";
  if (code.includes("QuotaExceeded")) return "مساحة التخزين في المتصفح ممتلئة.";
  return "تعذر إتمام العملية. حاول مرة أخرى.";
}

// Show the error once and mark it so the global handler stays quiet.
export function fail(e) {
  if (e && typeof e === "object" && !e.notified) { toast(errorText(e), "error"); e.notified = true; }
  throw e;
}
