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
function mBiz(t:T,id:string){if(!id)return true;const b=BIZ.find(x=>x.id===id);if(!b||!('kw' in b))return true;const s=(t.title+' '+(t.publisher||'')).toLowerCase();return(b as any).kw.some((k:string)=>s.includes(k.toLowerCase()));}
function mPub(t:T,id:string){if(!id)return true;const p=PUBS.find(x=>x.id===id);if(!p||!('kw' in p))return true;return(p as any).kw.some((k:string)=>(t.publisher||'').toLowerCase().includes(k.toLowerCase()));}
function sc(s:string){if(s==='פורסם')return{bg:'#dcfce7',color:'#16a34a'};if(s==='בעדכון')return{bg:'#fef9c3',color:'#ca8a04'};if(s?.includes('סגור')||s?.includes('נסגר'))return{bg:'#fee2e2',color:'#dc2626'};return{bg:'#f3f4f6',color:'#6b7280'};}
function dc(d:number){if(d<=7)return{bg:'#fee2e2',color:'#dc2626'};if(d<=30)return{bg:'#fef9c3',color:'#ca8a04'};return{bg:'#f0fdf4',color:'#16a34a'};}
function matchSc(biz:string,t:{title:string,publisher:string}):number{if(!biz)return 55+Math.floor((t.title.length%3)*10);const b=BIZ.find(b=>b.id===biz);if(!b||!(b as any).kw)return 55;const h=(t.title+' '+t.publisher).toLowerCase();const hits=(b as any).kw.filter((k:string)=>h.includes(k.toLowerCase())).length;return Math.min(95,50+hits*15);}
function rec(score:number,days:number|null):{label:string,color:string,bg:string}{if(days!==null&&days<0)return{label:'פג תוקף',color:'#6b7280',bg:'#f3f4f6'};if(score>=80)return{label:'מומלץ להגיש',color:'#15803d',bg:'#dcfce7'};if(score>=65)return{label:'בדיקה לפני החלטה',color:'#92400e',bg:'#fef3c7'};return{label:'לעיון ומידע',color:'#1e40af',bg:'#dbeafe'};}

