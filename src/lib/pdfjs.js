// One pdf.js loader for the whole app (preview and file reading).
// Uses the "legacy" build: the modern one calls very new browser features
// (Map.getOrInsertComputed, Promise.withResolvers, ...) that Safari on
// iPhone does not have yet. On top of that, getTextContent loops over a
// ReadableStream with `for await`, which Safari also lacks: pdfPolyfills.js
// adds it, on the page and in the worker.

import "./pdfPolyfills.js";

let pdfjsP = null;
export function pdfjs() {
  pdfjsP ||= import("pdfjs-dist/legacy/build/pdf.mjs").then((lib) => {
    try {
      lib.GlobalWorkerOptions.workerPort = new Worker(new URL("./pdf.worker.js", import.meta.url), { type: "module" });
    } catch {
      // no module workers: plain worker file without the fills
      return import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url").then((w) => {
        lib.GlobalWorkerOptions.workerSrc = w.default;
        return lib;
      });
    }
    return lib;
  }).catch((e) => { pdfjsP = null; throw e; });
  return pdfjsP;
}

// all text of a page, read chunk by chunk without `for await`
export async function pageText(page) {
  const reader = page.streamTextContent().getReader();
  const items = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    items.push(...value.items);
  }
  return items;
}
