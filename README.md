# عروض أسعار PLAN C

تطبيق ويب لإنتاج عروض أسعار PLAN C بالقالب الثابت (عرض Gloria Jeans المرجعي)، مع سجل العروض والعملاء وشركات التسويق والإنتاج.

## التشغيل محليا

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # اختبار تشكيل العربي ومحرك PDF
npm run build    # ملفات النشر في dist/
```

بدون إعداد Firebase يعمل التطبيق في **وضع تجريبي** ويحفظ البيانات في المتصفح.

## ربط Firebase

1. أنشئ مشروعا في Firebase Console، وفعّل Authentication بالبريد وكلمة المرور، وأنشئ Firestore.
2. انسخ إعدادات تطبيق الويب إلى `src/firebaseConfig.js`، واكتب بريد الأدمن في `adminEmail`.
3. انسخ محتوى `firestore.rules` إلى Firestore > Rules بعد وضع بريد الأدمن مكان `ADMIN_EMAIL`، ثم Publish.
4. أنشئ حساب الأدمن من Authentication > Add user، ثم ادخل به وأضف بقية المستخدمين من لوحة التحكم.
5. أضف نطاق النشر (مثل `<user>.github.io`) في Authentication > Settings > Authorized domains.

## قائمة الأسعار

قائمة الأسعار داخلية: لا تُحفظ في هذا المستودع. يرفعها الأدمن مرة واحدة من لوحة التحكم > قائمة الأسعار (ملف `pricing.json`)، فتُحفظ في Firestore ولا يقرؤها إلا المستخدمون المسجلون.

## القالب

`src/pdf/engine.js` نقل حرفي لـ `make_quote.py`: نفس المقاسات والألوان وأحجام الخطوط والشعار. تشكيل النص العربي في `src/pdf/arabic.js` يطابق مكتبات Python الأصلية (يتحقق منه `npm test`). لا تعدّل ثوابت التخطيط؛ العرض الجديد يغيّر البيانات فقط. الألوان ووزن خط العناوين قابلة للتغيير من لوحة التحكم، والقيم الافتراضية هي القالب الأصلي.

أقسام العرض: `info`، `intro`، `card`، `note`، `terms`، `approval`، وإضافات بنفس الأسلوب: `image` (صورة أو شعار PNG) و`chart` (رسم بياني بالأعمدة).

## النشر

كل دفع إلى `main` يبني التطبيق وينشره على GitHub Pages عبر `.github/workflows/deploy.yml`. فعّل Pages مرة واحدة من Settings > Pages > Source: GitHub Actions.
