"use client";
import SiteNav from "../components/SiteNav";

const NAVY="#0b2e52",BLUE="#2e86de",PURPLE="#7c5cf0",MUTED="#64778a";
const RBK="Rubik,'Assistant',Arial,sans-serif";

export default function GuaranteePage(){
  const services=[
    {icon:'🛡',title:'ערבויות מכרז וביצוע',desc:'הנפקת ערבויות בנקאיות ומוסדיות במהירות, בהתאמה לדרישות המכרז — ללא בירוקרטיה מיותרת.'},
    {icon:'📋',title:'ליווי בהגשת ההצעה',desc:'בדיקת עמידה בתנאי הסף, ארגון המסמכים והגשה מסודרת במועד — כדי שלא תיפסלו על טכניקה.'},
    {icon:'⚖️',title:'ייעוץ משפטי ומקצועי',desc:'חוות דעת על תנאי המכרז, ליווי בשאלות הבהרה ובהשגות מול הגוף המפרסם.'},
    {icon:'💰',title:'מימון וגישור פיננסי',desc:'פתרונות מימון להון חוזר ולעמידה בדרישות איתנות פיננסית של מכרזים גדולים.'},
  ];
  return(
    <div style={{minHeight:'100vh',background:'#e9f3fc',fontFamily:"'Assistant',Arial,sans-serif",direction:'rtl',color:NAVY}}>
      <SiteNav active="/guarantee"/>
      <div style={{maxWidth:900,margin:'0 auto',padding:'28px 16px 40px'}}>
        {/* hero */}
        <div style={{background:'linear-gradient(135deg,#0b2e52,#1a5fa8)',borderRadius:22,padding:'32px 34px',color:'#fff',marginBottom:24}}>
          <div style={{fontFamily:RBK,fontSize:28,fontWeight:800,marginBottom:8}}>🛡 ערבויות וליווי</div>
          <div style={{fontSize:15,opacity:.9,lineHeight:1.6,maxWidth:560}}>מרגע שמצאתם מכרז מתאים — אנחנו איתכם עד ההגשה. ערבויות, ליווי מקצועי ומימון, הכול תחת קורת גג אחת.</div>
          <a href="/agent" style={{display:'inline-block',marginTop:18,background:'#cdef4a',color:NAVY,fontWeight:700,fontSize:14,padding:'11px 22px',borderRadius:999,textDecoration:'none'}}>דברו עם הסוכן החכם ✦</a>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}}>
          {services.map((s,i)=>(
            <div key={i} style={{background:'#fff',borderRadius:20,padding:'24px 26px',boxShadow:'0 10px 28px rgba(11,46,82,.05)'}}>
              <div style={{fontSize:28,marginBottom:12}}>{s.icon}</div>
              <div style={{fontFamily:RBK,fontSize:18,fontWeight:700,color:NAVY,marginBottom:8}}>{s.title}</div>
              <div style={{fontSize:14,color:'#4b5f72',lineHeight:1.6}}>{s.desc}</div>
            </div>
          ))}
        </div>

        <div style={{background:'#fff',borderRadius:20,padding:'26px 28px',boxShadow:'0 10px 28px rgba(11,46,82,.05)',marginTop:16,display:'flex',alignItems:'center',gap:20,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:220}}>
            <div style={{fontFamily:RBK,fontSize:18,fontWeight:700,color:NAVY}}>רוצים ליווי למכרז ספציפי?</div>
            <div style={{fontSize:14,color:MUTED,marginTop:6}}>השאירו פרטים ונחזור אליכם עם הצעה מותאמת תוך יום עסקים.</div>
          </div>
          <a href="/register" style={{background:NAVY,color:'#fff',fontWeight:700,fontSize:15,padding:'13px 26px',borderRadius:12,textDecoration:'none',fontFamily:RBK}}>יצירת קשר</a>
        </div>
      </div>
    </div>
  );
}
