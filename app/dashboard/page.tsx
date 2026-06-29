"use client";
import { useState, useEffect, useMemo, useCallback } from "react";

const BIZ=[
  {id:'consulting',label:'ייעוץ וניהול',icon:'💼',kw:['ייעוץ','יעוץ','ניהול','אסטרטגיה','הדרכה','הכשרה','ניהול פרויקט']},
  {id:'tech',label:'טכנולוגיה ותוכנה',icon:'💻',kw:['תוכנה','מערכת מידע','מחשוב','טכנולוגיה','אפליקציה','פיתוח','סייבר','אבטחת מידע','ענן','AI','IT']},
  {id:'marketing',label:'שיווק ופרסום',icon:'📣',kw:['שיווק','פרסום','קמפיין','יחסי ציבור','מדיה','תקשורת','מיתוג','תוכן','SEO','אתר']},
  {id:'construction',label:'בינוי ותשתיות',icon:'🏗️',kw:['בינוי','בנייה','תשתיות','קבלן','שיפוץ','ביוב','מים','כבישים','אדריכל','מהנדס']},
  {id:'legal',label:'משפט וחשבונאות',icon:'⚖️',kw:['משפטי','עורך דין','ייעוץ משפטי','חשבונאות','רואה חשבון','ביקורת','ציות','חוזה']},
  {id:'education',label:'חינוך והדרכה',icon:'📚',kw:['חינוך','הדרכה','הכשרה','קורס','תוכנית לימודים','מורה','מרצה','אקדמי','בית ספר']},
  {id:'security',label:'אבטחה ושמירה',icon:'🔒',kw:['אבטחה','שמירה','שומר','מאבטח','סיור','פיקוח','בטיחות','כיבוי אש']},
  {id:'cleaning',label:'ניקיון ותחזוקה',icon:'🧹',kw:['ניקיון','תחזוקה','חיטוי','הדברה','גינון','גנן','פינוי אשפה']},
  {id:'catering',label:'קייטרינג ומזון',icon:'🍽️',kw:['קייטרינג','אוכל','מזון','בישול','ספק מזון','ארוחה','קפטריה']},
  {id:'transport',label:'הסעות ולוגיסטיקה',icon:'🚌',kw:['הסעות','תחבורה','לוגיסטיקה','הובלה','משלוחים','אוטובוס','שינוע']},
  {id:'health',label:'בריאות ורפואה',icon:'🏥',kw:['בריאות','רפואה','רפואי','סיעוד','אחות','רופא','שיקום','בית חולים','מרפאה']},
  {id:'environment',label:'איכות סביבה',icon:'🌿',kw:['סביבה','אקולוגי','ירוק','אנרגיה מתחדשת','פסולת','מחזור','זיהום','ניטור']},
];
const REGS=[
  {id:'all',label:'כל האזורים',kw:[]},
  {id:'national',label:'ארצי / ממשלתי',kw:['משרד','רשות','מינהל','אגף','ממשלת','ממשלה']},
  {id:'north',label:'צפון',kw:['גליל','צפון','נצרת','עכו','כרמיאל','טבריה','צפת']},
  {id:'haifa',label:'חיפה',kw:['חיפה','כרמל','נשר','טירת','קריית','זכרון']},
  {id:'center',label:'מרכז',kw:['פתח תקוה','ראשון','רחובות','כפר סבא','נתניה','הרצליה','רמת גן','בני ברק','מודיעין','לוד','רמלה']},
  {id:'tlv',label:'תל אביב',kw:['תל אביב','יפו','תל-אביב']},
  {id:'south',label:'דרום',kw:['דרום','באר שבע','אשדוד','אשקלון','אילת','נגב']},
  {id:'jerusalem',label:'ירושלים',kw:['ירושלים','בית שמש','מעלה אדומים']},
];
const PUBS=[
  {id:'all',label:'כל המפרסמים',kw:[]},
  {id:'gov',label:'משרדי ממשלה',kw:['משרד','רשות','מינהל','אגף','ממשלת']},
  {id:'local',label:'רשויות מקומיות',kw:['עיריית','עירייה','מועצה','מועצת','ועד מקומי']},
  {id:'health',label:'מערכת הבריאות',kw:['בית חולים','קופת חולים','מאוחדת','לאומית','כללית','מדא','הדסה']},
  {id:'edu',label:'מוסדות חינוך',kw:['אוניברסיטה','מכללה','בית ספר','מוסד']},
  {id:'infra',label:'חברות ממשלתיות',kw:['חברת חשמל','מקורות','נמלים','רכבת','נתיבי']},
];

