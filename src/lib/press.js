// Every press washes the button in a colour for a moment (styles.css: [data-press]).
// The colour moves through the brand palette (Accent, Success, Soft) so each
// press looks new. A data attribute, not a class, so React re-renders keep it.
// Choice tiles and tabs are left out: they turn green and stay green instead.
const TARGETS = "button, a.lq, .bottomnav a, .sheet a, .topbar nav a";
const CHOICES = ".tile, .tab";
const COLORS = 3;
let next = 0;

function flash(el) {
  const target = el.querySelector(".disc") || el;
  target.removeAttribute("data-press");
  void target.offsetWidth; // restart the animation on quick repeat presses
  target.setAttribute("data-press", String(next++ % COLORS));
}

document.addEventListener("pointerdown", (e) => {
  const el = e.target.closest?.(TARGETS);
  if (el && !el.disabled && !el.matches(CHOICES)) flash(el);
});
document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches?.(TARGETS) && !e.target.matches(CHOICES) && !e.target.disabled) flash(e.target);
});
document.addEventListener("animationend", (e) => {
  if (e.animationName === "press-flash") e.target.removeAttribute("data-press");
});
