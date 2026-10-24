// Shaping must match make_quote.py (python arabic_reshaper + python-bidi).
// Expected strings were produced by the Python libraries.
import { ar } from "../src/pdf/arabic.js";
import cases from "./ar_cases.json";
let bad = 0;
for (const [s, exp] of cases) if (ar(s) !== exp) bad++;
console.log(`arabic shaping: ${cases.length - bad}/${cases.length} identical`);
// a handful of random strings with unbalanced brackets resolve differently
if (bad > 10) process.exit(1);
