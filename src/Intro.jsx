import { useEffect, useRef, useState } from "react";
import introMp4 from "./assets/intro.mp4";
import introWebm from "./assets/intro.webm";

// Opening video, once per browser session. It plays muted because browsers only
// autoplay silent video; if it can't play (autoplay blocked, low-power mode, slow
// network) the app simply shows without it.
const SEEN = "planc:intro";

function firstVisit() {
  try {
    return sessionStorage.getItem(SEEN) !== "1" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export default function Intro() {
  const [show, setShow] = useState(firstVisit);
  const [leaving, setLeaving] = useState(false);
  const ref = useRef(null);

  function close() {
    setLeaving(true);
    setTimeout(() => setShow(false), 500);
  }

  useEffect(() => {
    if (!show) return;
    try { sessionStorage.setItem(SEEN, "1"); } catch { /* private mode: it may show again */ }
    const v = ref.current;
    v.play().catch(close);
    const stalled = setTimeout(() => { if (v.currentTime === 0) close(); }, 4000);
    return () => clearTimeout(stalled);
  }, [show]);

  if (!show) return null;
  return (
    <div className={`intro${leaving ? " leaving" : ""}`} role="dialog" aria-label="مقدمة PLAN C">
      <video ref={ref} muted playsInline preload="auto" aria-hidden="true" onEnded={close} onError={close}>
        <source src={introMp4} type="video/mp4" />
        <source src={introWebm} type="video/webm" onError={close} />
      </video>
      <button type="button" className="lq sm intro-skip" onClick={close}>تخطي</button>
    </div>
  );
}
