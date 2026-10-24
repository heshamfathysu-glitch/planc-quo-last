import Registry from "./Registry.jsx";
import { useCollection } from "../lib/store.js";
import { CLIENT_TYPES, SECTORS } from "../data/catalog.js";
import { money } from "../ui.jsx";

const FIELDS = [
  { key: "name", label: "الاسم" },
  { key: "code", label: "رمز العميل (لرقم العرض)", ltr: true },
  { key: "type", label: "التصنيف", options: CLIENT_TYPES },
  { key: "sector", label: "القطاع", options: SECTORS },
  { key: "contact", label: "الشخص المسؤول" },
  { key: "phone", label: "الجوال", ltr: true },
  { key: "email", label: "البريد", ltr: true },
  { key: "city", label: "المدينة" },
  { key: "website", label: "الموقع / الروابط", ltr: true },
  { key: "vat", label: "الرقم الضريبي", ltr: true },
  { key: "notes", label: "ملاحظات", wide: true },
];

const lbl = (list, id) => list.find((x) => x.id === id)?.label || "—";

export default function Clients() {
  const [quotes] = useCollection("quotes");
  const stats = (name) => {
    const qs = (quotes || []).filter((q) => q.data?.client === name);
    return { n: qs.length, won: qs.filter((q) => q.status === "approved").reduce((s, q) => s + (q.total || 0), 0) };
  };
  return (
    <Registry
      col="clients"
      title="سجل العملاء"
      fields={FIELDS}
      columns={[
        { key: "name", label: "الاسم" },
        { key: "type", label: "التصنيف", render: (r) => lbl(CLIENT_TYPES, r.type) },
        { key: "sector", label: "القطاع", render: (r) => lbl(SECTORS, r.sector) },
        { key: "contact", label: "المسؤول" },
        { key: "phone", label: "الجوال", ltr: true },
      ]}
      extra={{ label: "العروض / المعتمد", render: (r) => { const s = stats(r.name); return `${s.n} / ${money(s.won)}`; } }}
    />
  );
}
