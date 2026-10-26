// "Direct trial" entry: opens the app without an account. It runs on this
// browser's storage only and never reads or writes the real Firebase data.
// Enter from the login page button or the link  …/#/demo
export const DEMO_KEY = "planc:demo";
const ME_KEY = "planc:me";
const DEMO_USER = { uid: "demo", name: "زائر تجريبي", email: "", role: "admin" };

function setDemo() {
  localStorage.setItem(DEMO_KEY, "1");
  localStorage.setItem(ME_KEY, JSON.stringify(DEMO_USER));
}

export const DEMO = (() => {
  try {
    if (location.hash.startsWith("#/demo")) {
      setDemo();
      history.replaceState(null, "", "#/");
    }
    return localStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
})();

// the data layer is chosen once at load, so switching mode reloads the page
export function enterDemo() {
  setDemo();
  location.hash = "#/";
  location.reload();
}
export function leaveDemo() {
  localStorage.removeItem(DEMO_KEY);
  localStorage.removeItem(ME_KEY);
  location.hash = "#/";
  location.reload();
}

// the link can also be opened in a tab where the app is already running
window.addEventListener("hashchange", () => {
  if (location.hash.startsWith("#/demo")) enterDemo();
});
