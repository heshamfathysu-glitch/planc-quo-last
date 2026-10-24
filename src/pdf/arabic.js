// Port of python arabic_reshaper (default config) + python-bidi get_display,
// so text is shaped exactly as make_quote.py shaped it.
import bidiFactory from "bidi-js";
import data from "./arabicData.json";

const UNSHAPED = 255, ISOLATED = 0, INITIAL = 1, MEDIAL = 2, FINAL = 3;
const NOT_SUPPORTED = -1;
const TATWEEL = "ـ", ZWJ = "‍";
const L = data.letters;
const O = data.opts;
const HARAKAT = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭࣔ-࣡ࣔ-࣭ࣣ-ࣿ]/;
const HARAKAT_G = new RegExp(HARAKAT.source, "g");
const LIG_RE = new RegExp(data.ligatures.map(([m]) => `(${m})`).join("|"), "gu");

const before = (c) => c in L && !!(L[c][FINAL] || L[c][MEDIAL]);
const after = (c) => c in L && !!(L[c][INITIAL] || L[c][MEDIAL]);
const both = (c) => c in L && !!L[c][MEDIAL];

export function reshape(text) {
  if (!text) return "";
  const iso = O.use_unshaped_instead_of_isolated ? UNSHAPED : ISOLATED;
  let out = [];
  for (const ch of text) {
    if (HARAKAT.test(ch)) {
      // delete_harakat is on in the default config
    } else if (ch === TATWEEL && O.delete_tatweel) {
    } else if (ch === ZWJ && !O.support_zwj) {
    } else if (!(ch in L)) out.push([ch, NOT_SUPPORTED]);
    else if (!out.length) out.push([ch, iso]);
    else {
      const p = out[out.length - 1];
      if (p[1] === NOT_SUPPORTED) out.push([ch, iso]);
      else if (!before(ch)) out.push([ch, iso]);
      else if (!after(p[0])) out.push([ch, iso]);
      else if (p[1] === FINAL && !both(p[0])) out.push([ch, iso]);
      else if (p[1] === iso) { out[out.length - 1] = [p[0], INITIAL]; out.push([ch, FINAL]); }
      else { out[out.length - 1] = [p[0], MEDIAL]; out.push([ch, FINAL]); }
    }
    if (O.support_zwj && out.length > 1 && out[out.length - 2][0] === ZWJ) out.splice(out.length - 2, 1);
  }
  if (O.support_zwj && out.length && out[out.length - 1][0] === ZWJ) out.pop();

  if (O.support_ligatures) {
    let t = text.replace(HARAKAT_G, "");
    if (O.delete_tatweel) t = t.split(TATWEEL).join("");
    // python indexes by code point; work on a code point array
    const cps = Array.from(t);
    const idx = []; // utf16 offset -> code point index
    let u = 0;
    cps.forEach((c, i) => { idx[u] = i; u += c.length; });
    idx[u] = cps.length;
    for (const m of t.matchAll(LIG_RE)) {
      const g = m.slice(1).findIndex((x) => x);
      const forms = data.ligatures[g][1];
      const a = idx[m.index], b = idx[m.index + m[0].length];
      const af = out[a][1], bf = out[b - 1][1];
      let lf;
      if (af === iso || af === INITIAL) lf = bf === iso || bf === FINAL ? ISOLATED : INITIAL;
      else lf = bf === iso || bf === FINAL ? FINAL : MEDIAL;
      if (!forms[lf]) continue;
      out[a] = [forms[lf], NOT_SUPPORTED];
      for (let k = a + 1; k < b; k++) out[k] = ["", NOT_SUPPORTED];
    }
  }
  let res = "";
  for (const [ch, f] of out) {
    if (!ch) continue;
    res += f === NOT_SUPPORTED || f === UNSHAPED ? ch : L[ch][f];
  }
  return res;
}

const bidi = bidiFactory();

export function getDisplay(text) {
  const levels = bidi.getEmbeddingLevels(text);
  const chars = Array.from(text);
  // bidi-js works on utf16 indices; our texts are BMP so they line up
  const mirrored = bidi.getMirroredCharactersMap(text, levels.levels);
  mirrored.forEach((c, i) => { chars[i] = c; });
  for (const [s, e] of bidi.getReorderSegments(text, levels)) {
    const seg = chars.slice(s, e + 1).reverse();
    chars.splice(s, seg.length, ...seg);
  }
  return chars.join("");
}

// same as make_quote.ar(): keep percentages as "25%"
export function ar(text) {
  return getDisplay(reshape(String(text))).replace(/%(\d[\d,.]*)/g, "$1%");
}
