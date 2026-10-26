import { useEffect, useRef } from "react";
import { NEAT_CONFIG } from "./data/neatConfig.js";

// Full-screen animated gradient behind the whole app. The library (WebGL)
// loads after the page so it never delays the first paint.
export default function NeatBackground() {
  const ref = useRef(null);
  useEffect(() => {
    let gradient = null;
    let gone = false;
    const onScroll = () => { if (gradient) gradient.yOffset = window.scrollY; };
    import("@firecms/neat").then(({ NeatGradient }) => {
      if (gone || !ref.current) return;
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      try {
        gradient = new NeatGradient({ ref: ref.current, ...NEAT_CONFIG, ...(still ? { speed: 0 } : {}) });
        window.addEventListener("scroll", onScroll, { passive: true });
      } catch { /* no WebGL: the plain background colour stays */ }
    }).catch(() => {});
    return () => {
      gone = true;
      window.removeEventListener("scroll", onScroll);
      gradient?.destroy();
    };
  }, []);
  return <canvas id="gradient" ref={ref} className="neat-bg" aria-hidden="true" />;
}
