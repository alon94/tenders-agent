'use client';
// QA/H-3: לא היה בפרויקט אף error boundary — כל חריגה ברינדור הפילה
// את העץ כולו למסך לבן, בלי הודעה ובלי דרך לצאת מזה.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div dir="rtl" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Assistant',-apple-system,'Segoe UI',Arial,sans-serif" }}>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠</div>
        <h1 style={{ fontSize: 21, color: '#12212e', margin: '0 0 10px' }}>משהו השתבש</h1>
        <p style={{ color: '#5f7183', fontSize: 14.5, lineHeight: 1.7, margin: '0 0 20px' }}>
          התקלה נרשמה אצלנו. הנתונים שלכם לא נפגעו — נסו לרענן את העמוד.
        </p>
        <button onClick={reset} style={{ background: '#12212e', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 26px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          נסו שוב
        </button>
      </div>
    </div>
  );
}
