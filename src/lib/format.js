// Number format shared by the app and the PDF engine: 1,234.5 (no trailing zeros)
export function fmt(n) {
  n = Math.round(Number(n) * 100) / 100;
  let s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  s = s.replace(/0+$/, "").replace(/\.$/, "");
  return (n < 0 ? "-" : "") + s;
}
