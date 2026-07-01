"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import SiteNav from "../components/SiteNav";

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
function sc(s:string){if(s==='פורסם')return{bg:'#e3f6ea',color:'#1e9e5a'};if(s==='בעדכון')return{bg:'#fcf2d0',color:'#b78a18'};if(s?.includes('סגור')||s?.includes('נסגר'))return{bg:'#fde6e6',color:'#e0463c'};return{bg:'#eef2f7',color:'#64778a'};}
function matchSc(biz:string,t:{title:string,publisher:string}):number{if(!biz)return 55+Math.floor((t.title.length%3)*10);const b=BIZ.find(b=>b.id===biz);if(!b||!(b as any).kw)return 55;const h=(t.title+' '+t.publisher).toLowerCase();const hits=(b as any).kw.filter((k:string)=>h.includes(k.toLowerCase())).length;return Math.min(95,50+hits*15);}
function rec(score:number,days:number|null):{label:string,color:string,bg:string}{if(days!==null&&days<0)return{label:'פג תוקף',color:'#64778a',bg:'#eef2f7'};if(score>=80)return{label:'מומלץ להגיש',color:'#1e9e5a',bg:'#e3f6ea'};if(score>=65)return{label:'בדיקה לפני החלטה',color:'#b78a18',bg:'#fcf2d0'};return{label:'לעיון ומידע',color:'#1f73c4',bg:'#e1effb'};}
function scoreStyle(score:number){if(score>=80)return{bg:'#e3f6ea',fg:'#1e9e5a'};if(score>=65)return{bg:'#fcf2d0',fg:'#b78a18'};return{bg:'#e1effb',fg:'#1f73c4'};}

// Design tokens (עיצוב 1a)
const RBK="Rubik, 'Assistant', Arial, sans-serif";
const NAVY='#0b2e52', BLUE='#2e86de', PURPLE='#7c5cf0', RED='#e0463c', ORANGE='#f0932b', MUTED='#64778a';

