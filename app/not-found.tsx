// QA/M-12: עמוד ה-404 היה ברירת המחדל של Next באנגלית —
// "404: This page could not be found." — באתר עברי RTL.
export default function NotFound() {
  return (
    <div dir="rtl" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Assistant',-apple-system,'Segoe UI',Arial,sans-serif" }}>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <div style={{ fontSize: '2.75rem', fontWeight: 800, color: '#dbe3ea', letterSpacing: -1 }}>404</div>
        <h1 style={{ fontSize: '1.3125rem', color: '#12212e', margin: '6px 0 10px' }}>העמוד לא נמצא</h1>
        <p style={{ color: '#5f7183', fontSize: '0.90625rem', lineHeight: 1.7, margin: '0 0 20px' }}>
          ייתכן שהקישור שגוי או שהעמוד הוסר.
        </p>
        <a href="/dashboard" style={{ display: 'inline-block', background: '#12212e', color: '#fff', borderRadius: 9, padding: '10px 26px', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
          חזרה לגילוי מכרזים
        </a>
      </div>
    </div>
  );
}
