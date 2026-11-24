// Text form of the SOLID template's scope sections, for the editor (kept
// apart from solid.js so the editor does not load jsPDF up front).
// "# title | TAG" starts a section, "- title | text" adds a cell, any other
// line is the section text. Used by the editor and the tests.
export function parseSections(text) {
  const out = [];
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      const [title, tag = ""] = line.slice(1).split("|").map((x) => x.trim());
      out.push({ title, tag, text: "", cells: [] });
      continue;
    }
    if (!out.length) out.push({ title: "", tag: "", text: "", cells: [] });
    const sec = out[out.length - 1];
    if (line.startsWith("-")) {
      const [title, ...rest] = line.slice(1).split("|");
      sec.cells.push({ title: title.trim(), text: rest.join("|").trim() });
    } else sec.text = sec.text ? `${sec.text} ${line}` : line;
  }
  return out;
}
export function sectionsText(sections) {
  return (sections || []).map((s) => [
    `# ${s.title || ""}${s.tag ? ` | ${s.tag}` : ""}`,
    ...(s.text ? [s.text] : []),
    ...(s.cells || []).map((c) => `- ${c.title || ""}${c.text ? ` | ${c.text}` : ""}`),
  ].join("\n")).join("\n\n");
}
