// Browser side: load the fixed assets once, then build PDFs on demand.
import { buildQuote } from "./engine.js";
import regularUrl from "../assets/fonts/IBMPlexSansArabic-Regular.ttf?url";
import boldUrl from "../assets/fonts/IBMPlexSansArabic-Bold.ttf?url";
import logoUrl from "../assets/logo_navy.png?url";
import semiUrl from "../assets/fonts/IBMPlexSansArabic-SemiBold.ttf?url";
import sigLogoUrl from "../assets/logo_signature.png?url";
import sigCoverUrl from "../assets/logo_signature_cover.png?url";

let assetsP = null;
const bytes = (u) => fetch(u).then((r) => r.arrayBuffer()).then((b) => new Uint8Array(b));

export function loadAssets() {
  assetsP ||= Promise.all([bytes(regularUrl), bytes(boldUrl), bytes(logoUrl)])
    .then(([fontRegular, fontBold, logo]) => ({ fontRegular, fontBold, logo }));
  return assetsP;
}

// the Signature template's extra font and logos load the first time it is used
let sigP = null;
function loadSignatureAssets() {
  sigP ||= Promise.all([loadAssets(), bytes(semiUrl), bytes(sigLogoUrl), bytes(sigCoverUrl), import("./signature.js")])
    .then(([base, fontSemi, logo, logoCover, mod]) => ({ assets: { ...base, fontSemi, logo, logoCover }, build: mod.buildSignature }))
    .catch((e) => { sigP = null; throw e; }); // try again next time
  return sigP;
}

// extra: { seller } for the Signature footer (commercial registration)
export async function renderQuote(data, pricing, theme, extra = {}) {
  let doc, warnings;
  if (data.template === "signature") {
    const { assets, build } = await loadSignatureAssets();
    ({ doc, warnings } = build(data, assets, pricing, { seller: extra.seller }));
  } else {
    const assets = await loadAssets();
    ({ doc, warnings } = buildQuote(data, assets, pricing, theme));
  }
  const blob = doc.output("blob");
  return { blob, url: URL.createObjectURL(blob), warnings };
}

export async function downloadQuote(data, pricing, theme, extra) {
  const { url } = await renderQuote(data, pricing, theme, extra);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.quote_no || "quote"} - ${data.client || ""}.pdf`.replace(/[\\/:*?"<>|]+/g, "-");
  document.body.appendChild(a); // some browsers ignore the file name on detached links
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// invoices use the same fonts, logo and theme as quotes
export async function renderInvoice(inv, theme) {
  const [{ buildInvoice }, assets] = await Promise.all([import("./invoice.js"), loadAssets()]);
  const blob = buildInvoice(inv, assets, theme).output("blob");
  return { blob, url: URL.createObjectURL(blob) };
}

export async function downloadInvoice(inv, theme) {
  const { url } = await renderInvoice(inv, theme);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${inv.number || "invoice"} - ${inv.buyer?.name || ""}.pdf`.replace(/[\\/:*?"<>|]+/g, "-");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