export default function Dashboard(){
  const [marked,setMarked]=useState<string[]>([]);
  useEffect(()=>{
    // טעינת פונטים Rubik + Assistant (עיצוב 1a)
    const id='ws-fonts';
    if(!document.getElementById(id)){
      const l=document.createElement('link');l.id=id;l.rel='stylesheet';
      l.href='https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&family=Assistant:wght@400;500;600;700&display=swap';
      document.head.appendChild(l);
    }
    try{const m=JSON.parse(localStorage.getItem('markedTenders')||'[]');if(Array.isArray(m))setMarked(m);}catch(e){}
  },[]);
  const toggleMark=useCallback((id:string,e?:any)=>{if(e){e.preventDefault();e.stopPropagation();}setMarked(prev=>{const has=prev.includes(id);const next=has?prev.filter(x=>x!==id):[...prev,id];try{localStorage.setItem('markedTenders',JSON.stringify(next));}catch(err){}return next;});},[]);
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

  const fieldStyle={width:'100%',padding:'11px 14px',borderRadius:12,border:'1px solid #e2ecf6',fontSize:14,appearance:'none' as const,WebkitAppearance:'none' as const,background:'#f2f7fc',color:'#33475b',boxSizing:'border-box' as const};

  return(
    <div style={{minHeight:'100vh',background:'#e9f3fc',fontFamily:"'Assistant', Arial, sans-serif",direction:'rtl',color:NAVY}}>

      <SiteNav
        active="/dashboard"
        onRefresh={load}
        search={
          <div style={{flex:1,display:'flex',alignItems:'center',gap:12,background:'#f2f7fc',border:'1px solid #e2ecf6',borderRadius:999,padding:'8px 22px'}}>
            <span style={{color:'#9fb2c6',fontSize:19}}>⌕</span>
            <input value={q} onChange={e=>{setQ(e.target.value);setPg(1);}} placeholder="חיפוש חופשי: נושא, גוף מפרסם, מספר מכרז…" style={{flex:1,border:'none',outline:'none',background:'transparent',fontSize:15,color:'#33475b',fontFamily:'inherit'}}/>
            <a href="/agent" style={{display:'inline-flex',alignItems:'center',gap:6,background:'#fff',border:'1.5px solid #c9b8f7',color:PURPLE,fontWeight:700,fontSize:13,padding:'5px 14px',borderRadius:999,textDecoration:'none',whiteSpace:'nowrap'}}>✦ תובנות AI</a>
          </div>
        }
        tagline={<>סריקה מותאמת · <strong style={{color:NAVY}}>{all.length.toLocaleString()}</strong> מכרזים · מקור <a href="https://data.gov.il" target="_blank" rel="noopener noreferrer" style={{color:BLUE,textDecoration:'none'}}>data.gov.il</a> · עודכן {new Date().toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</>}
      />

      {/* ===== BODY ===== */}
      <div style={{padding:'28px 32px 36px',display:'flex',gap:24,maxWidth:1500,margin:'0 auto',alignItems:'flex-start'}}>

        {/* MAIN */}
        <div style={{flex:1,minWidth:0}}>
          {/* KPIs */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:22}}>
            {[
              {label:'מכרזים פעילים במאגר',value:all.length,color:NAVY},
              {label:'נסגרים בשבוע הקרוב',value:closing.length,color:RED},
              {label:'חדשים ב-7 ימים אחרונים',value:newT.length,color:BLUE},
              {label:'מוצגים כעת',value:base.length,color:ORANGE},
            ].map(c=>(
              <div key={c.label} style={{background:'#fff',borderRadius:20,padding:'20px 22px',boxShadow:'0 10px 28px rgba(11,46,82,.05)'}}>
                <div style={{fontFamily:RBK,fontSize:40,fontWeight:800,color:c.color,lineHeight:1}}>{loading?'…':c.value.toLocaleString()}</div>
                <div style={{fontSize:13.5,color:MUTED,marginTop:8,fontWeight:600}}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* FILTER TABS */}
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20,flexWrap:'wrap'}}>
            {[{k:'all',label:'כל המכרזים',n:base.length,c:NAVY},{k:'closing',label:'נסגרים בשבוע',n:closing.length,c:RED},{k:'new',label:'חדשים השבוע',n:newT.length,c:PURPLE}].map(tb=>{
              const active=tab===tb.k;
              return(
                <button key={tb.k} onClick={()=>{setTab(tb.k as any);setPg(1);}} style={{
                  fontFamily:tb.k==='all'?RBK:'inherit',fontWeight:600,fontSize:14,padding:'11px 18px',borderRadius:999,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:8,
                  background:active?(tb.k==='all'?NAVY:'#fff'):'#fff',
                  color:active?(tb.k==='all'?'#fff':tb.c):tb.c,
                  border:active&&tb.k==='all'?'none':`1px solid ${tb.k==='closing'?'#f5dada':tb.k==='new'?'#e4dcfb':'#e2ecf6'}`
                }}>
                  {active&&tb.k==='all'&&'☰ '}
                  {tb.k==='closing'&&<span style={{width:8,height:8,borderRadius:999,background:RED}}></span>}
                  {tb.k==='new'&&'✦ '}
                  {tb.label} ({tb.n})
                </button>
              );
            })}
            {biz&&<button onClick={()=>{setBiz('');setPg(1);}} style={{fontWeight:600,fontSize:14,padding:'11px 16px',borderRadius:999,cursor:'pointer',border:'1px solid #cfe0f4',background:'#e8f1fb',color:'#1e5aa8'}}>💼 {BIZ.find(b=>b.id===biz)?.label} ✕</button>}
          </div>

          {/* ROWS */}
          {loading?(
            <div style={{textAlign:'center',padding:60,background:'#fff',borderRadius:20,boxShadow:'0 10px 28px rgba(11,46,82,.05)'}}>
              <div style={{fontSize:34}}>⏳</div>
              <div style={{color:MUTED,marginTop:8,fontSize:15}}>טוען מכרזים מ-4 מקורות...</div>
            </div>
          ):(
            <>
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                {rows.map((t,i)=>{
                  const d=dl(t.deadline);
                  const stc=sc(t.status);
                  const score=matchSc(biz,t);const recommendation=rec(score,d);const ss=scoreStyle(score);
                  const urgent=d!==null&&d<=7&&d>=0;
                  const soon=d!==null&&d<=30&&d>7;
                  const urgentColor=urgent?RED:soon?ORANGE:'#1e9e5a';
                  const isMarked=marked.includes(t.id);
                  return(
                    <div key={t.id||i} style={{background:'#fff',borderRadius:20,padding:'20px 22px',boxShadow:'0 10px 28px rgba(11,46,82,.05)',display:'flex',gap:20,alignItems:'flex-start',borderInlineEnd:`4px solid ${urgentColor}`}}>
                      <div style={{flex:1,minWidth:0,textAlign:'right'}}>
                        <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'flex-end',marginBottom:12}}>
                          {recommendation&&<span style={{fontSize:12.5,fontWeight:700,padding:'5px 12px',borderRadius:999,background:recommendation.bg,color:recommendation.color}}>{recommendation.label}</span>}
                          {urgent&&<span style={{fontSize:12.5,fontWeight:700,padding:'5px 12px',borderRadius:999,background:'#fde6e6',color:RED,display:'inline-flex',alignItems:'center',gap:6}}><span style={{width:7,height:7,borderRadius:999,background:RED}}></span>נסגר בקרוב</span>}
                          <span style={{fontSize:12.5,fontWeight:700,padding:'5px 12px',borderRadius:999,background:stc.bg,color:stc.color}}>{t.status||'—'}</span>
                          <span style={{fontSize:12.5,fontWeight:700,padding:'5px 12px',borderRadius:999,background:'#e1effb',color:'#1f73c4'}}>{t.publisher||'לא ידוע'}</span>
                        </div>
                        {t.url
                          ?<a href={`/tender/${t.id}`} style={{fontFamily:RBK,fontSize:19,fontWeight:600,color:NAVY,lineHeight:1.4,textDecoration:'none',display:'block'}}>{t.title||'ללא כותרת'}</a>
                          :<span style={{fontFamily:RBK,fontSize:19,fontWeight:600,color:NAVY,lineHeight:1.4,display:'block'}}>{t.title||'ללא כותרת'}</span>}
                        <div style={{display:'flex',gap:22,marginTop:14,fontSize:13,color:MUTED,flexWrap:'wrap'}}>
                          <span>📅 פורסם: <b style={{color:'#33475b'}}>{fd(t.publishDate)}</b></span>
                          <span style={{color:urgent?RED:'#33475b'}}>⏱ הגשה עד: <b>{fd(t.deadline)}</b>{d!==null&&d>=0&&<> ({d} ימים)</>}</span>
                        </div>
                      </div>
                      <div style={{flex:'0 0 auto',display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                        <div style={{width:58,height:58,borderRadius:999,background:ss.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                          <span style={{fontFamily:RBK,fontSize:22,fontWeight:800,color:ss.fg,lineHeight:1}}>{score}</span>
                          <span style={{fontSize:9,color:ss.fg,opacity:.75}}>ציון</span>
                        </div>
                        <button onClick={(e)=>toggleMark(t.id,e)} title={isMarked?'הסר סימון':'סמן מכרז'} style={{fontSize:12,fontWeight:700,color:isMarked?'#b78a18':PURPLE,background:isMarked?'#fcf2d0':'#f3effe',padding:'5px 12px',borderRadius:999,whiteSpace:'nowrap',border:'none',cursor:'pointer'}}>{isMarked?'★ שמור':'☆ שמירה'}</button>
                      </div>
                    </div>
                  );
                })}
                {rows.length===0&&<div style={{textAlign:'center',padding:50,background:'#fff',borderRadius:20,boxShadow:'0 10px 28px rgba(11,46,82,.05)',color:MUTED,fontSize:15}}>לא נמצאו מכרזים התואמים לסינון</div>}
              </div>

              {tp>1&&(
                <div style={{display:'flex',gap:6,justifyContent:'center',marginTop:20,flexWrap:'wrap'}}>
                  <button onClick={()=>setPg(1)} disabled={pg===1} style={{padding:'7px 13px',borderRadius:10,border:'1px solid #e2ecf6',background:pg===1?'#f2f7fc':'#fff',cursor:pg===1?'default':'pointer',fontSize:13,color:NAVY}}>ראשון</button>
                  <button onClick={()=>setPg(p=>Math.max(1,p-1))} disabled={pg===1} style={{padding:'7px 13px',borderRadius:10,border:'1px solid #e2ecf6',background:pg===1?'#f2f7fc':'#fff',cursor:pg===1?'default':'pointer',fontSize:13,color:NAVY}}>◀</button>
                  {(()=>{const win=Math.min(7,tp);let start=Math.max(1,pg-3);if(start+win-1>tp)start=Math.max(1,tp-win+1);return Array.from({length:win},(_,i)=>start+i).filter(p=>p>=1&&p<=tp).map(p=>(<button key={p} onClick={()=>setPg(p)} style={{padding:'7px 12px',borderRadius:10,border:'1px solid',borderColor:p===pg?NAVY:'#e2ecf6',background:p===pg?NAVY:'#fff',color:p===pg?'#fff':NAVY,cursor:'pointer',fontWeight:p===pg?700:500,fontSize:13}}>{p}</button>));})()}
                  <button onClick={()=>setPg(p=>Math.min(tp,p+1))} disabled={pg===tp} style={{padding:'7px 13px',borderRadius:10,border:'1px solid #e2ecf6',background:pg===tp?'#f2f7fc':'#fff',cursor:pg===tp?'default':'pointer',fontSize:13,color:NAVY}}>▶</button>
                  <button onClick={()=>setPg(tp)} disabled={pg===tp} style={{padding:'7px 13px',borderRadius:10,border:'1px solid #e2ecf6',background:pg===tp?'#f2f7fc':'#fff',cursor:pg===tp?'default':'pointer',fontSize:13,color:NAVY}}>אחרון</button>
                </div>
              )}
              <div style={{textAlign:'center',padding:'16px 0',color:'#9fb2c6',fontSize:12}}>
                נתונים: <a href="https://next.obudget.org" target="_blank" rel="noopener noreferrer" style={{color:BLUE}}>BudgetKey</a> · מינהל הרכש הממשלתי · עדכון יומי ב-06:00
              </div>
            </>
          )}
        </div>

        {/* FILTER SIDEBAR */}
        <aside style={{flex:'0 0 288px',background:'#fff',borderRadius:22,padding:22,boxShadow:'0 10px 28px rgba(11,46,82,.05)',alignSelf:'flex-start'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
            <span style={{fontFamily:RBK,fontWeight:700,fontSize:17,color:NAVY}}>סינון</span>
            <span onClick={()=>{setBiz('');setPub('');setMaxD(365);setShowClosed(false);setShowNoDate(true);setQ('');setPg(1);}} style={{color:'#9fb2c6',cursor:'pointer',fontSize:14}}>איפוס ✕</span>
          </div>

          <div style={{fontSize:13,fontWeight:600,color:MUTED,marginBottom:7}}>תחום עיסוק</div>
          <div style={{position:'relative',marginBottom:16}}>
            <select value={biz} onChange={e=>{setBiz(e.target.value);setPg(1);}} style={fieldStyle}>
              {BIZ.map(b=><option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
            <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:11,color:'#9fb2c6',pointerEvents:'none'}}>▾</span>
          </div>

          <div style={{fontSize:13,fontWeight:600,color:MUTED,marginBottom:7}}>גוף מפרסם</div>
          <div style={{position:'relative',marginBottom:18}}>
            <select value={pub} onChange={e=>{setPub(e.target.value);setPg(1);}} style={fieldStyle}>
              {PUBS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:11,color:'#9fb2c6',pointerEvents:'none'}}>▾</span>
          </div>

          <div style={{fontSize:13,fontWeight:600,color:MUTED,marginBottom:10}}>נסגר בתוך</div>
          <input type="range" min={7} max={365} value={maxD} onChange={e=>{setMaxD(Number(e.target.value));setPg(1);}} style={{width:'100%',accentColor:BLUE}}/>
          <div style={{fontSize:12,color:'#8aa0b5',marginTop:2,marginBottom:18}}>עד {maxD} ימים</div>

          <label style={{display:'flex',alignItems:'center',gap:10,fontSize:13.5,color:'#33475b',marginBottom:12,cursor:'pointer'}}>
            <input type="checkbox" checked={showClosed} onChange={e=>setShowClosed(e.target.checked)} style={{accentColor:BLUE,width:16,height:16}}/>
            הצג גם מכרזים שנסגרו
          </label>
          <label style={{display:'flex',alignItems:'center',gap:10,fontSize:13.5,color:'#33475b',marginBottom:20,cursor:'pointer'}}>
            <input type="checkbox" checked={showNoDate} onChange={e=>setShowNoDate(e.target.checked)} style={{accentColor:BLUE,width:16,height:16}}/>
            הצג גם ללא מועד אחרון
          </label>

          <a href="/agent" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,background:'linear-gradient(135deg,#7c5cf0,#b44be8)',color:'#fff',textAlign:'center',fontWeight:700,fontSize:15,padding:14,borderRadius:14,textDecoration:'none'}}>✦ הסוכן החכם</a>
        </aside>

      </div>
    </div>
  );
}
