// Wizard choices. Services with a `pricing` key take their unit price from the
// internal price list; the rest are priced by hand in the wizard.

export const CLIENT_TYPES = [
  { id: "direct", label: "عميل مباشر", ask: "اسم العميل" },
  { id: "company", label: "لصالح شركة", ask: "اسم الشركة" },
  { id: "mutual", label: "تعاون متبادل", ask: "من هو؟" },
  { id: "third", label: "طرف ثالث", ask: "ما اسمه؟", internal: true },
];

export const SECTORS = [
  { id: "cafe", label: "كافيه", ic: "☕" },
  { id: "restaurant", label: "مطعم", ic: "🍽" },
  { id: "realestate", label: "عقار", ic: "🏢" },
  { id: "cars", label: "سيارات", ic: "🚗" },
  { id: "company", label: "تعاون مع شركة", ic: "🤝" },
  { id: "other", label: "أخرى", ic: "✦" },
];

export const PRODUCT_RANGES = [
  { label: "1 - 20", qty: 20 },
  { label: "20 - 30", qty: 30 },
  { label: "40 - 50", qty: 50 },
  { label: "50 - 100", qty: 100 },
];

export const DURATIONS = [
  { id: "7-15", label: "من 7 إلى 15 ثانية" },
  { id: "15-30", label: "من 15 إلى 30 ثانية", base: true },
  { id: "30-60", label: "من 30 إلى 60 ثانية" },
  { id: "60-90", label: "من 60 إلى 90 ثانية" },
  { id: "120+", label: "أكثر من دقيقتين" },
  { id: "open", label: "غير محدد" },
  { id: "custom", label: "اكتب بالدقائق" },
];

export const VIDEO_TYPES = [
  { id: "social", label: "تصوير سوشيال ميديا", pricing: "social_reel" },
  { id: "interview", label: "تصوير مقابلة", pricing: "interview_reel" },
  { id: "event", label: "تغطية حدث" },
  { id: "realestate", label: "تصوير عقاري" },
  { id: "package", label: "تصوير داخل باقة" },
];

export const SERVICES = [
  { id: "photo", label: "تصوير فوتوغرافي", ic: "📷" },
  { id: "video", label: "تصوير فيديو", ic: "🎬" },
  { id: "website", label: "تصميم موقع", ic: "🌐" },
  { id: "landing", label: "تصميم صفحة هبوط", ic: "🧭" },
  { id: "consult", label: "استشارة تسويقية", ic: "💡" },
  { id: "identity", label: "تصميم هوية بصرية", ic: "🎨" },
  { id: "accounts", label: "إدارة حسابات", ic: "📱" },
  { id: "package", label: "باقة مخصصة", ic: "📦" },
  { id: "custom", label: "أضف خدمة مخصصة", ic: "＋" },
];

export const STATUSES = [
  { id: "draft", label: "مسودة" },
  { id: "sent", label: "مرسل" },
  { id: "approved", label: "معتمد" },
  { id: "rejected", label: "مرفوض" },
  { id: "expired", label: "منتهي" },
];
export const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label || id;

export const DEFAULT_TERMS = [
  { title: "نطاق العمل", text: "تنفيذ الخدمات ضمن الخيار المعتمد وفق اتجاه بصري وقائمة مخرجات يعتمدان قبل بدء التنفيذ." },
  { title: "الجاهزية وجدول التنفيذ", text: "يحدد موعد التنفيذ وموعد التسليم بالتنسيق بين الطرفين قبل بدء العمل." },
  { title: "التسليم والتعديلات", text: "يشمل العرض جولة تعديل واحدة على المخرجات النهائية، وأي مخرجات أو تعديلات إضافية تسعر بشكل مستقل." },
  { title: "الاستخدام والدفع والاعتماد", text: "تستخدم المخرجات في القنوات المملوكة للعميل. يتفق على آلية السداد قبل تأكيد الحجز." },
];

export const ORDINALS = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن"];
