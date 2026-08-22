"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useIsMobile } from "../hooks/useIsMobile";
import MobileTabBar from "../components/MobileTabBar";
import MobileMenu from "../components/MobileMenu";
import { getSession, signOut, AUTH_EVENT, type AuthSession } from '../lib/authClient';
import { parseHeDate, isExempt } from '../lib/tenderMeta';
import { fetchMyProfile, type BusinessProfile } from '../lib/profileApi';
import { displayScore } from '../lib/scoring';
// TICKET-12/13: מנוע ההתאמה המרכזי — סינון, חיפוש, סיווג וספירת
// תחומים עוברים כולם דרך app/lib/domains.ts (מקור אמת יחיד).
import { PUBLISHERS, UNCATEGORIZED_ID, UNCATEGORIZED_LABEL } from '../lib/domains';

/* ============ עיצוב 2a — אנטרפרייז, טבלת נתונים נקייה ============ */

const PUBS=[{id:'',label:'כל הגופים'},...PUBLISHERS.map(p=>({id:p.id,label:p.label}))];
interface T{id:string;title:string;publisher:string;publishDate:string;deadline:string;status:string;url:string;type:string;smallBiz?:boolean;smallBizConfidence?:string|null;}
function dl(d:string):number|null{const x=parseHeDate(d);return x===null?null:Math.ceil((x.getTime()-Date.now())/86400000);}
function fd(d:string){const x=parseHeDate(d);return x===null?'—':x.toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'});}
// QA #04: matchSc (55+(אורך כותרת%3)*10) הוסר — הציון מגיע מ-displayScore, כמו בדף הפרט ובסוכן.
function bandColor(score:number){if(score>=80)return'#1e9e5a';if(score>=65)return'#d9a520';return'#2b6fc4';}
function statusTags(t:T,days:number|null){
  const tags:{label:string,title?:string,bg:string,fg:string,bd:string}[]=[];
  const s=t.status||'';
  if(s.includes('פורסם'))tags.push({label:'פורסם',bg:'#e7f6ec',fg:'#1e7d45',bd:'#c6ead2'});
  else if(s.includes('עדכון'))tags.push({label:'בעדכון',bg:'#fbf3d8',fg:'#96731a',bd:'#f0e3b0'});
  else if(s.includes('סגור')||s.includes('נסגר'))tags.push({label:s,bg:'#fbe9e7',fg:'#b04a34',bd:'#f2cfc8'});
  else if(s)tags.push({label:s,bg:'#eef1f4',fg:'#5b6b7a',bd:'#e2e7ec'});
  if(days!==null&&days>=0&&days<=7)tags.push({label:'נסגר בקרוב',bg:'#fbe9e7',fg:'#b04a34',bd:'#f2cfc8'});
  if(t.smallBiz&&(t.smallBizConfidence==='high'||t.smallBizConfidence==='medium'))tags.push({label:'⭐ העדפה לעסקים קטנים',bg:'#e8f1fb',fg:'#1e5aa8',bd:'#cfe0f4'});
  if(t.publisher)tags.push({label:t.publisher.length>20?t.publisher.slice(0,20)+'…':t.publisher,title:t.publisher,bg:'#eaf1fb',fg:'#1e5aa8',bd:'#d3e2f5'});
  return tags;
}

const DARK='#1a2330', BLUE='#2b6fc4', MUTED='#667380', BORDER='#e6eaee';

export default function Dashboard(){
  const [session, setSession] = useState<AuthSession | null>(null);
  const [bizProfile, setBizProfile] = useState<BusinessProfile | null>(null);
  // QA/H-1: בדיקת הסשן קובעת את showClosed, שהוא תלות של בקשת החיפוש.
  // בלי דגל מוכנות נורות *שתי* בקשות בכל טעינה למשתמש לא מחובר —
  // אחת לפני שהערך נקבע ואחת אחריו. אומת במדידה: 3.8 ש' פעמיים.
  const[ready,setReady]=useState(false);
  useEffect(() => {
    const s = getSession();
    setSession(s);
    // אורח: ברירת מחדל — הצג הכל, כולל מכרזים שמועד הגשתם עבר
    if (!s) setShowClosed(true);
    setReady(true);
    const onChange = () => setSession(getSession());
    window.addEventListener(AUTH_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(AUTH_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  // משתמש מחובר: טעינת הפרופיל העסקי לדירוג מותאם
  useEffect(() => {
    if (!session) { setBizProfile(null); return; }
    fetchMyProfile().then(p => setBizProfile(p)).catch(() => setBizProfile(null));
  }, [session]);
  async function handleSignOut() {
    await signOut();
    window.location.href = '/signin';
  }

  // מצבי תצוגה מהסרגל: ?view=exempt / ?view=smallbiz, וחיפוש התחלתי ?q=
  const[exemptView]=useState<boolean>(()=>typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('view')==='exempt');
  const[sbView]=useState<boolean>(()=>typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('view')==='smallbiz');
  const[loading,setLoading]=useState(true);
  const[fetchedAt,setFetchedAt]=useState('');
  const[marked,setMarked]=useState<string[]>([]);
  // QA #08: חיפוש, מסננים, מיון ועמוד נקראים מה-URL ונכתבים אליו —
  // רענון, "אחורה" ושיתוף קישור שומרים את המצב.
  const sp=()=>typeof window!=='undefined'?new URLSearchParams(window.location.search):new URLSearchParams();
  const[biz,setBiz]=useState(()=>sp().get('biz')||'');
  const[pub,setPub]=useState(()=>sp().get('pub')||'');
  const[maxD,setMaxD]=useState(()=>{const v=Number(sp().get('days'));return v>=7&&v<=365?v:365;});
  const[showClosed,setShowClosed]=useState(()=>sp().get('closed')==='1');
  const[showNoDate,setShowNoDate]=useState(()=>sp().get('nodate')!=='0');
  const[sbOnly,setSbOnly]=useState(()=>sp().get('sb')==='1');
  const[tab,setTab]=useState<'all'|'closing'|'new'>(()=>{const t=sp().get('tab');return t==='closing'||t==='new'?t:'all';});
  const[sort,setSort]=useState<''|'score'|'deadline'|'published'>(()=>{const t=sp().get('sort');return t==='score'||t==='deadline'||t==='published'?t:'';});
  const[q,setQ]=useState(()=>sp().get('q')||'');
  const[pg,setPg]=useState(()=>Math.max(1,Number(sp().get('page'))||1));
  useEffect(()=>{
    if(typeof window==='undefined')return;
    const u=new URL(window.location.href);
    const set=(k:string,v:string,def:string)=>{if(v&&v!==def)u.searchParams.set(k,v);else u.searchParams.delete(k);};
    set('q',q,'');set('biz',biz,'');set('pub',pub,'');set('tab',tab,'all');set('sort',sort,'');set('page',String(pg),'1');
    set('days',String(maxD),'365');set('closed',showClosed?'1':'','');set('nodate',showNoDate?'':'0','');set('sb',sbOnly?'1':'','');
    window.history.replaceState(null,'',u.toString());
  },[q,biz,pub,tab,sort,pg,maxD,showClosed,showNoDate,sbOnly]);
  const[showFilters,setShowFilters]=useState(false);
  const PER=25;
  const isMobile=useIsMobile();
  const now=useMemo(()=>Date.now(),[]);

  useEffect(()=>{
    try{const m=JSON.parse(localStorage.getItem('markedTenders')||'[]');if(Array.isArray(m))setMarked(m);}catch(e){}
  },[]);
  const toggleMark=useCallback((id:string,e?:any)=>{if(e){e.preventDefault();e.stopPropagation();}setMarked(prev=>{const has=prev.includes(id);const next=has?prev.filter(x=>x!==id):[...prev,id];try{localStorage.setItem('markedTenders',JSON.stringify(next));}catch(err){}return next;});},[]);

  // QA/H-1: fetchDedupedTenders הוסר — הוא היה מושך את כל המאגר.

  // QA/H-1: כל הסינון, הדירוג, העימוד והספירות עברו לצד שרת.
  // קודם הדשבורד משך את כל 9,471 המכרזים (3.4MB, 10 בקשות טוריות,
  // ~5 שניות) רק כדי להציג 25 שורות. עכשיו נשלח עמוד אחד.
  // הלוגיקה עצמה חיה ב-app/lib/tenderQuery.ts — מקור אמת יחיד שנבדק
  // מול הגרסה המקורית על 432 צירופי מסננים.
  const[srv,setSrv]=useState<{tenders:T[];total:number;counts:{base:number;closing:number;new:number;smallBiz:number;active:number;exempt:number};domains:{id:string;label:string;count:number}[];uncategorized:number;corpus:number}|null>(null);
  const[err,setErr]=useState(false);

  const view=exemptView?'exempt':sbView?'smallbiz':null;
  const reqRef=useRef(0);
  useEffect(()=>{
    if(!ready)return;
    const seq=++reqRef.current;
    const handle=setTimeout(async()=>{
      setLoading(true);setErr(false);
      try{
        // QA #03: אורח → GET (נענה מה-CDN); משתמש עם פרופיל → POST
        let r:Response;
        if(bizProfile){
          r=await fetch('/api/tenders/search',{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({page:pg,perPage:PER,
              filters:{view,biz,pub,maxD,showClosed,showNoDate,sbOnly,q,tab,sort:sort||undefined},
              profile:{categories:bizProfile.categories,region:bizProfile.region,publisher_type:bizProfile.publisher_type,keywords:bizProfile.keywords||''}})});
        }else{
          const ps=new URLSearchParams();
          const put=(k:string,v:string,def:string)=>{if(v&&v!==def)ps.set(k,v);};
          put('page',String(pg),'1');put('view',view||'','');put('biz',biz,'');put('pub',pub,'');put('days',String(maxD),'365');
          put('closed',showClosed?'1':'','');put('nodate',showNoDate?'':'0','');put('sb',sbOnly?'1':'','');put('q',q.trim(),'');put('tab',tab,'all');put('sort',sort,'');
          r=await fetch('/api/tenders/search?'+ps.toString());
        }
        if(!r.ok)throw new Error('http '+r.status);
        const j=await r.json();
        // מתעלמים מתשובה של בקשה שכבר אינה העדכנית ביותר
        if(seq!==reqRef.current)return;
        setSrv(j);setFetchedAt(j.fetchedAt||'');
      }catch{
        if(seq===reqRef.current)setErr(true);
      }finally{
        if(seq===reqRef.current)setLoading(false);
      }
    // השהיה קצרה רק להקלדה בחיפוש, כדי לא לירות בקשה לכל תו
    },q?250:0);
    return()=>clearTimeout(handle);
  },[ready,pg,view,biz,pub,maxD,showClosed,showNoDate,sbOnly,q,tab,sort,bizProfile]);

  const rows=srv?.tenders??[];
  const counts=srv?.counts??{base:0,closing:0,new:0,smallBiz:0,active:0,exempt:0};
  const tp=Math.max(1,Math.ceil((srv?.total??0)/PER));
  // QA #04: ציון אחד לכל המסכים — לפי פרופיל אם יש, אחרת הציון הכללי
  const scoreOf=useCallback((t:T):number=>displayScore(t,bizProfile?{categories:bizProfile.categories,region:bizProfile.region,publisher_type:bizProfile.publisher_type,keywords:bizProfile.keywords||''}:null,now),[bizProfile,now]);

  // QA/H-6: קודם היה `new Date(fetchedAt||Date.now())` — כשלא היה נתון
  // סנכרון אמיתי הוצג *הזמן הנוכחי*, והממשק לא יכול היה לומר "לא ידוע".
  const scannedLabel=(()=>{
    if(!fetchedAt)return 'עדכון אחרון לא ידוע';
    const d=new Date(fetchedAt);
    if(isNaN(d.getTime()))return 'עדכון אחרון לא ידוע';
    return 'נסרק '+d.toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+d.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});
  })();

  const activeCnt=counts.active, exemptCnt=counts.exempt, sbCnt=counts.smallBiz;
  const sideNav=[
    {icon:'⌂',label:'דף הבית',href:'/'},
    {icon:'◧',label:'גילוי מכרזים',href:'/dashboard',active:!exemptView&&!sbView,count:activeCnt},
    {icon:'⊘',label:'מכרזים פטורים',href:'/dashboard?view=exempt',active:exemptView,count:exemptCnt},
    {icon:'⭐',label:'העדפה לעסקים קטנים',href:'/dashboard?view=smallbiz',active:sbView,count:sbCnt},
    {icon:'★',label:'מכרזים מסומנים',href:'/marked'},
    {icon:'◈',label:'מכרזי הסוכן החכם',href:'/agent'},
    {icon:'▤',label:'ערבויות וליווי',href:'/guarantee'},
    {icon:'⛁',label:'מקורות',href:'/sources'},
    {icon:'⚙',label:'פרופיל עסקי',href:'/profile'},
  ];
  // TICKET-13: התחומים נגזרים מהנתונים בפועל — ספירה חיה דרך המנוע
  // המרכזי (כולל נרמול שדה type מהמקור), תחום ריק מוסתר, מיון לפי
  // נפח, ובסוף bucket "לא מסווג" מדיד למעקב אחר יעד הצמצום.
  const bizOptions=useMemo(()=>{
    const opts:{id:string,label:string}[]=[{id:'',label:'כל התחומים'}];
    const domains=srv?.domains??[], uncategorized=srv?.uncategorized??0;
    for(const c of domains)opts.push({id:c.id,label:`${c.label} (${c.count.toLocaleString('he-IL')})`});
    if(uncategorized>0)opts.push({id:UNCATEGORIZED_ID,label:`${UNCATEGORIZED_LABEL} (${uncategorized.toLocaleString('he-IL')})`});
    return opts;
  },[srv]);
  const smallBizCount=counts.smallBiz;
  const kpis=[
    {value:srv?.corpus??0,label:'מכרזים פעילים במאגר',dot:BLUE},
    {value:counts.closing,label:'נסגרים בשבוע הקרוב',dot:'#b04a34'},
    {value:counts.new,label:'חדשים ב-7 ימים',dot:'#1e9e5a'},
    // QA #19: לחיצה על הכרטיס הפעילה בשקט מסנן סמוי (sbOnly). עכשיו היא מובילה לתצוגה הייעודית.
    {value:smallBizCount,label:'⭐ העדפה לעסקים קטנים',dot:'#1e5aa8',onClick:()=>{window.location.href='/dashboard?view=smallbiz';}},
    {value:counts.base,label:'מוצגים כעת',dot:'#d9a520'},
  ] as {value:number,label:string,dot:string,onClick?:()=>void}[];
  const chip:React.CSSProperties={background:'#fff',color:'#5b6b7a',fontWeight:600,fontSize:13,padding:'8px 15px',borderRadius:7,border:'1px solid #e2e7ec',cursor:'pointer'};
  const selWrap:React.CSSProperties={position:'relative'};
  const selStyle:React.CSSProperties={background:'#fff',color:'#5b6b7a',fontWeight:600,fontSize:13,padding:'8px 30px 8px 15px',borderRadius:7,border:'1px solid #e2e7ec',cursor:'pointer',appearance:'none',WebkitAppearance:'none',fontFamily:'inherit'};

  return(
    <div style={{minHeight:'100vh',background:'#eef1f4',fontFamily:"'Assistant','Rubik',Arial,sans-serif",direction:'rtl',color:DARK,padding:'0'}}>
      <div style={{display:'flex',minHeight:'100vh',background:'#f6f8fa'}}>

        {/* ===== SIDEBAR ===== */}
        <nav aria-label="ניווט ראשי" style={{flex:'0 0 238px',background:'#fff',borderInlineEnd:`1px solid ${BORDER}`,padding:'22px 16px',display:isMobile?'none':'flex',flexDirection:'column',gap:3,position:'sticky',top:0,alignSelf:'flex-start',height:'100vh'}}>
          <a href="/dashboard" style={{display:'flex',alignItems:'center',gap:11,padding:'0 8px 20px',marginBottom:8,borderBottom:'1px solid #eef1f4',textDecoration:'none'}}>
            <div style={{width:34,height:34,borderRadius:8,background:BLUE,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:16,fontWeight:800}}>ש</div>
            <div style={{lineHeight:1.15}}><div style={{fontWeight:700,fontSize:15.5,color:DARK}}>שווה מכרזים</div><div style={{fontSize:11,color:'#5f6c7a'}}>מועדון עסקים 360</div></div>
          </a>
          {sideNav.map(s=>(
            <a key={s.label} href={s.href} aria-current={s.active?'page':undefined} style={{display:'flex',alignItems:'center',gap:11,padding:'11px 12px',borderRadius:9,fontSize:14.5,textDecoration:'none',
              fontWeight:s.active?700:500,
              background:s.active?'#e8f1fb':'transparent',
              color:s.active?'#1e5aa8':'#5b6b7a',
              borderInlineStart:s.active?`3px solid ${BLUE}`:'3px solid transparent'}}>
              <span style={{fontSize:16,opacity:s.active?1:.65}}>{s.icon}</span>
              <span style={{flex:1}}>{s.label}</span>
              {'count' in s&&(s as any).count>0&&(
                <span style={{fontSize:11,fontWeight:700,color:s.active?'#1e5aa8':'#5f6c7a',background:s.active?'#fff':'#eef1f4',borderRadius:999,padding:'1px 8px'}}>
                  {((s as any).count as number).toLocaleString('he-IL')}
                </span>
              )}
            </a>
          ))}
          <div style={{marginTop:'auto',border:`1px solid ${BORDER}`,borderRadius:12,padding:16}}>
            <div style={{fontWeight:700,fontSize:14,color:DARK}}>◈ הסוכן החכם</div>
            <div style={{fontSize:12,color:MUTED,margin:'7px 0 12px',lineHeight:1.5}}>קבלו מכרזים מותאמים לפי הפרופיל העסקי שלכם</div>
            {/* QA/M-19: הכיתוב היה "הפעלה", אבל אין בפרויקט שום state של
                מופעל/כבוי — הסוכן תמיד רץ, ו-/api/agent מחשב התאמות מהפרופיל
                בכל טעינה. כפתור שמבטיח הפעלה ולא משנה דבר נראה כתקלה. */}
            <a href="/agent" style={{display:'block',background:DARK,color:'#fff',fontWeight:600,fontSize:13,textAlign:'center',padding:9,borderRadius:8,textDecoration:'none'}}>לסוכן החכם ←</a>
          </div>
          <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${BORDER}`}}>
            {session ? (
              <div>
                <div style={{fontSize:11.5,color:'#5f6c7a',marginBottom:8,wordBreak:'break-all'}}>{session.user.email}</div>
                <button type="button" onClick={handleSignOut} style={{width:'100%',padding:'8px 12px',borderRadius:9,border:'1px solid #e2e7ec',background:'#fff',color:'#5b6b7a',fontSize:12.5,fontWeight:600,cursor:'pointer'}}>התנתקות</button>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <a href="/signin" style={{display:'block',textAlign:'center',padding:'9px 12px',borderRadius:9,border:'1px solid #e2e7ec',background:'#fff',color:DARK,fontSize:12.5,fontWeight:600,textDecoration:'none'}}>התחברות</a>
                <a href="/signup" style={{display:'block',textAlign:'center',padding:'9px 12px',borderRadius:9,border:'none',background:BLUE,color:'#fff',fontSize:12.5,fontWeight:700,textDecoration:'none'}}>הרשמה</a>
              </div>
            )}
          </div>
        </nav>

        {/* ===== CONTENT ===== */}
        <main id="main" style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',...(isMobile?{paddingBottom:72}:{})}}>
          {/* header */}
          <div style={{background:'#fff',borderBottom:`1px solid ${BORDER}`,padding:isMobile?'12px 14px':'15px 26px',display:'flex',alignItems:'center',gap:isMobile?10:18,position:'sticky',top:0,zIndex:5}}>
            {isMobile && <MobileMenu/>}
            <h1 style={{fontWeight:700,fontSize:isMobile?16:20,color:DARK,flex:'0 0 auto',margin:0}}>{exemptView?'מכרזים פטורים':sbView?'העדפה לעסקים קטנים':'גילוי מכרזים'}</h1>
            <div style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:10,background:'#fff',border:'1.5px solid '+BLUE,borderRadius:10,padding:'12px 16px',maxWidth:520,boxShadow:'0 2px 10px rgba(43,111,196,0.12)'}}>
              <span style={{color:BLUE,fontSize:17,fontWeight:700}}>⌕</span>
              <input type="search" aria-label="חיפוש מכרזים" value={q} onChange={e=>{setQ(e.target.value);setPg(1);}} placeholder="חיפוש: נושא, גוף מפרסם, מספר מכרז…" className="search-input" style={{flex:1,border:'none',background:'transparent',fontSize:14.5,color:DARK,fontFamily:'inherit'}}/>
              {q&&<button type="button" aria-label="נקה חיפוש" onClick={()=>{setQ('');setPg(1);}} style={{color:'#5f6c7a',cursor:'pointer',fontSize:15,background:'none',border:'none',padding:0}}>✕</button>}
            </div>
            {!isMobile && (<>
<span style={{marginInlineStart:'auto',fontSize:12.5,color:'#62707e',display:'inline-flex',alignItems:'center',gap:7,flex:'0 0 auto'}}>
              <span style={{width:7,height:7,borderRadius:999,background:BLUE}}></span>
              {loading?(<><style>{`@keyframes dashSpin{to{transform:rotate(360deg);}}`}</style><span style={{display:'inline-flex',alignItems:'center',gap:6}}><span style={{width:9,height:9,border:'2px solid '+BORDER,borderTopColor:BLUE,borderRadius:'50%',display:'inline-block',animation:'dashSpin 0.7s linear infinite'}}/>טוען…</span></>):`${scannedLabel} · `}
              <a href="https://data.gov.il" target="_blank" rel="noopener noreferrer" style={{color:'#62707e'}}>data.gov.il</a>
            </span>
            <a href="/agent" style={{background:BLUE,color:'#fff',fontWeight:600,fontSize:13,padding:'9px 16px',borderRadius:8,textDecoration:'none',flex:'0 0 auto'}}>✦ תובנות AI</a>
</>)}
            {session
              ?<a href="/profile" aria-label="פרופיל עסקי" title={session.user.email} style={{width:32,height:32,borderRadius:8,background:'#eef1f4',color:DARK,display:'inline-flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,textDecoration:'none',flex:'0 0 auto'}}>{(session.user.email||'א').slice(0,1).toUpperCase()}</a>
              :(!isMobile&&<a href="/signin" style={{fontSize:13,fontWeight:600,color:DARK,textDecoration:'none',flex:'0 0 auto'}}>התחברות</a>)}
          </div>
          {isMobile && !loading && (
            <div style={{background:'#fff',borderBottom:`1px solid ${BORDER}`,padding:'6px 14px',fontSize:11.5,color:'#62707e',display:'flex',alignItems:'center',gap:6}}>
              <span style={{width:6,height:6,borderRadius:999,background:BLUE,display:'inline-block'}}></span>
              {scannedLabel}
            </div>
          )}

          <div style={{padding:'22px 26px 30px',position:'relative'}}>
            {/* KPI strip */}
            <div style={{display:isMobile?'flex':'grid',gridTemplateColumns:isMobile?undefined:'repeat(5,1fr)',gap:isMobile?10:1,background:isMobile?'transparent':BORDER,border:isMobile?'none':`1px solid ${BORDER}`,borderRadius:10,overflow:isMobile?'auto':'hidden',overflowX:isMobile?'auto':undefined,marginBottom:22}}>
              {kpis.map(k=>(
                <div key={k.label} onClick={k.onClick} style={{background:'#fff',padding:'16px 18px',cursor:k.onClick?'pointer':'default',...(isMobile?{minWidth:120,border:'1px solid #e6eaee',borderRadius:12}:{})}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:8,height:8,borderRadius:999,background:k.dot}}></span><span style={{fontSize:28,fontWeight:700,color:DARK,lineHeight:1}}>{loading?'…':k.value.toLocaleString()}</span></div>
                       <div style={{fontSize:12.5,color:MUTED,marginTop:8}}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* toolbar */}
            <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:14,flexWrap:'wrap'}}>
              {[{k:'all',label:`כל המכרזים · ${counts.base.toLocaleString()}`},{k:'closing',label:`נסגרים בשבוע · ${counts.closing}`},{k:'new',label:`חדשים · ${counts.new}`}].map(tb=>{
                const active=tab===tb.k;
                return(
                  <button key={tb.k} onClick={()=>{setTab(tb.k as any);setPg(1);}} style={{...chip,background:active?DARK:'#fff',color:active?'#fff':'#5b6b7a',border:active?'none':'1px solid #e2e7ec'}}>{tb.label}</button>
                );
              })}
              <div style={{...selWrap,marginInlineStart:'auto'}}>
                <select aria-label="סינון לפי תחום" className="filter-select" value={biz} onChange={e=>{setBiz(e.target.value);setPg(1);}} style={selStyle}>{bizOptions.map(b=><option key={b.id} value={b.id}>{b.label}</option>)}</select>
                <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:10,color:'#5f6c7a',pointerEvents:'none'}}>▾</span>
              </div>
              <div style={selWrap}>
                <select aria-label="סינון לפי גוף מפרסם" className="filter-select" value={pub} onChange={e=>{setPub(e.target.value);setPg(1);}} style={selStyle}>{PUBS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select>
                <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:10,color:'#5f6c7a',pointerEvents:'none'}}>▾</span>
              </div>
              {/* QA #16: מיון אמיתי — קודם כפתור "⇅ סינון" עם אייקון מיון ובלי אפשרות למיין */}
              <div style={selWrap}>
                <select aria-label="מיון" className="filter-select" value={sort} onChange={e=>{setSort(e.target.value as any);setPg(1);}} style={selStyle}>
                  <option value="">מיון: {bizProfile?'התאמה':'מועד הגשה'}</option>
                  <option value="deadline">מועד הגשה (הקרוב קודם)</option>
                  <option value="score">ציון התאמה (הגבוה קודם)</option>
                  <option value="published">תאריך פרסום (החדש קודם)</option>
                </select>
                <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:10,color:'#5f6c7a',pointerEvents:'none'}}>▾</span>
              </div>
              <button onClick={()=>setShowFilters(v=>!v)} aria-expanded={showFilters} style={{...chip,padding:'8px 12px',background:showFilters?'#e8f1fb':'#fff',color:showFilters?'#1e5aa8':'#5b6b7a',borderColor:showFilters?'#cfe0f4':'#e2e7ec'}}>⚙ מסננים נוספים</button>
            </div>

            {/* advanced filters */}
            {showFilters&&(
              <div style={{background:'#fff',border:`1px solid ${BORDER}`,borderRadius:10,padding:'16px 18px',marginBottom:14,display:'flex',alignItems:'center',gap:24,flexWrap:'wrap'}}>
                <div style={{display:'flex',flexDirection:'column',gap:6,minWidth:220}}>
                  <span style={{fontSize:12.5,fontWeight:700,color:MUTED}}>נסגר בתוך {maxD} ימים</span>
                  <input type="range" min={7} max={365} value={maxD} onChange={e=>{setMaxD(Number(e.target.value));setPg(1);}} style={{accentColor:BLUE}}/>
                </div>
                <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13.5,color:'#33475b',cursor:'pointer'}}><input type="checkbox" checked={showClosed} onChange={e=>setShowClosed(e.target.checked)} style={{accentColor:BLUE,width:16,height:16}}/>הצג גם שנסגרו</label>
                <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13.5,color:'#33475b',cursor:'pointer'}}><input type="checkbox" checked={showNoDate} onChange={e=>setShowNoDate(e.target.checked)} style={{accentColor:BLUE,width:16,height:16}}/>הצג גם ללא מועד</label>
                <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13.5,color:'#33475b',cursor:'pointer'}}><input type="checkbox" checked={sbOnly} onChange={e=>{setSbOnly(e.target.checked);setPg(1);}} style={{accentColor:BLUE,width:16,height:16}}/>⭐ העדפה לעסקים קטנים בלבד</label>
                <button onClick={()=>{setBiz('');setPub('');setMaxD(365);setShowClosed(!session);setShowNoDate(true);setSbOnly(false);setQ('');setSort('');setPg(1);}} style={{...chip,marginInlineStart:'auto'}}>איפוס ✕</button>
              </div>
            )}

            {/* table */}
            <div role="status" aria-live="polite" style={{position:'absolute',width:1,height:1,overflow:'hidden',clip:'rect(0 0 0 0)'}}>{loading?'טוען תוצאות':`${(srv?.total??0).toLocaleString('he-IL')} תוצאות`}</div>
            <div role="table" aria-label="רשימת מכרזים" aria-busy={loading} style={{background:'#fff',border:`1px solid ${BORDER}`,borderRadius:10,overflow:'hidden',opacity:loading&&rows.length?.55:1,transition:'opacity .15s'}}>
              {!isMobile && (<div role="row" style={{display:'grid',gridTemplateColumns:'70px 1fr 232px 156px 150px',padding:'12px 18px',background:'#f7f9fb',borderBottom:`1px solid ${BORDER}`,fontSize:12,fontWeight:700,color:'#5f6c7a'}}>
                <span role="columnheader">ציון</span><span role="columnheader">נושא המכרז</span><span role="columnheader">סטטוס</span><span role="columnheader">מועד הגשה</span><span role="columnheader" aria-label="פעולות"></span>
              </div>)}
              {/* QA #03: בזמן חיפוש/דפדוף השורות הקודמות נשארות (מעומעמות) — השלד מוצג רק בטעינה הראשונה */}
              {loading&&rows.length===0?(
                <div style={{padding:'34px 22px'}}>
                  <style>{`@keyframes ldrSpin{to{transform:rotate(360deg)}}@keyframes ldrPulse{0%,100%{opacity:.45}50%{opacity:.9}}@keyframes ldrBar{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}`}</style>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,marginBottom:26}}>
                    <span style={{width:34,height:34,border:'3px solid '+BORDER,borderTopColor:BLUE,borderRadius:'50%',display:'inline-block',animation:'ldrSpin 0.8s linear infinite'}}/>
                    <div style={{fontSize:15.5,fontWeight:700,color:DARK}}>טוען מכרזים…</div>
                    <div style={{fontSize:12.5,color:MUTED}}>אוספים, מסווגים ומדרגים את המכרזים העדכניים</div>
                    <div style={{width:'min(320px,80%)',height:4,background:'#eef1f4',borderRadius:99,overflow:'hidden'}}>
                      <div style={{width:'100%',height:'100%',background:`linear-gradient(90deg,transparent,${BLUE},transparent)`,animation:'ldrBar 1.25s ease-in-out infinite'}}/>
                    </div>
                  </div>
                  {[0,1,2,3,4].map(k=>(
                    <div key={k} style={{display:'flex',alignItems:'center',gap:14,padding:'13px 0',borderTop:k?'1px solid #f0f3f6':'none',animation:'ldrPulse 1.4s ease-in-out infinite',animationDelay:`${k*0.12}s`}}>
                      <div style={{width:44,height:34,borderRadius:8,background:'#eef1f4',flex:'0 0 auto'}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{height:12,background:'#eef1f4',borderRadius:6,width:`${88-k*9}%`,marginBottom:8}}/>
                        <div style={{height:9,background:'#f2f5f8',borderRadius:6,width:`${52-k*5}%`}}/>
                      </div>
                      <div style={{width:88,height:11,background:'#eef1f4',borderRadius:6,flex:'0 0 auto'}}/>
                    </div>
                  ))}
                </div>
              ):rows.length===0&&!loading?(
                err?(
                  /* QA/H-3: כשל טעינה נראה קודם בדיוק כמו "אין תוצאות" —
                     האתר האשים את הסינון של המשתמש בזמן שהשרת נפל. */
                  <div style={{padding:44,textAlign:'center'}}>
                    <div style={{color:'#b04a34',fontWeight:700,fontSize:15,marginBottom:6}}>לא הצלחנו לטעון את המכרזים</div>
                    <div style={{color:MUTED,fontSize:13.5,marginBottom:14}}>זו תקלה זמנית בשרת, לא בסינון שלכם.</div>
                    <button onClick={()=>setPg(p=>p)} style={{background:DARK,color:'#fff',border:'none',borderRadius:8,padding:'9px 20px',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>נסו שוב</button>
                  </div>
                ):(
                <div style={{padding:50,textAlign:'center',color:MUTED,fontSize:14}}>לא נמצאו מכרזים התואמים לסינון</div>
                )
              ):rows.map((t,i)=>{
                const d=dl(t.deadline);
                const score=scoreOf(t);
                const tags=statusTags(t,d);
                const isMarked=marked.includes(t.id);
                return(
                  isMobile ? (
              <a href={`/tender/${t.id}`} key={t.id||i} style={{display:'block',textDecoration:'none',background:'#fff',border:'1px solid #e6eaee',borderRadius:16,padding:'15px 16px',borderBottom:'1px solid #e6eaee'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:11}}>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,flex:1}}>
                    {tags.map((g,gi)=>(<span key={gi} title={g.title} style={{fontSize:11,fontWeight:600,padding:'3px 9px',borderRadius:6,background:g.bg,color:g.fg,border:`1px solid ${g.bd}`}}>{g.label}</span>))}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,flex:'0 0 auto'}}>
                    <span style={{fontSize:22,fontWeight:700,color:DARK,lineHeight:1}}>{score}</span>
                    <span style={{width:26,height:3,borderRadius:2,background:bandColor(score)}}></span>
                  </div>
                </div>
                <div style={{fontSize:16.5,fontWeight:700,color:DARK,lineHeight:1.45,textAlign:'right'}}>{t.title||'ללא כותרת'}</div>
                <div style={{fontSize:13,color:'#62707e',marginTop:8}}>{t.publisher||'לא ידוע'} · פורסם {fd(t.publishDate)}</div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:13,paddingTop:12,borderTop:'1px solid #eef1f4'}}>
                  <div style={{fontSize:12.5}}>
                    <span style={{color:'#62707e'}}>הגשה עד </span>
                    <span style={{color:DARK,fontWeight:700}}>{isExempt(t.type,t.title)?<span style={{color:'#8a5db8',background:'#f3ecfb',borderRadius:6,padding:'2px 8px',fontSize:12,fontWeight:600}}>פטור</span>:fd(t.deadline)}</span>
                    {d!==null&&d>=0&&<span style={{color:d<=7?'#b04a34':'#62707e'}}> · נותרו {d} ימים</span>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:12,fontWeight:600,color:'#1e5aa8',background:'#e8f1fb',border:'1px solid #cfe0f4',borderRadius:7,padding:'5px 11px',whiteSpace:'nowrap'}}>פרטי המכרז ←</span>
                    <button type="button" onClick={(e)=>toggleMark(t.id,e)} aria-pressed={isMarked} aria-label={isMarked?'הסר סימון':'סמן מכרז'} style={{fontSize:18,color:isMarked?'#d9a520':'#7f8c99',background:'transparent',border:'none',cursor:'pointer',padding:6}}>{isMarked?'★':'☆'}</button>
                  </div>
                </div>
              </a>
            ) : (
              <div role="row" key={t.id||i} style={{display:'grid',gridTemplateColumns:'70px 1fr 232px 156px 150px',padding:'16px 18px',borderBottom:'1px solid #eef1f4',alignItems:'center'}}>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:5}}>
                      <span style={{fontSize:21,fontWeight:700,color:DARK,lineHeight:1}}>{score}</span>
                      <span style={{width:30,height:3,borderRadius:2,background:bandColor(score)}}></span>
                    </div>
                    <div style={{minWidth:0,paddingInlineEnd:16}}>
                      {t.url||t.id
                        ?<a href={`/tender/${t.id}`} style={{fontSize:16.5,fontWeight:600,color:DARK,lineHeight:1.4,textDecoration:'none',display:'block'}}>{t.title||'ללא כותרת'}</a>
                        :<div style={{fontSize:15,fontWeight:600,color:DARK,lineHeight:1.4}}>{t.title||'ללא כותרת'}</div>}
                      <div style={{fontSize:13.5,color:'#62707e',marginTop:5}}>{t.publisher||'לא ידוע'} · פורסם {fd(t.publishDate)}</div>
                    </div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {tags.map((g,gi)=>(<span key={gi} title={g.title} style={{fontSize:11.5,fontWeight:600,padding:'3px 10px',borderRadius:6,background:g.bg,color:g.fg,border:`1px solid ${g.bd}`}}>{g.label}</span>))}
                    </div>
                    <div style={{fontSize:13}}>
                      <div style={{color:DARK,fontWeight:600}}>{isExempt(t.type,t.title)?<span style={{color:'#8a5db8',background:'#f3ecfb',borderRadius:6,padding:'2px 8px',fontSize:12,fontWeight:600}}>פטור</span>:fd(t.deadline)}</div>
                      {d!==null&&d>=0&&<div style={{color:d<=7?'#b04a34':'#62707e',fontSize:12,marginTop:3}}>נותרו {d} ימים</div>}
                    </div>
                    <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:6}}>
                      <a href={`/tender/${t.id}`} style={{fontSize:12,fontWeight:600,color:'#1e5aa8',background:'#e8f1fb',border:'1px solid #cfe0f4',borderRadius:7,padding:'5px 11px',textDecoration:'none',whiteSpace:'nowrap'}}>פרטים</a>
                      <button type="button" onClick={(e)=>toggleMark(t.id,e)} aria-pressed={isMarked} aria-label={isMarked?'הסר סימון':'סמן מכרז'} title={isMarked?'הסר סימון':'סמן מכרז'} style={{fontSize:16,lineHeight:1,color:isMarked?'#d9a520':'#7f8c99',background:'transparent',border:'none',cursor:'pointer',padding:6}}>{isMarked?'★':'☆'}</button>
                    </div>
                  </div>
            )
                );
              })}
            </div>

            {/* pagination */}
            {!loading&&tp>1&&(
              <nav aria-label="דפדוף" style={{display:'flex',gap:6,justifyContent:'center',marginTop:20,flexWrap:'wrap'}}>
                <button onClick={()=>setPg(1)} disabled={pg===1} style={{...chip,opacity:pg===1?.5:1}}>ראשון</button>
                {/* QA #23: ב-RTL "הקודם" מצביע ימינה (לכיוון ההתחלה) */}
                <button onClick={()=>setPg(p=>Math.max(1,p-1))} disabled={pg===1} aria-label="עמוד קודם" style={{...chip,opacity:pg===1?.5:1}}>▶</button>
                {(()=>{const win=Math.min(7,tp);let start=Math.max(1,pg-3);if(start+win-1>tp)start=Math.max(1,tp-win+1);return Array.from({length:win},(_,i)=>start+i).filter(p=>p>=1&&p<=tp).map(p=>(<button key={p} onClick={()=>setPg(p)} aria-current={p===pg?'page':undefined} style={{...chip,background:p===pg?DARK:'#fff',color:p===pg?'#fff':'#5b6b7a',border:p===pg?'none':'1px solid #e2e7ec',fontWeight:700}}>{p}</button>));})()}
                <button onClick={()=>setPg(p=>Math.min(tp,p+1))} disabled={pg===tp} aria-label="עמוד הבא" style={{...chip,opacity:pg===tp?.5:1}}>◀</button>
                <button onClick={()=>setPg(tp)} disabled={pg===tp} style={{...chip,opacity:pg===tp?.5:1}}>אחרון</button>
              </nav>
            )}
            <div style={{textAlign:'center',padding:'16px 0',color:'#5f6c7a',fontSize:12}}>
              נתונים: <a href="https://next.obudget.org" target="_blank" rel="noopener noreferrer" style={{color:BLUE}}>BudgetKey</a> · מינהל הרכש הממשלתי · {fetchedAt?scannedLabel:'מתעדכן מדי בוקר'}
            </div>
          </div>
        </main>
      </div>
      {isMobile && <MobileTabBar/>}
    </div>
  );
}
