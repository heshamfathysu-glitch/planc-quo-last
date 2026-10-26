import logoNavy from "./assets/logo_navy_ui.png";
import logoWhite from "./assets/logo_white_ui.png";

// "glass" (default), "light" or "navy"; styles.css holds the tokens for each.
// The *_ui logos are small copies for the screen; the PDF keeps the full-size logo.
export const THEME = "glass";
export const LOGO = THEME === "light" ? logoNavy : logoWhite;

// "image" (the blue gradient photo, assets/bg-blue.jpg) or "neat" (the animated
// NEAT gradient, src/data/neatConfig.js). Each sits under its own dark layer.
export const BACKGROUND = "image";
