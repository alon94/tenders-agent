"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
  {id:'all',label:'כל הארץ'},
  {id:'national',label:'ארצי / ממשלתי'},
  {id:'north',label:'צפון'},
  {id:'haifa',label:'חיפה'},
  {id:'center',label:'מרכז'},
  {id:'tlv',label:'תל אביב'},
  {id:'south',label:'דרום'},
  {id:'jerusalem',label:'ירושלים'},
];
const PUBS=[
  {id:'all',label:'כל המפרסמים'},
  {id:'gov',label:'משרדי ממשלה'},
  {id:'local',label:'רשויות מקומיות'},
  {id:'health',label:'מערכת הבריאות'},
  {id:'edu',label:'מוסדות חינוך'},
  {id:'infra',label:'חברות ממשלתיות'},
];

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
    <div style={{minHeight:'100vh',background:'#f0f4f8',fontFamily:'Heebo,Arial,sans-serif',direction:'rtl'}}>
      <header style={{background:'linear-gradient(135deg,#1a3c6e,#2563eb)',color:'white',padding:'16px 24px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontSize:22,fontWeight:900}}>שווה מכרזים — הגדרת פרופיל</span>
        <a href="/dashboard" style={{color:'white',textDecoration:'none',fontSize:14,opacity:0.85}}>← חזרה לדשבורד</a>
      </header>
      <div style={{maxWidth:700,margin:'0 auto',padding:'24px 16px'}}>

        <div style={{background:'white',borderRadius:12,padding:'24px',marginBottom:16,boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
          <h2 style={{margin:'0 0 6px',fontSize:17,fontWeight:700,color:'#1a3c6e'}}>🎯 סוג העסק שלי</h2>
          <p style={{margin:'0 0 16px',fontSize:13,color:'#6b7280'}}>בחר קטגוריה — היא תקבע אילו מכרזים יוצגו לך</p>
          <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
            {BIZ.map(bt=>{const on=biz===bt.id;return(
              <button key={bt.id} onClick={()=>setBiz(on?'':bt.id)} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 18px',borderRadius:10,border:on?'2px solid #2563eb':'2px solid #e5e7eb',background:on?'#2563eb':'white',color:on?'white':'#374151',cursor:'pointer',fontSize:15,fontWeight:on?700:400}}>
                <span style={{fontSize:20}}>{bt.icon}</span><span>{bt.label}</span>
              </button>
            );})}
          </div>
          {!biz&&<p style={{margin:'12px 0 0',color:'#f59e0b',fontSize:13}}>⚠️ לא נבחר סוג עסק — יוצגו כל המכרזים</p>}
          {biz&&<p style={{margin:'12px 0 0',color:'#16a34a',fontSize:13,fontWeight:600}}>✅ נבחר: {BIZ.find(b=>b.id===biz)?.label}</p>}
        </div>

        <div style={{background:'white',borderRadius:12,padding:'20px',marginBottom:16,boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
          <h2 style={{margin:'0 0 12px',fontSize:15,fontWeight:700,color:'#1a3c6e'}}>🗺️ אזור גאוגרפי (פילטר משני)</h2>
          <select value={reg} onChange={e=>setReg(e.target.value)} style={{padding:'10px 14px',borderRadius:8,border:'1px solid #d1d5db',fontSize:14,width:'100%',maxWidth:280}}>
            {REGS.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>

        <div style={{background:'white',borderRadius:12,padding:'20px',marginBottom:24,boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
          <h2 style={{margin:'0 0 12px',fontSize:15,fontWeight:700,color:'#1a3c6e'}}>🏛️ סוג מפרסם (פילטר משני)</h2>
          <select value={pub} onChange={e=>setPub(e.target.value)} style={{padding:'10px 14px',borderRadius:8,border:'1px solid #d1d5db',fontSize:14,width:'100%',maxWidth:280}}>
            {PUBS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>

        <button onClick={save} style={{width:'100%',padding:'16px',borderRadius:10,border:'none',background:saved?'#16a34a':'#2563eb',color:'white',fontSize:17,fontWeight:700,cursor:'pointer'}}>
          {saved?'✅ נשמר! מעביר לדשבורד...':'💾 שמור פרופיל ועבור לדשבורד'}
        </button>
      </div>
    </div>
  );
}
