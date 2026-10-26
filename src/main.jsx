import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.jsx";
import { toast, errorText } from "./lib/notify.js";

// any failed action that nobody handled still gets a clear message
window.addEventListener("unhandledrejection", (e) => {
  if (e.reason?.notified) return e.preventDefault();
  toast(errorText(e.reason), "error");
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
