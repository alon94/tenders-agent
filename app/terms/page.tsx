export default function TermsPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f6f8fa',
        direction: 'rtl',
        fontFamily: "'Heebo', Arial, sans-serif",
        display: 'flex',
        justifyContent: 'center',
        padding: '60px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 640,
          background: '#fff',
          border: '1px solid #e6eaee',
          borderRadius: 14,
          padding: 32,
          color: '#1a2330',
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>תנאי שימוש</h1>
        <p style={{ fontSize: 14, color: '#5b6b7a', lineHeight: 1.7 }}>
          עמוד זה הינו placeholder זמני. בעל האתר יעדכן כאן את תנאי השימוש המלאים בקרוב.
        </p>
      </div>
    </div>
  );
}
