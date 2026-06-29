"use client";
import { useState, useEffect, useMemo, useCallback } from "react";

const BIZ=[
  {id:'',label:'כל התחומים'},
  {id:'consulting',label:'ייעוץ וניהול',kw:['ייעוץ','יעוץ','ניהול','אסטרטגיה','הדרכה','ניהול פרויקט']},
  {id:'tech',label:'טכנולוגיה',kw:['תוכנה','מחשוב','טכנולוגיה','פיתוח','סייבר','IT','AI','ענן','מערכת מידע']},
  {id:'marketing',label:'שיווק ופרסום',kw:['שיווק','פרסום','קמפיין','יחסי ציבור','מדיה','תוכן','SEO']},
  {id:'construction',label:'בינוי ותשתיות',kw:['בינוי','בנייה','תשתיות','קבלן','שיפוץ','ביוב','מים','כבישים','אדריכל']},
  {id:'legal',label:'משפט וחשבונאות',kw:['משפטי','עורך דין','חשבונאות','רואה חשבון','ביקורת','ציות','חוזה']},
  {id:'education',label:'חינוך והדרכה',kw:['חינוך','הדרכה','הכשרה','קורס','מורה','מרצה','בית ספר']},
  {id:'security',label:'אבטחה ושמירה',kw:['אבטחה','שמירה','שומר','מאבטח','סיור','בטיחות']},
  {id:'cleaning',label:'ניקיון ותחזוקה',kw:['ניקיון','תחזוקה','חיטוי','הדברה','גינון']},
  {id:'catering',label:'קייטרינג ומזון',kw:['קייטרינג','אוכל','מזון','ספק מזון','ארוחה']},
  {id:'transport',label:'הסעות ולוגיסטיקה',kw:['הסעות','תחבורה','לוגיסטיקה','הובלה','שינוע']},
  {id:'health',label:'בריאות ורפואה',kw:['בריאות','רפואה','סיעוד','אחות','רופא','שיקום','מרפאה']},
  {id:'environment',label:'איכות סביבה',kw:['סביבה','אקולוגי','ירוק','פסולת','מחזור','זיהום']},
];

const PUBS=[
  {id:'',label:'כל הגופים'},
  {id:'gov',label:'משרדי ממשלה',kw:['משרד','רשות','מינהל','אגף','ממשלת']},
  {id:'local',label:'רשויות מקומיות',kw:['עיריית','עירייה','מועצה','מועצת']},
  {id:'health',label:'מערכת הבריאות',kw:['בית חולים','קופת חולים','מאוחדת','לאומית','כללית','מדא','הדסה']},
  {id:'edu',label:'מוסדות חינוך',kw:['אוניברסיטה','מכללה','בית ספר']},
  {id:'infra',label:'חברות ממשלתיות',kw:['חברת חשמל','מקורות','נמלים','רכבת','נתיבי']},
];

interface T{id:string;title:string;publisher:string;publishDate:string;deadline:string;status:string;url:string;type:string;}

