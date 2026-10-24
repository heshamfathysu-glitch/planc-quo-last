// Draws the PDF pages with pdf.js so the preview works in every browser,
// including phones that cannot show a PDF inside a page.
import { useEffect, useRef } from "react";

let pdfjsP = null;
function pdfjs() {
  pdfjsP ||= Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  });
  return pdfjsP;
}

export default function Preview({ blob }) {
  const box = useRef(null);

  useEffect(() => {
    if (!blob) return;
    let cancelled = false;
    (async () => {
      const lib = await pdfjs();
      const doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
      const width = box.current.clientWidth - 24;
      const canvases = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const ratio = window.devicePixelRatio || 1;
        const vp = page.getViewport({ scale: (width / base.width) * ratio });
        const c = document.createElement("canvas");
        c.width = vp.width; c.height = vp.height;
        c.style.width = `${width}px`;
        await page.render({ canvas: c, canvasContext: c.getContext("2d"), viewport: vp }).promise;
        canvases.push(c);
      }
      if (cancelled) return;
      box.current.replaceChildren(...canvases);
    })().catch((e) => console.error(e));
    return () => { cancelled = true; };
  }, [blob]);

  return <div ref={box} className="pages" />;
}
