import logoNavy from "./assets/logo_navy.png";
import logoWhite from "./assets/logo_white.png";

// "light" (default) or "navy"; styles.css holds the tokens for both
export const THEME = "light";
export const LOGO = THEME === "navy" ? logoWhite : logoNavy;