function dl(d:string):number|null{if(!d)return null;const x=new Date(d);return isNaN(x.getTime())?null:Math.ceil((x.getTime()-Date.now())/86400000);}
function fd(d:string){if(!d)return'—';try{return new Date(d).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'});}catch{return d;}}
function matchBiz(t:T,id:string){if(!id)return true;const b=BIZ.find(x=>x.id===id);if(!b||!('kw' in b))return true;const s=(t.title+' '+(t.publisher||'')).toLowerCase();return (b as any).kw.some((k:string)=>s.includes(k.toLowerCase()));}
function matchPub(t:T,id:string){if(!id)return true;const p=PUBS.find(x=>x.id===id);if(!p||!('kw' in p))return true;return (p as any).kw.some((k:string)=>(t.publisher||'').toLowerCase().includes(k.toLowerCase()));}

export default function Dashboard(){
  const[all,setAll]=useState<T[]>([]);
  const[loading,setLoading]=useState(true);
  const[biz,setBiz]=useState('');
  const[pub,setPub]=useState('');
  const[maxD,setMaxD]=useState(90);
  const[showClosed,setShowClosed]=useState(false);
  const[showNoDate,setShowNoDate]=useState(false);
  const[tab,setTab]=useState<'all'|'closing'|'new'>('all');
  const[q,setQ]=useState('');
  const[pg,setPg]=useState(1);
  const PER=25;

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const rs=await Promise.all([0,1000,2000,3000].map(o=>fetch('/api/tenders?offset='+o).then(r=>r.json()).catch(()=>({tenders:[]}))));
      const seen=new Set<string>();const arr:T[]=[];
      for(const r of rs)for(const t of(r.tenders||[])){const k=t.id||t.publication_id||(t.title+t.publishDate);if(!seen.has(k)){seen.add(k);arr.push(t);}}
      setAll(arr);
    }finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);

  const now = useMemo(()=>Date.now(),[]);
  const oneWeekAgo = now - 7*86400000;

  const base=useMemo(()=>{
    let r=all;
    if(biz)r=r.filter(t=>matchBiz(t,biz));
    if(pub)r=r.filter(t=>matchPub(t,pub));
    if(!showClosed)r=r.filter(t=>{const d=dl(t.deadline);return d===null||d>=0;});
    if(!showNoDate)r=r.filter(t=>t.deadline);
    r=r.filter(t=>{const d=dl(t.deadline);return d===null||(d>=0&&d<=maxD);});
    if(q.trim()){const ql=q.toLowerCase();r=r.filter(t=>(t.title||'').toLowerCase().includes(ql)||(t.publisher||'').toLowerCase().includes(ql));}
    return r;
  },[all,biz,pub,maxD,showClosed,showNoDate,q]);

  const closing=useMemo(()=>base.filter(t=>{const d=dl(t.deadline);return d!==null&&d>=0&&d<=7;}),[base]);
  const newThis=useMemo(()=>base.filter(t=>{if(!t.publishDate)return false;return new Date(t.publishDate).getTime()>oneWeekAgo;}),[base,oneWeekAgo]);

  const shown=useMemo(()=>{
    let r=tab==='closing'?closing:tab==='new'?newThis:base;
    return r.sort((a,b)=>(dl(a.deadline)??9999)-(dl(b.deadline)??9999));
  },[base,closing,newThis,tab]);

  const tp=Math.ceil(shown.length/PER);
  const rows=shown.slice((pg-1)*PER,pg*PER);

  function statusColor(s:string):{bg:string,color:string}{
    if(s==='פורסם')return{bg:'#dcfce7',color:'#16a34a'};
    if(s==='בעדכון')return{bg:'#fef9c3',color:'#ca8a04'};
    if(s?.includes('סגור')||s?.includes('נסגר'))return{bg:'#fee2e2',color:'#dc2626'};
    return{bg:'#f3f4f6',color:'#6b7280'};
  }
  function daysColor(d:number):{bg:string,color:string}{
    if(d<=7)return{bg:'#fee2e2',color:'#dc2626'};
    if(d<=30)return{bg:'#fef9c3',color:'#ca8a04'};
    return{bg:'#f0fdf4',color:'#16a34a'};
  }

  return(
    <div style={{minHeight:'100vh',background:'#f5f6fa',fontFamily:'Heebo,Arial,sans-serif',direction:'rtl'}}>

      {/* TOP NAV */}
      <nav style={{background:'linear-gradient(90deg,#1e6fcc,#2d8ef5)',color:'white',padding:'0 20px',display:'flex',alignItems:'center',gap:0,height:52,boxShadow:'0 2px 8px rgba(0,0,0,0.2)'}}>
        <span style={{fontWeight:900,fontSize:20,marginLeft:24,whiteSpace:'nowrap'}}>שווה מכרזים</span>
        <span style={{background:'rgba(255,255,255,0.2)',borderRadius:4,padding:'2px 8px',fontSize:11,marginLeft:16}}>מודל בטון שווה ביזנס 360</span>
        {['גילוי מכרזים','הגשות שלי','תהראות','ערבויות וליווי','AgentOS','מקורות'].map(n=>(
          <span key={n} style={{padding:'0 14px',fontSize:14,cursor:'pointer',height:52,display:'flex',alignItems:'center',borderBottom:n==='גילוי מכרזים'?'3px solid white':'3px solid transparent',color:n==='גילוי מכרזים'?'white':'rgba(255,255,255,0.8)'}}>{n}</span>
        ))}
        <span style={{marginRight:'auto',fontSize:13,opacity:0.8}}>א</span>
      </nav>

      {/* STATUS BAR */}
      <div style={{background:'white',borderBottom:'1px solid #e5e7eb',padding:'6px 20px',display:'flex',alignItems:'center',gap:16,fontSize:12,color:'#6b7280'}}>
        <span style={{width:8,height:8,borderRadius:'50%',background:'#22c55e',display:'inline-block'}}></span>
        <span>סריקה מוטמעת: <strong>{all.length.toLocaleString()}</strong> מכרזים · מקור: <span style={{color:'#2563eb'}}>data.gov.il</span></span>
        <span style={{marginRight:'auto'}}>עודכן: {new Date().toLocaleTimeString('he-IL')}</span>
        <button onClick={load} style={{background:'#2563eb',color:'white',border:'none',borderRadius:6,padding:'4px 12px',cursor:'pointer',fontSize:12}}>רענון</button>
      </div>

      <div style={{display:'flex',maxWidth:1500,margin:'0 auto',padding:'16px',gap:16}}>

        {/* SIDEBAR */}
        <aside style={{width:240,flexShrink:0}}>
          <div style={{background:'white',borderRadius:10,padding:'16px',boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <strong style={{fontSize:14}}>סינון | איפוס</strong>
              <span onClick={()=>{setBiz('');setPub('');setMaxD(90);setShowClosed(false);setShowNoDate(false);setQ('');}} style={{color:'#2563eb',cursor:'pointer',fontSize:12}}>✕</span>
            </div>

            <label style={{display:'block',fontSize:12,color:'#6b7280',marginBottom:4}}>תחום עיסוק</label>
            <div style={{position:'relative',marginBottom:14}}>
              <select value={biz} onChange={e=>{setBiz(e.target.value);setPg(1);}} style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid #d1d5db',fontSize:13,appearance:'none',background:'white'}}>
                {BIZ.map(b=><option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
              <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',fontSize:10}}>▼</span>
            </div>

            <label style={{display:'block',fontSize:12,color:'#6b7280',marginBottom:4}}>גוף מפרסם</label>
            <div style={{position:'relative',marginBottom:14}}>
              <select value={pub} onChange={e=>{setPub(e.target.value);setPg(1);}} style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid #d1d5db',fontSize:13,appearance:'none',background:'white'}}>
                {PUBS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',fontSize:10}}>▼</span>
            </div>

            <label style={{display:'block',fontSize:12,color:'#6b7280',marginBottom:6}}>נסגר בתוך</label>
            <input type="range" min={7} max={365} value={maxD} onChange={e=>{setMaxD(Number(e.target.value));setPg(1);}} style={{width:'100%',accentColor:'#1e6fcc',marginBottom:4}}/>
            <div style={{textAlign:'center',fontSize:12,color:'#374151',marginBottom:12}}>עד {maxD} ימים</div>

            <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#374151',marginBottom:8,cursor:'pointer'}}>
              <input type="checkbox" checked={showClosed} onChange={e=>setShowClosed(e.target.checked)} style={{accentColor:'#1e6fcc'}}/>
              הצג גם מכרזים שנסגרו
            </label>
            <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#374151',marginBottom:16,cursor:'pointer'}}>
              <input type="checkbox" checked={showNoDate} onChange={e=>setShowNoDate(e.target.checked)} style={{accentColor:'#1e6fcc'}}/>
              הצג גם ללא מועד אחרון
            </label>

            <a href="/profile" style={{display:'block',width:'100%',padding:'10px',borderRadius:8,background:'linear-gradient(90deg,#1e6fcc,#2d8ef5)',color:'white',border:'none',cursor:'pointer',fontSize:14,fontWeight:700,textAlign:'center',textDecoration:'none',boxSizing:'border-box'}}>
              ◀ הסוכן החכם
            </a>
          </div>
        </aside>

        {/* MAIN */}
        <main style={{flex:1,minWidth:0}}>

          {/* STAT CARDS */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
            {[
              {label:'מוצגים כעת',value:base.length,color:'#f97316'},
              {label:'חדשים ב-7 ימים אחרונים',value:newThis.length,color:'#3b82f6'},
              {label:'נסגרים בשבוע הקרוב',value:closing.length,color:'#ef4444'},
              {label:'מכרזים פעילים במאגר',value:all.length,color:'#111827'},
            ].map(c=>(
              <div key={c.label} style={{background:'white',borderRadius:10,padding:'16px',textAlign:'center',boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
                <div style={{fontSize:32,fontWeight:800,color:c.color,lineHeight:1}}>{c.value.toLocaleString()}</div>
                <div style={{fontSize:12,color:'#6b7280',marginTop:6}}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* SEARCH + TABS */}
          <div style={{background:'white',borderRadius:10,padding:'12px 16px',marginBottom:12,boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
            <div style={{display:'flex',gap:10,marginBottom:12}}>
              <button style={{background:'#1e6fcc',color:'white',border:'none',borderRadius:8,padding:'8px 18px',fontSize:14,fontWeight:700,cursor:'pointer'}}>חיפוש</button>
              <div style={{flex:1,position:'relative'}}>
                <input value={q} onChange={e=>{setQ(e.target.value);setPg(1);}} placeholder="חיפוש חופשי: נושא, גוף מפרסם, מספר מכרז..." style={{width:'100%',padding:'8px 36px 8px 12px',borderRadius:8,border:'1px solid #d1d5db',fontSize:13,boxSizing:'border-box'}}/>
                <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#9ca3af'}}>🔍</span>
              </div>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {[
                {key:'all',label:'כל המכרזים',count:base.length},
                {key:'closing',label:'נסגרים בשבוע',count:closing.length},
                {key:'new',label:'חדשים השבוע',count:newThis.length},
              ].map(tb=>(
                <button key={tb.key} onClick={()=>{setTab(tb.key as any);setPg(1);}} style={{padding:'6px 14px',borderRadius:20,fontSize:13,cursor:'pointer',border:'none',fontWeight:tab===tb.key?700:400,background:tab===tb.key?'#1e6fcc':'#f3f4f6',color:tab===tb.key?'white':'#374151'}}>
                  {tab===tb.key?'☰ ':tb.key==='closing'?'🔴 ':tb.key==='new'?'✨ ':''}{tb.label} ({tb.count})
                </button>
              ))}
              {biz&&<button onClick={()=>setBiz('')} style={{padding:'6px 14px',borderRadius:20,fontSize:13,cursor:'pointer',border:'none',background:'#eff6ff',color:'#1d4ed8'}}>💼 {BIZ.find(b=>b.id===biz)?.label} ✕</button>}
            </div>
          </div>

          {/* TENDER ROWS */}
          {loading?(
            <div style={{textAlign:'center',padding:60,background:'white',borderRadius:10}}><div style={{fontSize:36}}>⏳</div><div style={{color:'#6b7280',marginTop:8}}>טוען מכרזים...</div></div>
          ):(
            <>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {rows.map((t,i)=>{
                  const d=dl(t.deadline);
                  const sc=statusColor(t.status);
                  const dc=d!==null&&d>=0?daysColor(d):{bg:'#f3f4f6',color:'#6b7280'};
                  return(
                    <div key={t.id||i} style={{background:'white',borderRadius:10,padding:'14px 16px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',borderRight:'4px solid'+(d!==null&&d<=7?'#ef4444':d!==null&&d<=30?'#f97316':'#e5e7eb')}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                        <div style={{flex:1}}>
                          <div style={{display:'flex',gap:6,marginBottom:6,flexWrap:'wrap'}}>
                            <span style={{background:'#dbeafe',color:'#1d4ed8',borderRadius:4,padding:'2px 8px',fontSize:11,fontWeight:600}}>{t.publisher||'לא ידוע'}</span>
                            <span style={{background:sc.bg,color:sc.color,borderRadius:4,padding:'2px 8px',fontSize:11,fontWeight:600}}>{t.status||'—'}</span>
                            {t.type&&<span style={{background:'#f3f4f6',color:'#6b7280',borderRadius:4,padding:'2px 8px',fontSize:11}}>{t.type}</span>}
                          </div>
                          {t.url
                            ?<a href={t.url} target="_blank" rel="noopener noreferrer" style={{color:'#111827',textDecoration:'none',fontWeight:700,fontSize:15,lineHeight:1.4,display:'block'}}>{t.title||'ללא כותרת'}</a>
                            :<span style={{fontWeight:700,fontSize:15,color:'#111827'}}>{t.title||'ללא כותרת'}</span>}
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end',flexShrink:0}}>
                          <div style={{fontSize:12,color:'#6b7280'}}>📅 פורסם: {fd(t.publishDate)}</div>
                          <div style={{fontSize:12,fontWeight:600,color:d!==null&&d<=7?'#dc2626':'#374151'}}>
                            🕐 הגשה עד: {fd(t.deadline)}
                            {d!==null&&d>=0&&<span style={{marginRight:6,padding:'2px 8px',borderRadius:10,fontSize:11,fontWeight:700,background:dc.bg,color:dc.color}}>({d} ימים)</span>}
                            {d!==null&&d<0&&<span style={{marginRight:6,padding:'2px 8px',borderRadius:10,fontSize:11,background:'#f3f4f6',color:'#9ca3af'}}>(נסגר)</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {tp>1&&<div style={{display:'flex',gap:8,justifyContent:'center',marginTop:16}}>
                <button onClick={()=>setPg(1)} disabled={pg===1} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #d1d5db',background:pg===1?'#f3f4f6':'white',cursor:pg===1?'default':'pointer'}}>ראשון</button>
                <button onClick={()=>setPg(p=>Math.max(1,p-1))} disabled={pg===1} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #d1d5db',background:pg===1?'#f3f4f6':'white',cursor:pg===1?'default':'pointer'}}>◀</button>
                {Array.from({length:Math.min(5,tp)},(_,i)=>{let p=pg-2+i;if(p<1)p=i+1;if(p>tp)p=tp-(4-i);if(p<1||p>tp)return null;return<button key={p} onClick={()=>setPg(p)} style={{padding:'6px 12px',borderRadius:6,border:'1px solid',borderColor:p===pg?'#1e6fcc':'#d1d5db',background:p===pg?'#1e6fcc':'white',color:p===pg?'white':'#374151',cursor:'pointer',fontWeight:p===pg?700:400}}>{p}</button>;})}
                <button onClick={()=>setPg(p=>Math.min(tp,p+1))} disabled={pg===tp} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #d1d5db',background:pg===tp?'#f3f4f6':'white',cursor:pg===tp?'default':'pointer'}}>▶</button>
                <button onClick={()=>setPg(tp)} disabled={pg===tp} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #d1d5db',background:pg===tp?'#f3f4f6':'white',cursor:pg===tp?'default':'pointer'}}>אחרון</button>
              </div>}

              <div style={{textAlign:'center',padding:'16px 0',color:'#9ca3af',fontSize:12}}>
                נתונים: <a href="https://next.obudget.org" target="_blank" rel="noopener noreferrer" style={{color:'#2563eb'}}>BudgetKey</a> · מינהל הרכש הממשלתי
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
