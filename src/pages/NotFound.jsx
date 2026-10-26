import { Link } from "react-router-dom";

export default function NotFound({ text = "الصفحة التي تبحث عنها غير موجودة أو تم نقلها." }) {
  return (
    <section className="hero notfound">
      <b className="code" aria-hidden="true">404</b>
      <h1>الصفحة غير موجودة</h1>
      <p className="sub">{text}</p>
      <div className="row" style={{ justifyContent: "center" }}>
        <Link className="lq primary" to="/">العودة للرئيسية</Link>
        <Link className="lq" to="/quotes">سجل العروض</Link>
      </div>
    </section>
  );
}
