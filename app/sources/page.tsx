export default function SourcesPage(){
  const sources=[{name:'מינהל הרכש הממשלתי',desc:'המקור הרשמי למכרזים ממשלתיים. ממנו נשאבים פרטי המכרז והמסמכים הנלווים',url:'https://mr.gov.il'},{name:'מפתח התקציב',desc:'מאגר נתונים פתוח המאגד את נתוני המכרזים הממשלתיים בצורה מובנית',url:'https://next.obudget.org'}];
  return(
    <div style={{minHeight:'100vh',background:'#f0f4f8',fontFamily:'Heebo,Arial,sans-serif',direction:'rtl'}}>
      <nav style={{background:'linear-gradient(90deg,#1a56a0,#2d8ef5)',color:'white',padding:'0 16px',display:'flex',alignItems:'center',height:50,boxShadow:'0 2px 6px rgba(0,0,0,0.2)',gap:0}}>
        <a href='/dashboard' style={{fontWeight:900,fontSize:19,marginLeft:12,whiteSpace:'nowrap',color:'white',textDecoration:'none'}}>שווה מכרזים</a>
        <span style={{background:'rgba(255,255,255,0.18)',borderRadius:4,padding:'1px 7px',fontSize:10,marginLeft:20,whiteSpace:'nowrap'}}>מודל בטון שווה ביזנס 360</span>
        {[{l:'גילוי מכרזים',h:'/dashboard'},{l:'מכרזים מסומנים',h:'/marked'},{l:'סוכן חכם',h:'/agent'},{l:'ערבויות וליווי',h:'/guarantee'},{l:'מקורות',h:'/sources'}].map((it)=>(
          <a key={it.l} href={it.h} style={{padding:'0 12px',fontSize:13,cursor:'pointer',height:50,display:'flex',alignItems:'center',borderBottom:it.h==='/sources'?'3px solid white':'3px solid transparent',color:it.h==='/sources'?'white':'rgba(255,255,255,0.8)',whiteSpace:'nowrap',textDecoration:'none'}}>{it.l}</a>
        ))}
        <a href='/profile' style={{marginRight:'auto',width:28,height:28,borderRadius:'50%',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'white',textDecoration:'none'}}>א</a>
      </nav>
      <div style={{maxWidth:760,margin:'0 auto',padding:'24px 16px'}}>
        <h1 style={{fontSize:24,fontWeight:800,color:'#1a56a0',marginBottom:4}}>🌐 מקורות</h1>
        <div style={{color:'#6b7280',fontSize:14,marginBottom:18}}>רשימת המקורות הרשמיים שמהם אנו סורקים ואוספים מכרזים</div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {sources.map((s,i)=>(
            <div key={i} style={{background:'white',borderRadius:12,padding:'18px 20px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',borderRight:'4px solid #2d8ef5'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <span style={{fontSize:18,fontWeight:700,color:'#1d4ed8'}}>{s.name}</span>
                <span style={{marginRight:'auto',display:'inline-flex',alignItems:'center',gap:5,background:'#dcfce7',color:'#166534',borderRadius:20,padding:'3px 10px',fontSize:12,fontWeight:700}}><span style={{color:'#16a34a',fontSize:10}}>●</span>סריקה פעילה</span>
              </div>
              <div style={{color:'#4b5563',fontSize:14,lineHeight:1.6,marginBottom:12}}>{s.desc}</div>
              <a href={s.url} target='_blank' rel='noopener noreferrer' style={{display:'inline-block',background:'#1a56a0',color:'white',textDecoration:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600}}>מעבר למקור</a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
