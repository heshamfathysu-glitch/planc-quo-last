import { put } from "./store.js";
import { todayISO } from "./compose.js";

export async function createDraft(user) {
  return put("quotes", {
    status: "draft",
    step: 0,
    answers: { preparer: user.name, issueDate: todayISO(), validDays: 7, services: [] },
  }, user);
}
