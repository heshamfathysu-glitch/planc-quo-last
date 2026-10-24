import fs from "fs";
import { buildQuote } from "../src/pdf/engine.js";
const [,, json, out] = process.argv;
const rd = (p) => new Uint8Array(fs.readFileSync(p));
const pricing = JSON.parse(fs.readFileSync("/mnt/project-files/plan-c-quotes/pricing.json"));
const { doc, warnings } = buildQuote(JSON.parse(fs.readFileSync(json)), {
  fontRegular: rd("src/assets/fonts/IBMPlexSansArabic-Regular.ttf"),
  fontBold: rd("src/assets/fonts/IBMPlexSansArabic-Bold.ttf"),
  logo: rd("src/assets/logo_navy.png"),
}, pricing);
fs.writeFileSync(out, Buffer.from(doc.output("arraybuffer")));
console.log("written", out, warnings);
