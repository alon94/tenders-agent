"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useIsMobile } from "../hooks/useIsMobile";
import MobileTabBar from "../components/MobileTabBar";
import MobileMenu from "../components/MobileMenu";
import { fetchDedupedTenders } from '../lib/tenderData';
import { getSession, signOut, AUTH_EVENT, type AuthSession } from '../lib/authClient';
import { parseHeDate, isExempt } from '../lib/tenderMeta';
import { fetchMyProfile, type BusinessProfile } from '../lib/profileApi';
import { scoreTender } from '../lib/scoring';
// TICKET-12/13: מנוע ההתאמה המרכזי — סינון, חיפוש, סיווג וספירת
// תחומים עוברים כולם דרך app/lib/domains.ts (מקור אמת יחיד).
import { DOMAINS, PUBLISHERS, UNCATEGORIZED_ID, UNCATEGORIZED_LABEL, matchDomain, matchPublisher, matchQuery, domainCounts } from '../lib/domains';

/* ============ עיצוב 2a — אנטרפרייז, טבלת נתונים נקייה ============ */

const PUBS=[{id:'',label:'כל הגופים'},...PUBLISHERS.map(p=>({id:p.id,label:p.label}))];
interface T{id:string;title:string;publisher:string;publishDate:string;deadline:string;status:string;url:string;type:string;smallBiz?:boolean;smallBizConfidence?:string|null;smallBizQuote?:string|null;smallBizSummary?:string|null;}
function dl(d:string):number|null{const x=parseHeDate(d);return x===null?null:Math.ceil((x.getTime()-Date.now())/86400000);}
function fd(d:string){const x=parseHeDate(d);return x===null?'—':x.toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'});}
function matchSc(biz:string,t:{title:string,publisher:string}):number{if(!biz||biz===UNCATEGORIZED_ID)return 55+Math.floor((t.title.length%3)*10);const b=DOMAINS.find(b=>b.id===biz);if(!b)return 55;const h=(t.title+' '+t.publisher).toLowerCase();const hits=b.kw.filter((k:string)=>h.includes(k.toLowerCase())).length;return Math.min(95,50+hits*15);}
function bandColor(score:number){if(score>=80)return'#1e9e5a';if(score>=65)return'#d9a520';return'#2b6fc4';}
function statusTags(t:T,days:number|null){
  const tags:{label:string,bg:string,fg:string,bd:string}[]=[];
  const s=t.status||'';
  if(s.includes('פורסם'))tags.push({label:'פורסם',bg:'#e7f6ec',fg:'#1e7d45',bd:'#c6ead2'});
  else if(s.includes('עדכון'))tags.push({label:'בעדכון',bg:'#fbf3d8',fg:'#96731a',bd:'#f0e3b0'});
  else if(s.includes('סגור')||s.includes('נסגר'))tags.push({label:s,bg:'#fbe9e7',fg:'#b04a34',bd:'#f2cfc8'});
  else if(s)tags.push({label:s,bg:'#eef1f4',fg:'#5b6b7a',bd:'#e2e7ec'});
  if(days!==null&&days>=0&&days<=7)tags.push({label:'נסגר בקרוב',bg:'#fbe9e7',fg:'#b04a34',bd:'#f2cfc8'});
  if(t.smallBiz&&(t.smallBizConfidence==='high'||t.smallBizConfidence==='medium'))tags.push({label:'⭐ העדפה לעסקים קטנים',bg:'#e8f1fb',fg:'#1e5aa8',bd:'#cfe0f4'});
  if(t.publisher)tags.push({label:t.publisher.length>20?t.publisher.slice(0,20)+'…':t.publisher,bg:'#eaf1fb',fg:'#1e5aa8',bd:'#d3e2f5'});
  return tags;
}

const DARK='#1a2330', BLUE='#2b6fc4', MUTED='#667380', BORDER='#e6eaee';

export default function Dashboard(){
  const [session, setSession] = useState<AuthSession | null>(null);
  const [bizProfile, setBizProfile] = useState<BusinessProfile | null>(null);
  useEffect(() => {
    const s = getSession();
    setSession(s);
    // אורח: ברירת מחדל — הצג הכל, כולל מכרזים שמועד הגשתם עבר
    if (!s) setShowClosed(true);
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
  const[all,setAll]=useState<T[]>([]);
  const[loading,setLoading]=useState(true);
  const[fetchedAt,setFetchedAt]=useState('');
  const[marked,setMarked]=useState<string[]>([]);
  const[biz,setBiz]=useState('');
  const[pub,setPub]=useState('');
  const[maxD,setMaxD]=useState(365);
  const[showClosed,setShowClosed]=useState(false);
  const[showNoDate,setShowNoDate]=useState(true);
  const[sbOnly,setSbOnly]=useState(false);
  const[tab,setTab]=useState<'all'|'closing'|'new'>('all');
  const[q,setQ]=useState(()=>typeof window!=='undefined'?(new URLSearchParams(window.location.search).get('q')||''):'');
  const[pg,setPg]=useState(1);
  const[showFilters,setShowFilters]=useState(false);
  const PER=25;
  const isMobile=useIsMobile();
  const now=useMemo(()=>Date.now(),[]);

  useEffect(()=>{
    try{const m=JSON.parse(localStorage.getItem('markedTenders')||'[]');if(Array.isArray(m))setMarked(m);}catch(e){}
  },[]);
  const toggleMark=useCallback((id:string,e?:any)=>{if(e){e.preventDefault();e.stopPropagation();}setMarked(prev=>{const has=prev.includes(id);const next=has?prev.filter(x=>x!==id):[...prev,id];try{localStorage.setItem('markedTenders',JSON.stringify(next));}catch(err){}return next;});},[]);

  // מונע טעינות כפולות: ריצה אחת בו-זמנית (didLoad חוסם קריאה שנייה
  // בזמן שהראשונה עוד רצה, כולל double-mount של StrictMode).
  const loadingRef=useRef(false);
  const load=useCallback(async(force=false)=>{
        if(loadingRef.current&&!force)return;
        loadingRef.current=true;
        setLoading(true);
        try{
                const res:any=await fetchDedupedTenders();
                setAll(res.tenders);
                setFetchedAt(res.fetchedAt);
        }finally{setLoading(false);loadingRef.current=false;}
  },[]);
  useEffect(()=>{load();},[load]);

  const base=useMemo(()=>{
    let r=all;
    if(exemptView)r=r.filter(t=>isExempt(t.type,t.title));
    if(sbView)r=r.filter(t=>t.smallBiz&&(t.smallBizConfidence==='high'||t.smallBizConfidence==='medium'));
    if(biz)r=r.filter(t=>matchDomain(t,biz));
    if(pub)r=r.filter(t=>matchPublisher(t,pub));
    if(!showClosed)r=r.filter(t=>{const d=dl(t.deadline);return d===null||d>=0;});
    if(!showNoDate)r=r.filter(t=>!!t.deadline);
    r=r.filter(t=>{
      const d=dl(t.deadline);
      if(d!==null&&d<0)return showClosed; // פג מועד — רק בבקשה מפורשת
      if(d===null){
        // ללא מועד הגשה: מוצג רק אם פורסם בשנה האחרונה (חוסם רשומות
        // מוניציפליות עתיקות עם סטטוס "פתוח" שמעולם לא עודכן)
        if(!showNoDate)return false;
        const p=parseHeDate(t.publishDate);
        return p===null||p.getTime()>Date.now()-365*86400000;
      }
      return d<=maxD;
    });
    if(sbOnly)r=r.filter(t=>t.smallBiz&&(t.smallBizConfidence==='high'||t.smallBizConfidence==='medium'));
    if(q.trim())r=r.filter(t=>matchQuery(t,q));
    return r;
  },[all,biz,pub,maxD,showClosed,showNoDate,sbOnly,q]);

  const closing=useMemo(()=>base.filter(t=>{const d=dl(t.deadline);return d!==null&&d>=0&&d<=7;}),[base]);
  // TICKET-11: פרסור תאריך הפרסום דרך ה-utility הריכוזי בלבד
  const newT=useMemo(()=>base.filter(t=>{if(!t.publishDate)return false;const x=parseHeDate(t.publishDate);return x!==null&&x.getTime()>(now-7*86400000);}),[base,now]);
  const scoreOf=useCallback((t:T):number=>{
    if(bizProfile)return scoreTender(t,{categories:bizProfile.categories,region:bizProfile.region,publisher_type:bizProfile.publisher_type},now).display;
    return matchSc(biz,t);
  },[bizProfile,biz,now]);
  const shown=useMemo(()=>{
    const r=tab==='closing'?closing:tab==='new'?newT:base;
    if(bizProfile){
      // מחובר עם פרופיל עסקי: מיון לפי ציון התאמה, שובר שוויון — הדדליין הקרוב
      return [...r].sort((a,b)=>scoreOf(b)-scoreOf(a)||((dl(a.deadline)??9999)-(dl(b.deadline)??9999)));
    }
    return [...r].sort((a,b)=>(dl(a.deadline)??9999)-(dl(b.deadline)??9999));
  },[base,closing,newT,tab,bizProfile,scoreOf]);

  const tp=Math.ceil(shown.length/PER);
  const rows=shown.slice((pg-1)*PER,pg*PER);

  const activeCnt=useMemo(()=>all.filter(t=>{const d=dl(t.deadline);return d===null||d>=0;}).length,[all]);
  const exemptCnt=useMemo(()=>all.filter(t=>isExempt(t.type,t.title)).length,[all]);
  const sbCnt=useMemo(()=>all.filter(t=>t.smallBiz&&(t.smallBizConfidence==='high'||t.smallBizConfidence==='medium')).length,[all]);
  const sideNav=[
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
    const {domains,uncategorized}=domainCounts(all);
    for(const c of domains)opts.push({id:c.id,label:`${c.label} (${c.count.toLocaleString('he-IL')})`});
    if(uncategorized>0)opts.push({id:UNCATEGORIZED_ID,label:`${UNCATEGORIZED_LABEL} (${uncategorized.toLocaleString('he-IL')})`});
    return opts;
  },[all]);
  const smallBizCount=useMemo(()=>all.filter(t=>t.smallBiz&&(t.smallBizConfidence==='high'||t.smallBizConfidence==='medium')).length,[all]);
  const kpis=[
    {value:all.length,label:'מכרזים פעילים במאגר',dot:BLUE},
    {value:closing.length,label:'נסגרים בשבוע הקרוב',dot:'#b04a34'},
    {value:newT.length,label:'חדשים ב-7 ימים',dot:'#1e9e5a'},
    {value:smallBizCount,label:'⭐ העדפה לעסקים קטנים',dot:'#1e5aa8',onClick:()=>{setSbOnly(v=>!v);setPg(1);}},
    {value:base.length,label:'מוצגים כעת',dot:'#d9a520'},
  ] as {value:number,label:string,dot:string,onClick?:()=>void}[];
  const chip:React.CSSProperties={background:'#fff',color:'#5b6b7a',fontWeight:600,fontSize:13,padding:'8px 15px',borderRadius:7,border:'1px solid #e2e7ec',cursor:'pointer'};
  const selWrap:React.CSSProperties={position:'relative'};
  const selStyle:React.CSSProperties={background:'#fff',color:'#5b6b7a',fontWeight:600,fontSize:13,padding:'8px 30px 8px 15px',borderRadius:7,border:'1px solid #e2e7ec',cursor:'pointer',appearance:'none',WebkitAppearance:'none',fontFamily:'inherit'};

  return(
    <div style={{minHeight:'100vh',background:'#eef1f4',fontFamily:"'Assistant','Rubik',Arial,sans-serif",direction:'rtl',color:DARK,padding:'0'}}>
      <div style={{display:'flex',minHeight:'100vh',background:'#f6f8fa'}}>

        {/* ===== SIDEBAR ===== */}
        <div style={{flex:'0 0 238px',background:'#fff',borderInlineEnd:`1px solid ${BORDER}`,padding:'22px 16px',display:isMobile?'none':'flex',flexDirection:'column',gap:3,position:'sticky',top:0,alignSelf:'flex-start',height:'100vh'}}>
          <a href="/dashboard" style={{display:'flex',alignItems:'center',gap:11,padding:'0 8px 20px',marginBottom:8,borderBottom:'1px solid #eef1f4',textDecoration:'none'}}>
            <div style={{width:34,height:34,borderRadius:8,background:BLUE,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:16,fontWeight:800}}>ש</div>
            <div style={{lineHeight:1.15}}><div style={{fontWeight:700,fontSize:15.5,color:DARK}}>שווה מכרזים</div><div style={{fontSize:11,color:'#8a97a3'}}>מועדון עסקים 360</div></div>
          </a>
          {sideNav.map(s=>(
            <a key={s.label} href={s.href} style={{display:'flex',alignItems:'center',gap:11,padding:'11px 12px',borderRadius:9,fontSize:14.5,textDecoration:'none',
              fontWeight:s.active?700:500,
              background:s.active?'#e8f1fb':'transparent',
              color:s.active?'#1e5aa8':'#5b6b7a',
              borderInlineStart:s.active?`3px solid ${BLUE}`:'3px solid transparent'}}>
              <span style={{fontSize:16,opacity:s.active?1:.65}}>{s.icon}</span>
              <span style={{flex:1}}>{s.label}</span>
              {'count' in s&&(s as any).count>0&&(
                <span style={{fontSize:11,fontWeight:700,color:s.active?'#1e5aa8':'#8a97a3',background:s.active?'#fff':'#eef1f4',borderRadius:999,padding:'1px 8px'}}>
                  {((s as any).count as number).toLocaleString('he-IL')}
                </span>
              )}
            </a>
          ))}
          <div style={{marginTop:'auto',border:`1px solid ${BORDER}`,borderRadius:12,padding:16}}>
            <div style={{fontWeight:700,fontSize:14,color:DARK}}>◈ הסוכן החכם</div>
            <div style={{fontSize:12,color:MUTED,margin:'7px 0 12px',lineHeight:1.5}}>קבלו מכרזים מותאמים לפי הפרופיל העסקי שלכם</div>
            <a href="/agent" style={{display:'block',background:DARK,color:'#fff',fontWeight:600,fontSize:13,textAlign:'center',padding:9,borderRadius:8,textDecoration:'none'}}>הפעלה</a>
          </div>
          <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${BORDER}`}}>
            {session ? (
              <div>
                <div style={{fontSize:11.5,color:'#8a97a3',marginBottom:8,wordBreak:'break-all'}}>{session.user.email}</div>
                <button type="button" onClick={handleSignOut} style={{width:'100%',padding:'8px 12px',borderRadius:9,border:'1px solid #e2e7ec',background:'#fff',color:'#5b6b7a',fontSize:12.5,fontWeight:600,cursor:'pointer'}}>התנתקות</button>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <a href="/signin" style={{display:'block',textAlign:'center',padding:'9px 12px',borderRadius:9,border:'1px solid #e2e7ec',background:'#fff',color:DARK,fontSize:12.5,fontWeight:600,textDecoration:'none'}}>התחברות</a>
                <a href="/signup" style={{display:'block',textAlign:'center',padding:'9px 12px',borderRadius:9,border:'none',background:BLUE,color:'#fff',fontSize:12.5,fontWeight:700,textDecoration:'none'}}>הרשמה</a>
              </div>
            )}
          </div>
        </div>

        {/* ===== CONTENT ===== */}
        <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',...(isMobile?{paddingBottom:72}:{})}}>
          {/* header */}
          <div style={{background:'#fff',borderBottom:`1px solid ${BORDER}`,padding:isMobile?'12px 14px':'15px 26px',display:'flex',alignItems:'center',gap:isMobile?10:18,position:'sticky',top:0,zIndex:5}}>
            {isMobile && <MobileMenu/>}
            <div style={{fontWeight:700,fontSize:isMobile?16:20,color:DARK,flex:'0 0 auto'}}>{exemptView?'מכרזים פטורים':sbView?'העדפה לעסקים קטנים':'גילוי מכרזים'}</div>
            <div style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:10,background:'#fff',border:'1.5px solid '+BLUE,borderRadius:10,padding:'12px 16px',maxWidth:520,boxShadow:'0 2px 10px rgba(43,111,196,0.12)'}}>
              <span style={{color:BLUE,fontSize:17,fontWeight:700}}>⌕</span>
              <input value={q} onChange={e=>{setQ(e.target.value);setPg(1);}} placeholder="חיפוש: נושא, גוף מפרסם, מספר מכרז…" style={{flex:1,border:'none',outline:'none',background:'transparent',fontSize:14.5,color:DARK,fontFamily:'inherit'}}/>
              {q&&<span onClick={()=>{setQ('');setPg(1);}} style={{color:'#9aa6b2',cursor:'pointer',fontSize:15}}>✕</span>}
            </div>
            {!isMobile && (<>
<span style={{marginInlineStart:'auto',fontSize:12.5,color:'#7a8794',display:'inline-flex',alignItems:'center',gap:7,flex:'0 0 auto'}}>
              <span style={{width:7,height:7,borderRadius:999,background:BLUE}}></span>
              {loading?(<><style>{`@keyframes dashSpin{to{transform:rotate(360deg);}}`}</style><span style={{display:'inline-flex',alignItems:'center',gap:6}}><span style={{width:9,height:9,border:'2px solid '+BORDER,borderTopColor:BLUE,borderRadius:'50%',display:'inline-block',animation:'dashSpin 0.7s linear infinite'}}/>טוען…</span></>):`נסרק ${new Date(fetchedAt||Date.now()).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'})} ${new Date(fetchedAt||Date.now()).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})} · `}
              <a href="https://data.gov.il" target="_blank" rel="noopener noreferrer" style={{color:'#7a8794'}}>data.gov.il</a>
            </span>
            <a href="/agent" style={{background:BLUE,color:'#fff',fontWeight:600,fontSize:13,padding:'9px 16px',borderRadius:8,textDecoration:'none',flex:'0 0 auto'}}>✦ תובנות AI</a>
</>)}
            <a href="/profile" style={{width:32,height:32,borderRadius:8,background:'#eef1f4',color:DARK,display:'inline-flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,textDecoration:'none',flex:'0 0 auto'}}>א</a>
          </div>
          {isMobile && !loading && (
            <div style={{background:'#fff',borderBottom:`1px solid ${BORDER}`,padding:'6px 14px',fontSize:11.5,color:'#7a8794',display:'flex',alignItems:'center',gap:6}}>
              <span style={{width:6,height:6,borderRadius:999,background:BLUE,display:'inline-block'}}></span>
              נסרק לאחרונה: {new Date(fetchedAt||Date.now()).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'})} בשעה {new Date(fetchedAt||Date.now()).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}
            </div>
          )}

          <div style={{padding:'22px 26px 30px'}}>
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
              {[{k:'all',label:`כל המכרזים · ${base.length.toLocaleString()}`},{k:'closing',label:`נסגרים בשבוע · ${closing.length}`},{k:'new',label:`חדשים · ${newT.length}`}].map(tb=>{
                const active=tab===tb.k;
                return(
                  <button key={tb.k} onClick={()=>{setTab(tb.k as any);setPg(1);}} style={{...chip,background:active?DARK:'#fff',color:active?'#fff':'#5b6b7a',border:active?'none':'1px solid #e2e7ec'}}>{tb.label}</button>
                );
              })}
              <div style={{...selWrap,marginInlineStart:'auto'}}>
                <select value={biz} onChange={e=>{setBiz(e.target.value);setPg(1);}} style={selStyle}>{bizOptions.map(b=><option key={b.id} value={b.id}>{b.label}</option>)}</select>
                <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:10,color:'#9aa6b2',pointerEvents:'none'}}>▾</span>
              </div>
              <div style={selWrap}>
                <select value={pub} onChange={e=>{setPub(e.target.value);setPg(1);}} style={selStyle}>{PUBS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select>
                <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:10,color:'#9aa6b2',pointerEvents:'none'}}>▾</span>
              </div>
              <button onClick={()=>setShowFilters(v=>!v)} style={{...chip,padding:'8px 12px',background:showFilters?'#e8f1fb':'#fff',color:showFilters?'#1e5aa8':'#5b6b7a',borderColor:showFilters?'#cfe0f4':'#e2e7ec'}}>⇅ סינון</button>
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
                <button onClick={()=>{setBiz('');setPub('');setMaxD(365);setShowClosed(false);setShowNoDate(true);setSbOnly(false);setQ('');setPg(1);}} style={{...chip,marginInlineStart:'auto'}}>איפוס ✕</button>
              </div>
            )}

            {/* table */}
            <div style={{background:'#fff',border:`1px solid ${BORDER}`,borderRadius:10,overflow:'hidden'}}>
              {!isMobile && (<div style={{display:'grid',gridTemplateColumns:'70px 1fr 232px 156px 150px',padding:'12px 18px',background:'#f7f9fb',borderBottom:`1px solid ${BORDER}`,fontSize:12,fontWeight:700,color:'#8a97a3'}}>
                <span>ציון</span><span>נושא המכרז</span><span>סטטוס</span><span>מועד הגשה</span><span></span>
              </div>)}
              {loading?(
                                <div style={{padding:50,textAlign:'center',color:MUTED,fontSize:14}}>טוען מכרזים מ-10 מקורות…</div>
              ):rows.length===0?(
                <div style={{padding:50,textAlign:'center',color:MUTED,fontSize:14}}>לא נמצאו מכרזים התואמים לסינון</div>
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
                    {tags.map((g,gi)=>(<span key={gi} style={{fontSize:11,fontWeight:600,padding:'3px 9px',borderRadius:6,background:g.bg,color:g.fg,border:`1px solid ${g.bd}`}}>{g.label}</span>))}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,flex:'0 0 auto'}}>
                    <span style={{fontSize:22,fontWeight:700,color:DARK,lineHeight:1}}>{score}</span>
                    <span style={{width:26,height:3,borderRadius:2,background:bandColor(score)}}></span>
                  </div>
                </div>
                <div style={{fontSize:15,fontWeight:700,color:DARK,lineHeight:1.45,textAlign:'right'}}>{t.title||'ללא כותרת'}</div>
                <div style={{fontSize:12,color:'#7a8794',marginTop:8}}>{t.publisher||'לא ידוע'} · פורסם {fd(t.publishDate)}</div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:13,paddingTop:12,borderTop:'1px solid #eef1f4'}}>
                  <div style={{fontSize:12.5}}>
                    <span style={{color:'#7a8794'}}>הגשה עד </span>
                    <span style={{color:DARK,fontWeight:700}}>{isExempt(t.type,t.title)?<span style={{color:'#8a5db8',background:'#f3ecfb',borderRadius:6,padding:'2px 8px',fontSize:12,fontWeight:600}}>פטור</span>:fd(t.deadline)}</span>
                    {d!==null&&d>=0&&<span style={{color:d<=7?'#b04a34':'#7a8794'}}> · נותרו {d} ימים</span>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:12,fontWeight:600,color:'#1e5aa8',background:'#e8f1fb',border:'1px solid #cfe0f4',borderRadius:7,padding:'5px 11px',whiteSpace:'nowrap'}}>פרטי המכרז ←</span>
                    <button onClick={(e)=>toggleMark(t.id,e)} style={{fontSize:18,color:isMarked?'#d9a520':'#c2ccd6',background:'transparent',border:'none',cursor:'pointer',padding:6}}>{isMarked?'★':'☆'}</button>
                  </div>
                </div>
              </a>
            ) : (
              <div key={t.id||i} style={{display:'grid',gridTemplateColumns:'70px 1fr 232px 156px 150px',padding:'16px 18px',borderBottom:'1px solid #eef1f4',alignItems:'center'}}>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:5}}>
                      <span style={{fontSize:21,fontWeight:700,color:DARK,lineHeight:1}}>{score}</span>
                      <span style={{width:30,height:3,borderRadius:2,background:bandColor(score)}}></span>
                    </div>
                    <div style={{minWidth:0,paddingInlineEnd:16}}>
                      {t.url||t.id
                        ?<a href={`/tender/${t.id}`} style={{fontSize:15,fontWeight:600,color:DARK,lineHeight:1.4,textDecoration:'none',display:'block'}}>{t.title||'ללא כותרת'}</a>
                        :<div style={{fontSize:15,fontWeight:600,color:DARK,lineHeight:1.4}}>{t.title||'ללא כותרת'}</div>}
                      <div style={{fontSize:12.5,color:'#7a8794',marginTop:5}}>{t.publisher||'לא ידוע'} · פורסם {fd(t.publishDate)}</div>
                    </div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {tags.map((g,gi)=>(<span key={gi} style={{fontSize:11.5,fontWeight:600,padding:'3px 10px',borderRadius:6,background:g.bg,color:g.fg,border:`1px solid ${g.bd}`}}>{g.label}</span>))}
                    </div>
                    <div style={{fontSize:13}}>
                      <div style={{color:DARK,fontWeight:600}}>{isExempt(t.type,t.title)?<span style={{color:'#8a5db8',background:'#f3ecfb',borderRadius:6,padding:'2px 8px',fontSize:12,fontWeight:600}}>פטור</span>:fd(t.deadline)}</div>
                      {d!==null&&d>=0&&<div style={{color:d<=7?'#b04a34':'#7a8794',fontSize:12,marginTop:3}}>נותרו {d} ימים</div>}
                    </div>
                    <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:6}}>
                      <a href={`/tender/${t.id}`} style={{fontSize:12,fontWeight:600,color:'#1e5aa8',background:'#e8f1fb',border:'1px solid #cfe0f4',borderRadius:7,padding:'5px 11px',textDecoration:'none',whiteSpace:'nowrap'}}>פרטים</a>
                      <button onClick={(e)=>toggleMark(t.id,e)} title={isMarked?'הסר סימון':'סמן מכרז'} style={{fontSize:16,lineHeight:1,color:isMarked?'#d9a520':'#c2ccd6',background:'transparent',border:'none',cursor:'pointer',padding:6}}>{isMarked?'★':'☆'}</button>
                    </div>
                  </div>
            )
                );
              })}
            </div>

            {/* pagination */}
            {!loading&&tp>1&&(
              <div style={{display:'flex',gap:6,justifyContent:'center',marginTop:20,flexWrap:'wrap'}}>
                <button onClick={()=>setPg(1)} disabled={pg===1} style={{...chip,opacity:pg===1?.5:1}}>ראשון</button>
                <button onClick={()=>setPg(p=>Math.max(1,p-1))} disabled={pg===1} style={{...chip,opacity:pg===1?.5:1}}>◀</button>
                {(()=>{const win=Math.min(7,tp);let start=Math.max(1,pg-3);if(start+win-1>tp)start=Math.max(1,tp-win+1);return Array.from({length:win},(_,i)=>start+i).filter(p=>p>=1&&p<=tp).map(p=>(<button key={p} onClick={()=>setPg(p)} style={{...chip,background:p===pg?DARK:'#fff',color:p===pg?'#fff':'#5b6b7a',border:p===pg?'none':'1px solid #e2e7ec',fontWeight:700}}>{p}</button>));})()}
                <button onClick={()=>setPg(p=>Math.min(tp,p+1))} disabled={pg===tp} style={{...chip,opacity:pg===tp?.5:1}}>▶</button>
                <button onClick={()=>setPg(tp)} disabled={pg===tp} style={{...chip,opacity:pg===tp?.5:1}}>אחרון</button>
              </div>
            )}
            <div style={{textAlign:'center',padding:'16px 0',color:'#9aa6b2',fontSize:12}}>
              נתונים: <a href="https://next.obudget.org" target="_blank" rel="noopener noreferrer" style={{color:BLUE}}>BudgetKey</a> · מינהל הרכש הממשלתי · עדכון יומי ב-06:00
            </div>
          </div>
        </div>
      </div>
      {isMobile && <MobileTabBar/>}
    </div>
  );
}
