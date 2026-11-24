// node test/render-solid.mjs quote.json out.pdf: draw a quote in the SOLID template
// (data.template "solid" or "solid_en"). Bank details come from SELLER_JSON, a file
// kept outside the repository.
import fs from "fs";
import { buildSolid } from "../src/pdf/solid.js";
const [,, json, out] = process.argv;
const rd = (p) => new Uint8Array(fs.readFileSync(p));
const seller = process.env.SELLER_JSON ? JSON.parse(fs.readFileSync(process.env.SELLER_JSON)) : {};
const { doc } = buildSolid(JSON.parse(fs.readFileSync(json)), {
  fontRegular: rd("src/assets/fonts/IBMPlexSansArabic-Regular.ttf"),
  fontBold: rd("src/assets/fonts/IBMPlexSansArabic-Bold.ttf"),
  logo: rd("src/assets/logo_signature.png"),
  logoCover: rd("src/assets/logo_signature_cover.png"),
}, { services: {} }, { seller });
fs.writeFileSync(out, Buffer.from(doc.output("arraybuffer")));
console.log("written", out);
