// Browser side: load the fixed assets once, then build PDFs on demand.
import { buildQuote } from "./engine.js";
import regularUrl from "../assets/fonts/IBMPlexSansArabic-Regular.ttf?url";
import boldUrl from "../assets/fonts/IBMPlexSansArabic-Bold.ttf?url";
import logoUrl from "../assets/logo_navy.png?url";

let assetsP = null;
const bytes = (u) => fetch(u).then((r) => r.arrayBuffer()).then((b) => new Uint8Array(b));

export function loadAssets() {
  assetsP ||= Promise.all([bytes(regularUrl), bytes(boldUrl), bytes(logoUrl)])
    .then(([fontRegular, fontBold, logo]) => ({ fontRegular, fontBold, logo }));
  return assetsP;
}

export async function renderQuote(data, pricing, theme) {
  const assets = await loadAssets();
  const { doc, warnings } = buildQuote(data, assets, pricing, theme);
  const blob = doc.output("blob");
  return { blob, url: URL.createObjectURL(blob), warnings };
}

export async function downloadQuote(data, pricing, theme) {
  const { url } = await renderQuote(data, pricing, theme);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.quote_no || "quote"} - ${data.client || ""}.pdf`.replace(/[\\/:*?"<>|]+/g, "-");
  document.body.appendChild(a); // some browsers ignore the file name on detached links
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
