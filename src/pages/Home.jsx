import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { createDraft } from "../lib/newQuote.js";

// The home page is a single "create quote" button; everything else is in the nav.
export default function Home() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [pressed, setPressed] = useState(false);

  async function start() {
    if (pressed) return;
    setPressed(true);
    try {
      // let the colour layers play while the draft is created
      const [q] = await Promise.all([createDraft(user), new Promise((r) => setTimeout(r, 380))]);
      nav(`/new/${q.id}`);
    } catch {
      setPressed(false);
    }
  }

  return (
    <section className="hero home-start">
      <h1 className="sr-only">الرئيسية</h1>
      <button className={`lq primary xl start-btn${pressed ? " pressed" : ""}`} onClick={start}>
        إنشاء عرض سعر سريع
      </button>
    </section>
  );
}
