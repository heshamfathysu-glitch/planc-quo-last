import { put } from "./store.js";

export async function createDraft(user) {
  return put("quotes", {
    status: "draft",
    step: 0,
    answers: { preparer: user.name, issueDate: new Date().toISOString().slice(0, 10), validDays: 7, services: [] },
  }, user);
}
