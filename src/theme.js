import logoNavy from "./assets/logo_navy_ui.png";
import logoWhite from "./assets/logo_white_ui.png";

// "kit-light" (default) and "kit-dark" follow the PLAN C UI Kit V5.1; the top bar
// switches between them and each browser remembers its choice. "glass", "light"
// and "navy" are the older looks; styles.css holds the tokens for each.
// The *_ui logos are small copies for the screen; the PDF keeps the full-size logo.
export const THEMES = ["kit-light", "kit-dark"];
const KEY = "planc:theme";
export const THEME = (() => {
  try { const t = localStorage.getItem(KEY); return THEMES.includes(t) ? t : THEMES[0]; } catch { return THEMES[0]; }
})();
export function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch { /* private mode */ }
}
// the top bar is navy in every kit theme, so it keeps the white logo
export const LOGO = THEME === "light" ? logoNavy : logoWhite;
export { logoNavy, logoWhite };

// "image" (three photos taking turns: blue, orange, green; assets/bg-*.jpg) or
// "neat" (the animated NEAT gradient, src/data/neatConfig.js). Only the "glass"
// theme shows it; the kit themes use a plain background.
export const BACKGROUND = "image";
export const SHOW_BACKGROUND = THEME === "glass";
