import logoNavy from "./assets/logo_navy_ui.png";
import logoWhite from "./assets/logo_white_ui.png";

// "light" (default) or "navy"; styles.css holds the tokens for both.
// The *_ui logos are small copies for the screen; the PDF keeps the full-size logo.
export const THEME = "light";
export const LOGO = THEME === "navy" ? logoWhite : logoNavy;
