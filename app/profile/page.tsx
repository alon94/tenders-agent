"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import SiteNav from "../components/SiteNav";

const NAVY="#0b2e52",BLUE="#2e86de",MUTED="#64778a";
const RBK="Rubik,'Assistant',Arial,sans-serif";

const BIZ=[
  {id:'consulting',label:'ייעוץ וניהול',icon:'💼'},
  {id:'tech',label:'טכנולוגיה ותוכנה',icon:'💻'},
  {id:'marketing',label:'שיווק ופרסום',icon:'📣'},
  {id:'construction',label:'בינוי ותשתיות',icon:'🏗️'},
  {id:'legal',label:'משפט וחשבונאות',icon:'⚖️'},
  {id:'education',label:'חינוך והדרכה',icon:'📚'},
  {id:'security',label:'אבטחה ושמירה',icon:'🔒'},
  {id:'cleaning',label:'ניקיון ותחזוקה',icon:'🧹'},
  {id:'catering',label:'קייטרינג ומזון',icon:'🍽️'},
  {id:'transport',label:'הסעות ולוגיסטיקה',icon:'🚌'},
  {id:'health',label:'בריאות ורפואה',icon:'🏥'},
  {id:'environment',label:'איכות סביבה',icon:'🌿'},
];
const REGS=[
  {id:'all',label:'כל הארץ'},{id:'national',label:'ארצי / ממשלתי'},{id:'north',label:'צפון'},{id:'haifa',label:'חיפה'},
  {id:'center',label:'מרכז'},{id:'tlv',label:'תל אביב'},{id:'south',label:'דרום'},{id:'jerusalem',label:'ירושלים'},
];
const PUBS=[
  {id:'all',label:'כל המפרסמים'},{id:'gov',label:'משרדי ממשלה'},{id:'local',label:'רשויות מקומיות'},
  {id:'health',label:'מערכת הבריאות'},{id:'edu',label:'מוסדות חינוך'},{id:'infra',label:'חברות ממשלתיות'},
];

const selStyle={padding:'11px 14px',paddingLeft:34,borderRadius:12,border:'1px solid #e2ecf6',background:'#f2f7fc',color:'#33475b',fontSize:14,width:'100%',maxWidth:300,appearance:'none' as const,WebkitAppearance:'none' as const,fontFamily:'inherit'};

export default function ProfilePage(){
  const router=useRouter();
  const[biz,setBiz]=useState('');
  const[reg,setReg]=useState('all');
  const[pub,setPub]=useState('all');
  const[saved,setSaved]=useState(false);

  const save=()=>{
    localStorage.setItem('businessProfile',JSON.stringify({businessType:biz,region:reg,publisherType:pub}));
    setSaved(true);
    setTimeout(()=>router.push('/dashboard'),1000);
  };

  return(
    <div style={{minHeight:'100vh',background:'#e9f3fc',fontFamily:"'Assistant',Arial,sans-serif",direction:'rtl',color:NAVY}}>
      <SiteNav active="/profile"/>
      <div style={{maxWidth:720,margin:'0 auto',padding:'28px 16px 40px'}}>
        <h1 style={{fontFamily:RBK,fontSize:26,fontWeight:800,color:NAVY,marginBottom:6}}>הגדרת פרופיל עסקי</h1>
        <div style={{color:MUTED,fontSize:14,marginBottom:22}}>הפרופיל קובע אילו מכרזים יותאמו ויוצגו לכם</div>

        <div style={{background:'#fff',borderRadius:20,padding:24,marginBottom:16,boxShadow:'0 10px 28px rgba(11,46,82,.05)'}}>
          <h2 style={{margin:'0 0 6px',fontFamily:RBK,fontSize:17,fontWeight:700,color:NAVY}}>🎯 סוג העסק שלי</h2>
          <p style={{margin:'0 0 16px',fontSize:13,color:MUTED}}>בחרו קטגוריה — היא תקבע אילו מכרזים יוצגו לכם</p>
          <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
            {BIZ.map(bt=>{const on=biz===bt.id;return(
              <button key={bt.id} onClick={()=>setBiz(on?'':bt.id)} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 18px',borderRadius:999,border:on?`2px solid ${BLUE}`:'2px solid #e2ecf6',background:on?BLUE:'#fff',color:on?'#fff':'#33475b',cursor:'pointer',fontSize:14.5,fontWeight:on?700:500}}>
                <span style={{fontSize:19}}>{bt.icon}</span><span>{bt.label}</span>
              </button>
            );})}
          </div>
          {!biz&&<p style={{margin:'14px 0 0',color:'#b78a18',fontSize:13}}>⚠️ לא נבחר סוג עסק — יוצגו כל המכרזים</p>}
          {biz&&<p style={{margin:'14px 0 0',color:'#1e9e5a',fontSize:13,fontWeight:600}}>✅ נבחר: {BIZ.find(b=>b.id===biz)?.label}</p>}
        </div>

        <div style={{background:'#fff',borderRadius:20,padding:22,marginBottom:16,boxShadow:'0 10px 28px rgba(11,46,82,.05)'}}>
          <h2 style={{margin:'0 0 12px',fontFamily:RBK,fontSize:15,fontWeight:700,color:NAVY}}>🗺️ אזור גאוגרפי (פילטר משני)</h2>
          <div style={{position:'relative',display:'inline-block',width:'100%',maxWidth:300}}>
            <select value={reg} onChange={e=>setReg(e.target.value)} style={selStyle}>
              {REGS.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:11,color:'#9fb2c6',pointerEvents:'none'}}>▾</span>
          </div>
        </div>

        <div style={{background:'#fff',borderRadius:20,padding:22,marginBottom:24,boxShadow:'0 10px 28px rgba(11,46,82,.05)'}}>
          <h2 style={{margin:'0 0 12px',fontFamily:RBK,fontSize:15,fontWeight:700,color:NAVY}}>🏛️ סוג מפרסם (פילטר משני)</h2>
          <div style={{position:'relative',display:'inline-block',width:'100%',maxWidth:300}}>
            <select value={pub} onChange={e=>setPub(e.target.value)} style={selStyle}>
              {PUBS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:11,color:'#9fb2c6',pointerEvents:'none'}}>▾</span>
          </div>
        </div>

        <button onClick={save} style={{width:'100%',padding:16,borderRadius:14,border:'none',background:saved?'#1e9e5a':NAVY,color:'#fff',fontSize:16,fontWeight:700,cursor:'pointer',fontFamily:RBK}}>
          {saved?'✅ נשמר! מעביר לדשבורד...':'💾 שמירת פרופיל ומעבר לדשבורד'}
        </button>
      </div>
    </div>
  );
}
