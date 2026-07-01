"use client";
import SiteNav from "../components/SiteNav";

const NAVY="#0b2e52",BLUE="#2e86de",MUTED="#64778a";
const RBK="Rubik,'Assistant',Arial,sans-serif";

export default function SourcesPage(){
  const sources=[
    {name:'מינהל הרכש הממשלתי',desc:'המקור הרשמי למכרזים ממשלתיים. ממנו נשאבים פרטי המכרז והמסמכים הנלווים',url:'https://mr.gov.il'},
    {name:'מפתח התקציב',desc:'מאגר נתונים פתוח המאגד את נתוני המכרזים הממשלתיים בצורה מובנית',url:'https://next.obudget.org'},
  ];
  return(
    <div style={{minHeight:'100vh',background:'#e9f3fc',fontFamily:"'Assistant',Arial,sans-serif",direction:'rtl',color:NAVY}}>
      <SiteNav active="/sources"/>
      <div style={{maxWidth:760,margin:'0 auto',padding:'28px 16px 40px'}}>
        <h1 style={{fontFamily:RBK,fontSize:26,fontWeight:800,color:NAVY,marginBottom:6}}>⛁ מקורות</h1>
        <div style={{color:MUTED,fontSize:14,marginBottom:22}}>רשימת המקורות הרשמיים שמהם אנו סורקים ואוספים מכרזים</div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {sources.map((s,i)=>(
            <div key={i} style={{background:'#fff',borderRadius:20,padding:'22px 24px',boxShadow:'0 10px 28px rgba(11,46,82,.05)',borderInlineEnd:`4px solid ${BLUE}`}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <span style={{fontFamily:RBK,fontSize:19,fontWeight:700,color:NAVY}}>{s.name}</span>
                <span style={{marginInlineStart:'auto',display:'inline-flex',alignItems:'center',gap:6,background:'#e3f6ea',color:'#1e9e5a',borderRadius:999,padding:'5px 12px',fontSize:12,fontWeight:700}}><span style={{width:7,height:7,borderRadius:999,background:'#1e9e5a'}}></span>סריקה פעילה</span>
              </div>
              <div style={{color:'#4b5f72',fontSize:14,lineHeight:1.6,marginBottom:16}}>{s.desc}</div>
              <a href={s.url} target="_blank" rel="noopener noreferrer" style={{display:'inline-block',background:NAVY,color:'#fff',textDecoration:'none',borderRadius:10,padding:'10px 20px',fontSize:13,fontWeight:600}}>מעבר למקור ↗</a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