export default function Dashboard(){
  const[all,setAll]=useState<T[]>([]);
  const[loading,setLoading]=useState(true);
  const[biz,setBiz]=useState('');
  const[pub,setPub]=useState('');
  const[maxD,setMaxD]=useState(365);
  const[showClosed,setShowClosed]=useState(false);
  const[showNoDate,setShowNoDate]=useState(true);
  const[tab,setTab]=useState<'all'|'closing'|'new'>('all');
  const[q,setQ]=useState('');
  const[pg,setPg]=useState(1);
  const PER=25;
  const now=useMemo(()=>Date.now(),[]);

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

  const base=useMemo(()=>{
    let r=all;
    if(biz)r=r.filter(t=>mBiz(t,biz));
    if(pub)r=r.filter(t=>mPub(t,pub));
    if(!showClosed)r=r.filter(t=>{const d=dl(t.deadline);return d===null||d>=0;});
    if(!showNoDate)r=r.filter(t=>!!t.deadline);
    r=r.filter(t=>{const d=dl(t.deadline);if(d===null)return showNoDate;return d>=0&&d<=maxD;});
    if(q.trim()){const ql=q.toLowerCase();r=r.filter(t=>(t.title||'').toLowerCase().includes(ql)||(t.publisher||'').toLowerCase().includes(ql));}
    return r;
  },[all,biz,pub,maxD,showClosed,showNoDate,q]);

  const closing=useMemo(()=>base.filter(t=>{const d=dl(t.deadline);return d!==null&&d>=0&&d<=7;}),[base]);
  const newT=useMemo(()=>base.filter(t=>{if(!t.publishDate)return false;return new Date(t.publishDate).getTime()>(now-7*86400000);}),[base,now]);
  const shown=useMemo(()=>{
    const r=tab==='closing'?closing:tab==='new'?newT:base;
    return [...r].sort((a,b)=>(dl(a.deadline)??9999)-(dl(b.deadline)??9999));
  },[base,closing,newT,tab]);

  const tp=Math.ceil(shown.length/PER);
  const rows=shown.slice((pg-1)*PER,pg*PER);

  return(
    <div style={{minHeight:'100vh',background:'#f0f4f8',fontFamily:'Heebo,Arial,sans-serif',direction:'rtl'}}>
      {/* NAV */}
      <nav style={{background:'linear-gradient(90deg,#1a56a0,#2d8ef5)',color:'white',padding:'0 16px',display:'flex',alignItems:'center',height:50,boxShadow:'0 2px 6px rgba(0,0,0,0.2)',gap:0}}>
        <span style={{fontWeight:900,fontSize:19,marginLeft:12,whiteSpace:'nowrap'}}>שווה מכרזים</span>
        <span style={{background:'rgba(255,255,255,0.18)',borderRadius:4,padding:'1px 7px',fontSize:10,marginLeft:20,whiteSpace:'nowrap'}}>מודל בטון שווה ביזנס 360</span>
        {['גילוי מכרזים','הגשות שלי','תהראות','ערבויות וליווי','AgentOS','מקורות'].map((n,i)=>(
          <span key={n} style={{padding:'0 12px',fontSize:13,cursor:'pointer',height:50,display:'flex',alignItems:'center',borderBottom:i===0?'3px solid white':'3px solid transparent',color:i===0?'white':'rgba(255,255,255,0.8)',whiteSpace:'nowrap'}}>{n}</span>
        ))}
        <span style={{marginRight:'auto',width:28,height:28,borderRadius:'50%',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700}}>א</span>
      </nav>

      {/* STATUS BAR */}
      <div style={{background:'white',borderBottom:'1px solid #e5e7eb',padding:'5px 16px',display:'flex',alignItems:'center',gap:12,fontSize:12,color:'#6b7280'}}>
        <span style={{width:7,height:7,borderRadius:'50%',background:'#22c55e',display:'inline-block',flexShrink:0}}></span>
        <span>סריקה מוטמעת: <strong style={{color:'#111'}}>{all.length.toLocaleString()}</strong> מכרזים · מקור: <a href="https://data.gov.il" target="_blank" rel="noopener noreferrer" style={{color:'#2563eb',textDecoration:'none'}}>data.gov.il</a></span>
        <span style={{marginRight:'auto'}}>עודכן: {new Date().toLocaleTimeString('he-IL')}</span>
        <button onClick={load} style={{background:'#2563eb',color:'white',border:'none',borderRadius:6,padding:'3px 12px',cursor:'pointer',fontSize:12,fontWeight:600}}>רענון</button>
      </div>

      <div style={{display:'flex',maxWidth:1500,margin:'0 auto',padding:'14px 16px',gap:14}}>

        {/* SIDEBAR */}
        <aside style={{width:230,flexShrink:0}}>
          <div style={{background:'white',borderRadius:10,padding:'14px',boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,paddingBottom:8,borderBottom:'1px solid #f0f0f0'}}>
              <strong style={{fontSize:13,color:'#374151'}}>סינון | איפוס</strong>
              <span onClick={()=>{setBiz('');setPub('');setMaxD(365);setShowClosed(false);setShowNoDate(true);setQ('');setPg(1);}} style={{color:'#2563eb',cursor:'pointer',fontSize:12}}>✕</span>
            </div>

            <div style={{marginBottom:12}}>
              <label style={{display:'block',fontSize:11,color:'#6b7280',marginBottom:4}}>תחום עיסוק</label>
              <div style={{position:'relative'}}>
                <select value={biz} onChange={e=>{setBiz(e.target.value);setPg(1);}} style={{width:'100%',padding:'7px 10px',paddingLeft:24,borderRadius:7,border:'1px solid #d1d5db',fontSize:12,appearance:'none',background:'white',color:'#374151'}}>
                  {BIZ.map(b=><option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
                <span style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',fontSize:9,color:'#9ca3af',pointerEvents:'none'}}>▼</span>
              </div>
            </div>

            <div style={{marginBottom:12}}>
              <label style={{display:'block',fontSize:11,color:'#6b7280',marginBottom:4}}>גוף מפרסם</label>
              <div style={{position:'relative'}}>
                <select value={pub} onChange={e=>{setPub(e.target.value);setPg(1);}} style={{width:'100%',padding:'7px 10px',paddingLeft:24,borderRadius:7,border:'1px solid #d1d5db',fontSize:12,appearance:'none',background:'white',color:'#374151'}}>
                  {PUBS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <span style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',fontSize:9,color:'#9ca3af',pointerEvents:'none'}}>▼</span>
              </div>
            </div>

            <div style={{marginBottom:4}}>
              <label style={{display:'block',fontSize:11,color:'#6b7280',marginBottom:6}}>נסגר בתוך</label>
              <input type="range" min={7} max={365} value={maxD} onChange={e=>{setMaxD(Number(e.target.value));setPg(1);}} style={{width:'100%',accentColor:'#1a56a0'}}/>
              <div style={{textAlign:'center',fontSize:11,color:'#374151',marginTop:2}}>עד {maxD} ימים</div>
            </div>

            <div style={{marginTop:10,marginBottom:10}}>
              <label style={{display:'flex',alignItems:'center',gap:7,fontSize:11,color:'#374151',marginBottom:6,cursor:'pointer'}}>
                <input type="checkbox" checked={showClosed} onChange={e=>setShowClosed(e.target.checked)} style={{accentColor:'#1a56a0'}}/>
                הצג גם מכרזים שנסגרו
              </label>
              <label style={{display:'flex',alignItems:'center',gap:7,fontSize:11,color:'#374151',cursor:'pointer'}}>
                <input type="checkbox" checked={showNoDate} onChange={e=>setShowNoDate(e.target.checked)} style={{accentColor:'#1a56a0'}}/>
                הצג גם ללא מועד אחרון
              </label>
            </div>

            <a href="/profile" style={{display:'block',width:'100%',padding:'9px',borderRadius:8,background:'linear-gradient(90deg,#1a56a0,#2d8ef5)',color:'white',border:'none',cursor:'pointer',fontSize:13,fontWeight:700,textAlign:'center',textDecoration:'none',boxSizing:'border-box'}}>
              ◀ הסוכן החכם
            </a>
          </div>
        </aside>

        {/* MAIN */}
        <main style={{flex:1,minWidth:0}}>
          {/* STAT CARDS */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:12}}>
            {[
              {label:'מוצגים כעת',value:base.length,color:'#f97316'},
              {label:'חדשים ב-7 ימים אחרונים',value:newT.length,color:'#3b82f6'},
              {label:'נסגרים בשבוע הקרוב',value:closing.length,color:'#ef4444'},
              {label:'מכרזים פעילים במאגר',value:all.length,color:'#111827'},
            ].map(c=>(
              <div key={c.label} style={{background:'white',borderRadius:10,padding:'14px 12px',textAlign:'center',boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
                <div style={{fontSize:30,fontWeight:800,color:c.color,lineHeight:1.1}}>{loading?'…':c.value.toLocaleString()}</div>
                <div style={{fontSize:11,color:'#6b7280',marginTop:5,lineHeight:1.3}}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* SEARCH + TABS */}
          <div style={{background:'white',borderRadius:10,padding:'10px 14px',marginBottom:10,boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              <button style={{background:'#1a56a0',color:'white',border:'none',borderRadius:8,padding:'7px 16px',fontSize:13,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>חיפוש</button>
              <div style={{flex:1,position:'relative'}}>
                <input value={q} onChange={e=>{setQ(e.target.value);setPg(1);}} placeholder="חיפוש חופשי: נושא, גוף מפרסם, מספר מכרז..." style={{width:'100%',padding:'7px 34px 7px 10px',borderRadius:8,border:'1px solid #d1d5db',fontSize:12,boxSizing:'border-box'}}/>
                <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#9ca3af',fontSize:14}}>🔍</span>
              </div>
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {[{k:'all',label:'כל המכרזים',n:base.length},{k:'closing',label:'נסגרים בשבוע',n:closing.length},{k:'new',label:'חדשים השבוע',n:newT.length}].map(tb=>(
                <button key={tb.k} onClick={()=>{setTab(tb.k as any);setPg(1);}} style={{padding:'5px 13px',borderRadius:20,fontSize:12,cursor:'pointer',border:'none',fontWeight:tab===tb.k?700:400,background:tab===tb.k?'#1a56a0':'#f3f4f6',color:tab===tb.k?'white':'#374151',display:'flex',alignItems:'center',gap:4}}>
                  {tab===tb.k&&'☰ '}{tb.k==='closing'&&tab!==tb.k&&'🔴 '}{tb.k==='new'&&tab!==tb.k&&'✨ '}{tb.label} ({tb.n})
                </button>
              ))}
              {biz&&<button onClick={()=>{setBiz('');setPg(1);}} style={{padding:'5px 13px',borderRadius:20,fontSize:12,cursor:'pointer',border:'none',background:'#eff6ff',color:'#1d4ed8'}}>💼 {BIZ.find(b=>b.id===biz)?.label} ✕</button>}
            </div>
          </div>

          {/* ROWS */}
          {loading?(
            <div style={{textAlign:'center',padding:50,background:'white',borderRadius:10,boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
              <div style={{fontSize:34}}>⏳</div>
              <div style={{color:'#6b7280',marginTop:8,fontSize:14}}>טוען מכרזים מ-4 מקורות...</div>
            </div>
          ):(
            <>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {rows.map((t,i)=>{
                  const d=dl(t.deadline);
                  const stc=sc(t.status);
              const score=matchSc(biz,t);const recommendation=rec(score,d);
                  const urgent=d!==null&&d<=7&&d>=0;
                  const soon=d!==null&&d<=30&&d>7;
                  return(
                    <div key={t.id||i} style={{background:'white',borderRadius:10,padding:'12px 14px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',borderRight:`4px solid ${urgent?'#ef4444':soon?'#f97316':'#e5e7eb'}`}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',gap:5,marginBottom:6,flexWrap:'wrap',alignItems:'center'}}>
                            <span style={{background:'#dbeafe',color:'#1d4ed8',borderRadius:4,padding:'2px 7px',fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>{t.publisher||'לא ידוע'}</span>
                            <span style={{background:stc.bg,color:stc.color,borderRadius:4,padding:'2px 7px',fontSize:11,fontWeight:600}}>{t.status||'—'}</span>
                            {urgent&&<span style={{background:'#fee2e2',color:'#dc2626',borderRadius:4,padding:'2px 7px',fontSize:11,fontWeight:700}}>🔴 נסגר בקרוב</span>}
                            {recommendation&&<span style={{background:recommendation.bg,color:recommendation.color,borderRadius:4,padding:'2px 7px',fontSize:11,fontWeight:600}}>{recommendation.label}</span>}
                          </div>
                          {t.url
                            ?<a href={t.url} target="_blank" rel="noopener noreferrer" style={{color:'#111827',textDecoration:'none',fontWeight:700,fontSize:14,lineHeight:1.4,display:'block'}}>{t.title||'ללא כותרת'}</a>
                            :<span style={{fontWeight:700,fontSize:14,color:'#111827',lineHeight:1.4,display:'block'}}>{t.title||'ללא כותרת'}</span>}
                        </div>
                        
                        <div style={{display:'flex',flexDirection:'column',gap:3,alignItems:'flex-end',flexShrink:0,fontSize:12}}>
                          <div style={{color:'#6b7280'}}>📅 פורסם: {fd(t.publishDate)}</div>
                          <div style={{fontWeight:600,color:urgent?'#dc2626':'#374151'}}>
                            🕐 הגשה עד: <span style={{color:urgent?'#dc2626':soon?'#ca8a04':'#374151'}}>{fd(t.deadline)}</span>
                            {d!==null&&d>=0&&(
                              <span style={{marginRight:5,padding:'2px 7px',borderRadius:10,fontSize:11,fontWeight:700,background:dc(d).bg,color:dc(d).color}}>({d} ימים)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {tp>1&&(
                <div style={{display:'flex',gap:6,justifyContent:'center',marginTop:12,flexWrap:'wrap'}}>
                  <button onClick={()=>setPg(1)} disabled={pg===1} style={{padding:'5px 11px',borderRadius:6,border:'1px solid #d1d5db',background:pg===1?'#f3f4f6':'white',cursor:pg===1?'default':'pointer',fontSize:12}}>ראשון</button>
                  <button onClick={()=>setPg(p=>Math.max(1,p-1))} disabled={pg===1} style={{padding:'5px 11px',borderRadius:6,border:'1px solid #d1d5db',background:pg===1?'#f3f4f6':'white',cursor:pg===1?'default':'pointer',fontSize:12}}>◀</button>
                  {Array.from({length:Math.min(7,tp)},(_,i)=>{let p=pg-3+i;if(p<1)p=i+1;if(p>tp)p=tp-(6-i);if(p<1||p>tp)return null;return<button key={p} onClick={()=>setPg(p)} style={{padding:'5px 10px',borderRadius:6,border:'1px solid',borderColor:p===pg?'#1a56a0':'#d1d5db',background:p===pg?'#1a56a0':'white',color:p===pg?'white':'#374151',cursor:'pointer',fontWeight:p===pg?700:400,fontSize:12}}>{p}</button>;})}
                  <button onClick={()=>setPg(p=>Math.min(tp,p+1))} disabled={pg===tp} style={{padding:'5px 11px',borderRadius:6,border:'1px solid #d1d5db',background:pg===tp?'#f3f4f6':'white',cursor:pg===tp?'default':'pointer',fontSize:12}}>▶</button>
                  <button onClick={()=>setPg(tp)} disabled={pg===tp} style={{padding:'5px 11px',borderRadius:6,border:'1px solid #d1d5db',background:pg===tp?'#f3f4f6':'white',cursor:pg===tp?'default':'pointer',fontSize:12}}>אחרון</button>
                </div>
              )}
              <div style={{textAlign:'center',padding:'12px 0',color:'#9ca3af',fontSize:11}}>
                נתונים: <a href="https://next.obudget.org" target="_blank" rel="noopener noreferrer" style={{color:'#2563eb'}}>BudgetKey</a> · מינהל הרכש הממשלתי · עדכון יומי ב-06:00
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
