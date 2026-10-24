import Registry from "./Registry.jsx";

const KINDS = [
  { id: "marketing", label: "تسويق" },
  { id: "production", label: "إنتاج" },
  { id: "both", label: "تسويق وإنتاج" },
  { id: "freelancer", label: "مستقل" },
];

const FIELDS = [
  { key: "name", label: "اسم الشركة" },
  { key: "kind", label: "النوع", options: KINDS },
  { key: "contact", label: "الشخص المسؤول" },
  { key: "phone", label: "أرقام التواصل", ltr: true },
  { key: "email", label: "البريد", ltr: true },
  { key: "city", label: "المدينة / الموقع" },
  { key: "website", label: "الموقع الإلكتروني", ltr: true },
  { key: "links", label: "روابط (سوشيال، بورتفوليو)", wide: true },
  { key: "services", label: "الخدمات التي يقدمونها", wide: true },
  { key: "notes", label: "ملاحظات", wide: true },
];

export default function Companies() {
  return (
    <Registry
      col="companies"
      title="شركات التسويق والإنتاج"
      fields={FIELDS}
      columns={[
        { key: "name", label: "الشركة" },
        { key: "kind", label: "النوع", render: (r) => KINDS.find((k) => k.id === r.kind)?.label || "—" },
        { key: "contact", label: "المسؤول" },
        { key: "phone", label: "التواصل", ltr: true },
        { key: "website", label: "الموقع", ltr: true, render: (r) => r.website ? <a href={/^https?:/.test(r.website) ? r.website : "https://" + r.website} target="_blank" rel="noreferrer">{r.website}</a> : "—" },
      ]}
    />
  );
}