interface T{publication_id:string;tender_id:string;publisher:string;description:string;start_date:string;end_date:string;claim_date:string;page_url:string;}

function mBiz(t:T,id:string){if(!id)return true;const b=BIZ.find(x=>x.id===id);if(!b)return true;const s=((t.title||t.description||'')+(t.publisher||'')).toLowerCase();return b.kw.some(k=>s.includes(k.toLowerCase()));}
function mReg(t:T,id:string){if(id==='all')return true;const r=REGS.find(x=>x.id===id);if(!r||!r.kw.length)return true;const s=((t.publisher||'')+(t.title||t.description||'')).toLowerCase();return r.kw.some(k=>s.includes(k.toLowerCase()));}
function mPub(t:T,id:string){if(id==='all')return true;const p=PUBS.find(x=>x.id===id);if(!p||!p.kw.length)return true;return p.kw.some(k=>(t.publisher||'').toLowerCase().includes(k.toLowerCase()));}
function dl(d:string):number|null{if(!d)return null;const x=new Date(d);return isNaN(x.getTime())?null:Math.ceil((x.getTime()-Date.now())/86400000);}
function fd(d:string){if(!d)return'—';try{return new Date(d).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'});}catch{return d;}}

export default function Dashboard(){
  const[all,setAll]=useState<T[]>([]);
  const[loading,setLoading]=useState(true);
  const[msg,setMsg]=useState('טוען...');
  const[err,setErr]=useState<string|null>(null);
  const[biz,setBiz]=useState('');
  const[reg,setReg]=useState('all');
  const[pub,setPub]=useState('all');
  const[maxD,setMaxD]=useState(180);
  const[q,setQ]=useState('');
  const[pg,setPg]=useState(1);
  const PER=25;

  useEffect(()=>{try{const s=localStorage.getItem('businessProfile');if(s){const p=JSON.parse(s);if(p.businessType)setBiz(p.businessType);if(p.region)setReg(p.region);if(p.publisherType)setPub(p.publisherType);}}catch{}},[]);

  const load=useCallback(async()=>{
    setLoading(true);setErr(null);setMsg('מוריד מכרזים...');
    try{
      const rs=await Promise.all([0,1000,2000,3000].map(o=>fetch('/api/tenders?offset='+o).then(r=>r.json()).catch(()=>({tenders:[]}))));
      const seen=new Set<string>();const arr:T[]=[];
      for(const r of rs)for(const t of(r.tenders||[])){const k=t.publication_id||t.tender_id||(t.title||t.description+t.publishDate||t.start_date);if(!seen.has(k)){seen.add(k);arr.push(t);}}
      setAll(arr);
    }catch{setErr('שגיאה בטעינה');}finally{setLoading(false);}
  },[]);

  useEffect(()=>{load();},[load]);

  const fil=useMemo(()=>{
    let r=all;
    if(biz)r=r.filter(t=>mBiz(t,biz));
    if(reg!=='all')r=r.filter(t=>mReg(t,reg));
    if(pub!=='all')r=r.filter(t=>mPub(t,pub));
    r=r.filter(t=>{const d=dl(t.deadline||t.end_date||t.claim_date);return d===null||(d>=0&&d<=maxD);});
    if(q.trim()){const ql=q.toLowerCase();r=r.filter(t=>(t.title||t.description||'').toLowerCase().includes(ql)||(t.publisher||'').toLowerCase().includes(ql));}
    return r.sort((a,b)=>(dl(a.end_date||a.claim_date)??9999)-(dl(b.end_date||b.claim_date)??9999));
  },[all,biz,reg,pub,maxD,q]);

  const tp=Math.ceil(fil.length/PER);
  const rows=fil.slice((pg-1)*PER,pg*PER);
  const urg=fil.filter(t=>{const d=dl(t.deadline||t.end_date||t.claim_date);return d!==null&&d<=7;}).length;
  const bl=BIZ.find(b=>b.id===biz)?.label||'';

  return(
    <div style={{minHeight:'100vh',background:'#f0f4f8',fontFamily:'Heebo,Arial,sans-serif',direction:'rtl'}}>
      <header style={{background:'linear-gradient(135deg,#1a3c6e,#2563eb)',color:'white',boxShadow:'0 2px 8px rgba(0,0,0,0.3)'}}>
        <div style={{maxWidth:1400,margin:'0 auto',padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:28,fontWeight:900}}>שווה מכרזים</span>
            <span style={{background:'rgba(255,255,255,0.15)',borderRadius:6,padding:'2px 10px',fontSize:13}}>BETA</span>
          </div>
          <div style={{display:'flex',gap:10}}>
            <a href="/profile" style={{background:'rgba(255,255,255,0.15)',color:'white',border:'1px solid rgba(255,255,255,0.3)',borderRadius:8,padding:'6px 16px',textDecoration:'none',fontSize:14}}>✏️ פרופיל</a>
            <button onClick={load} style={{background:'rgba(255,255,255,0.15)',color:'white',border:'1px solid rgba(255,255,255,0.3)',borderRadius:8,padding:'6px 16px',fontSize:14,cursor:'pointer'}}>🔄 רענן</button>
          </div>
        </div>
        <div style={{background:'rgba(0,0,0,0.2)',padding:'8px 20px'}}>
          <div style={{maxWidth:1400,margin:'0 auto',display:'flex',gap:24,fontSize:13}}>
            <span>📋 סה"כ: <strong>{all.length.toLocaleString()}</strong></span>
            {biz&&<span>🎯 תואמים: <strong>{fil.length.toLocaleString()}</strong></span>}
            {urg>0&&<span style={{color:'#fbbf24'}}>⚠️ נסגרים השבוע: <strong>{urg}</strong></span>}
            <span style={{marginRight:'auto',color:'rgba(255,255,255,0.7)'}}>עדכון ב-06:00</span>
          </div>
        </div>
      </header>

      <div style={{maxWidth:1400,margin:'0 auto',padding:'20px'}}>

        <div style={{background:'white',borderRadius:12,padding:'20px',marginBottom:16,boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <h2 style={{margin:0,fontSize:16,fontWeight:700,color:'#1a3c6e'}}>1️⃣ סוג עסק — פילטר ראשי</h2>
            {biz&&<button onClick={()=>{setBiz('');setPg(1);}} style={{background:'#fee2e2',color:'#dc2626',border:'none',borderRadius:6,padding:'4px 12px',cursor:'pointer',fontSize:13}}>✕ הצג הכל</button>}
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {BIZ.map(bt=>{const on=biz===bt.id;return(
              <button key={bt.id} onClick={()=>{setBiz(on?'':bt.id);setPg(1);}} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:8,border:on?'2px solid #2563eb':'2px solid #e5e7eb',background:on?'#2563eb':'white',color:on?'white':'#374151',cursor:'pointer',fontSize:14,fontWeight:on?700:400}}>
                <span>{bt.icon}</span><span>{bt.label}</span>
              </button>
            );})}
          </div>
          <p style={{margin:'10px 0 0',fontSize:13,color:biz?'#2563eb':'#6b7280',fontWeight:biz?600:400}}>
            {biz?`✅ ${fil.length.toLocaleString()} מכרזים — ${bl}`:`מוצגים כל ${all.length.toLocaleString()} המכרזים — בחר סוג עסק לסינון`}
          </p>
        </div>

        <div style={{background:'white',borderRadius:12,padding:'14px 20px',marginBottom:16,boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
          <h2 style={{margin:'0 0 10px',fontSize:14,fontWeight:700,color:'#374151'}}>2️⃣ פילטרים משניים</h2>
          <div style={{display:'flex',flexWrap:'wrap',gap:14,alignItems:'flex-end'}}>
            <div style={{flex:'1 1 190px'}}>
              <label style={{display:'block',fontSize:12,color:'#6b7280',marginBottom:4}}>חיפוש חופשי</label>
              <input value={q} onChange={e=>{setQ(e.target.value);setPg(1);}} placeholder="מילת מפתח..." style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid #d1d5db',fontSize:14,boxSizing:'border-box'}}/>
            </div>
            <div style={{flex:'1 1 140px'}}>
              <label style={{display:'block',fontSize:12,color:'#6b7280',marginBottom:4}}>אזור</label>
              <select value={reg} onChange={e=>{setReg(e.target.value);setPg(1);}} style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid #d1d5db',fontSize:14}}>
                {REGS.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div style={{flex:'1 1 150px'}}>
              <label style={{display:'block',fontSize:12,color:'#6b7280',marginBottom:4}}>מפרסם</label>
              <select value={pub} onChange={e=>{setPub(e.target.value);setPg(1);}} style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid #d1d5db',fontSize:14}}>
                {PUBS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div style={{flex:'1 1 170px'}}>
              <label style={{display:'block',fontSize:12,color:'#6b7280',marginBottom:4}}>עד {maxD} ימים</label>
              <input type="range" min={7} max={365} value={maxD} onChange={e=>{setMaxD(Number(e.target.value));setPg(1);}} style={{width:'100%'}}/>
            </div>
            <button onClick={()=>{setReg('all');setPub('all');setMaxD(180);setQ('');setPg(1);}} style={{padding:'8px 14px',borderRadius:8,border:'1px solid #d1d5db',background:'#f9fafb',cursor:'pointer',fontSize:13,color:'#6b7280'}}>איפוס</button>
          </div>
        </div>

        {loading?(
          <div style={{textAlign:'center',padding:60,background:'white',borderRadius:12}}>
            <div style={{fontSize:36,marginBottom:12}}>⏳</div>
            <div style={{color:'#6b7280'}}>{msg}</div>
          </div>
        ):err?(
          <div style={{textAlign:'center',padding:60,background:'white',borderRadius:12,color:'#dc2626'}}>{err}</div>
        ):fil.length===0?(
          <div style={{textAlign:'center',padding:60,background:'white',borderRadius:12}}>
            <div style={{fontSize:36,marginBottom:8}}>🔍</div>
            <div style={{color:'#6b7280'}}>לא נמצאו מכרזים — נסה להרחיב פילטרים</div>
          </div>
        ):(
          <>
            {urg>0&&<div style={{background:'#fef3c7',border:'1px solid #f59e0b',borderRadius:10,padding:'10px 16px',marginBottom:12,display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:18}}>🚨</span><span style={{color:'#92400e',fontWeight:600,fontSize:14}}>{urg} מכרז{urg>1?'ים':''} נסגר{urg>1?'ים':''} תוך 7 ימים!</span></div>}
            <div style={{background:'white',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
              <div style={{padding:'10px 16px',borderBottom:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontWeight:700,color:'#374151',fontSize:14}}>{fil.length.toLocaleString()} תוצאות{biz?` — ${bl}`:''}</span>
                <span style={{color:'#9ca3af',fontSize:13}}>עמוד {pg}/{tp}</span>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:'#f8fafc',borderBottom:'2px solid #e5e7eb'}}>
                    <th style={{padding:'10px 16px',textAlign:'right',fontWeight:700,color:'#374151'}}>כותרת המכרז</th>
                    <th style={{padding:'10px 12px',textAlign:'right',fontWeight:700,color:'#374151',width:150}}>מפרסם</th>
                    <th style={{padding:'10px 12px',textAlign:'center',fontWeight:700,color:'#374151',width:105}}>פרסום</th>
                    <th style={{padding:'10px 12px',textAlign:'center',fontWeight:700,color:'#374151',width:105}}>מועד אחרון</th>
                    <th style={{padding:'10px 12px',textAlign:'center',fontWeight:700,color:'#374151',width:85}}>ימים</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t,i)=>{
                    const d=dl(t.deadline||t.end_date||t.claim_date);
                    const u=d!==null&&d<=7;const s=d!==null&&d<=30&&d>7;
                    return(
                      <tr key={t.id||i} style={{borderBottom:'1px solid #f0f0f0',background:u?'#fff7ed':i%2===0?'white':'#fafafa'}}>
                        <td style={{padding:'10px 16px'}}>{t.url||t.page_url?<a href={t.url||t.page_url} target="_blank" rel="noopener noreferrer" style={{color:'#1d4ed8',textDecoration:'none',fontWeight:500,lineHeight:1.4}}>{t.title||t.description||'ללא כותרת'}</a>:<span style={{lineHeight:1.4}}>{t.title||t.description||'ללא כותרת'}</span>}</td>
                        <td style={{padding:'10px 12px',color:'#6b7280',fontSize:12}}>{t.publisher||'—'}</td>
                        <td style={{padding:'10px 12px',textAlign:'center',color:'#6b7280'}}>{fd(t.publishDate||t.start_date)}</td>
                        <td style={{padding:'10px 12px',textAlign:'center',color:u?'#dc2626':'#374151',fontWeight:u?700:400}}>{fd(t.deadline||t.end_date||t.claim_date)}</td>
                        <td style={{padding:'10px 12px',textAlign:'center'}}>{d===null?'—':<span style={{padding:'3px 8px',borderRadius:12,fontSize:12,fontWeight:700,background:u?'#fee2e2':s?'#fef3c7':'#f0fdf4',color:u?'#dc2626':s?'#92400e':'#166534'}}>{d===0?'היום!':`${d} ימים`}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {tp>1&&<div style={{padding:'12px 16px',borderTop:'1px solid #e5e7eb',display:'flex',gap:8,justifyContent:'center'}}>
                <button onClick={()=>setPg(1)} disabled={pg===1} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #d1d5db',background:pg===1?'#f3f4f6':'white',cursor:pg===1?'default':'pointer'}}>ראשון</button>
                <button onClick={()=>setPg(p=>Math.max(1,p-1))} disabled={pg===1} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #d1d5db',background:pg===1?'#f3f4f6':'white',cursor:pg===1?'default':'pointer'}}>◀</button>
                {Array.from({length:Math.min(5,tp)},(_,i)=>{let p=pg-2+i;if(p<1)p=i+1;if(p>tp)p=tp-(4-i);if(p<1||p>tp)return null;return<button key={p} onClick={()=>setPg(p)} style={{padding:'6px 12px',borderRadius:6,border:'1px solid',borderColor:p===pg?'#2563eb':'#d1d5db',background:p===pg?'#2563eb':'white',color:p===pg?'white':'#374151',cursor:'pointer',fontWeight:p===pg?700:400}}>{p}</button>;})}
                <button onClick={()=>setPg(p=>Math.min(tp,p+1))} disabled={pg===tp} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #d1d5db',background:pg===tp?'#f3f4f6':'white',cursor:pg===tp?'default':'pointer'}}>▶</button>
                <button onClick={()=>setPg(tp)} disabled={pg===tp} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #d1d5db',background:pg===tp?'#f3f4f6':'white',cursor:pg===tp?'default':'pointer'}}>אחרון</button>
              </div>}
            </div>
          </>
        )}
        <footer style={{textAlign:'center',padding:'20px 0',color:'#9ca3af',fontSize:12}}>
          נתונים: <a href="https://next.obudget.org" target="_blank" rel="noopener noreferrer" style={{color:'#2563eb'}}>BudgetKey</a> · מינהל הרכש הממשלתי
        </footer>
      </div>
    </div>
  );
}
