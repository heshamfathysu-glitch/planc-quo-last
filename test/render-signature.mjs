// node test/render-signature.mjs quote.json out.pdf: draw a quote in the Signature template
import fs from "fs";
import { buildSignature } from "../src/pdf/signature.js";
const [,, json, out] = process.argv;
const rd = (p) => new Uint8Array(fs.readFileSync(p));
const { doc } = buildSignature(JSON.parse(fs.readFileSync(json)), {
  fontRegular: rd("src/assets/fonts/IBMPlexSansArabic-Regular.ttf"),
  fontBold: rd("src/assets/fonts/IBMPlexSansArabic-Bold.ttf"),
  fontSemi: rd("src/assets/fonts/IBMPlexSansArabic-SemiBold.ttf"),
  logo: rd("src/assets/logo_signature.png"),
  logoCover: rd("src/assets/logo_signature_cover.png"),
}, { services: {} }, { seller: { cr: process.env.SELLER_CR || "" } });
fs.writeFileSync(out, Buffer.from(doc.output("arraybuffer")));
console.log("written", out);
