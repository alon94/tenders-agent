"use client";
import { useState, useEffect, useMemo } from "react";

interface Tender { id:string; title?:string; publisher?:string; publishDate?:string; deadline?:string; status?:string; url?:string; type?:string; }

export default function AgentPage(){
  const [items,setItems]=useState<Tender[]>([]);
  const [loading,setLoading]=useState(true);
  const [date,setDate]=useState<string>("");
  useEffect(()=>{
    fetch("/api/tenders?offset=0").then(r=>r.json()).then(d=>{
      const all:Tender[]=(d&&d.tenders)?d.tenders:[];
      setItems(all);
      const dates=all.map(t=>(t.publishDate||"").slice(0,10)).filter(Boolean).sort();
      if(dates.length)setDate(dates[dates.length-1]);
      setLoading(false);
    }).catch(()=>setLoading(false));
  },[]);
  const dateOptions=useMemo(()=>{
    const set=new Set<string>();
    items.forEach(t=>{const d=(t.publishDate||"").slice(0,10);if(d)set.add(d);});
    return Array.from(set).sort().reverse();
  },[items]);
  const dayItems=useMemo(()=>items.filter(t=>(t.publishDate||"").slice(0,10)===date),[items,date]);
  return(
    <div style={{minHeight:'100vh',background:'#f0f4f8',fontFamily:'Heebo,Arial,sans-serif',direction:'rtl'}}>
      <nav style={{background:'linear-gradient(90deg,#1a56a0,#2d8ef5)',color:'white',padding:'0 16px',display:'flex',alignItems:'center',height:50,boxShadow:'0 2px 6px rgba(0,0,0,0.2)',gap:0}}>
        <a href='/dashboard' style={{fontWeight:900,fontSize:19,marginLeft:12,whiteSpace:'nowrap',color:'white',textDecoration:'none'}}>שווה מכרזים</a>
        <span style={{background:'rgba(255,255,255,0.18)',borderRadius:4,padding:'1px 7px',fontSize:10,marginLeft:20,whiteSpace:'nowrap'}}>מודל בטון שווה ביזנס 360</span>
        {[{l:'גילוי מכרזים',h:'/dashboard'},{l:'מכרזים מסומנים',h:'/marked'},{l:'סוכן חכם',h:'/agent'},{l:'ערבויות וליווי',h:'/guarantee'},{l:'מקורות',h:'/dashboard'}].map((it)=>(
          <a key={it.l} href={it.h} style={{padding:'0 12px',fontSize:13,cursor:'pointer',height:50,display:'flex',alignItems:'center',borderBottom:it.h==='/agent'?'3px solid white':'3px solid transparent',color:it.h==='/agent'?'white':'rgba(255,255,255,0.8)',whiteSpace:'nowrap',textDecoration:'none'}}>{it.l}</a>
        ))}
        <a href='/profile' style={{marginRight:'auto',width:28,height:28,borderRadius:'50%',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'white',textDecoration:'none'}}>א</a>
      </nav>
      <div style={{maxWidth:900,margin:'0 auto',padding:'24px 16px'}}>
        <h1 style={{fontSize:24,fontWeight:800,color:'#1a56a0',marginBottom:4}}>🤖 סוכן חכם</h1>
        <div style={{color:'#6b7280',fontSize:14,marginBottom:16}}>כל מה שהסוכן מצא עבור התאריך הנבחר</div>
        {loading?(<div style={{color:'#6b7280'}}>הסוכן סורק מכרזים...</div>):(
          <>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,background:'white',padding:'12px 14px',borderRadius:10,boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
              <label style={{fontSize:14,fontWeight:600,color:'#374151'}}>בחר תאריך:</label>
              <select value={date} onChange={e=>setDate(e.target.value)} style={{padding:'6px 10px',borderRadius:6,border:'1px solid #d1d5db',fontSize:14}}>
                {dateOptions.map(d=>(<option key={d} value={d}>{d}</option>))}
              </select>
              <span style={{marginRight:'auto',background:'#dcfce7',color:'#166534',borderRadius:20,padding:'4px 12px',fontSize:13,fontWeight:700}}>נמצאו {dayItems.length} מכרזים</span>
            </div>
            {dayItems.length===0?(
              <div style={{background:'white',borderRadius:10,padding:24,color:'#6b7280',textAlign:'center'}}>הסוכן לא מצא מכרזים לתאריך זה.</div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {dayItems.map(t=>(
                  <div key={t.id} style={{background:'white',borderRadius:10,padding:'14px 16px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',borderRight:'4px solid #2d8ef5'}}>
                    <div style={{display:'flex',gap:6,marginBottom:6,flexWrap:'wrap',alignItems:'center'}}>
                      <span style={{background:'#dbeafe',color:'#1d4ed8',borderRadius:4,padding:'2px 7px',fontSize:11,fontWeight:600}}>{t.publisher||''}</span>
                      {t.status&&<span style={{color:'#6b7280',fontSize:12}}>{t.status}</span>}
                    </div>
                    <a href={`/tender/${t.id}`} style={{color:'#1d4ed8',textDecoration:'none',fontWeight:700,fontSize:16,display:'block',marginBottom:6}}>{t.title||''}</a>
                    <div style={{fontSize:12,color:'#6b7280'}}>{t.deadline?('מועד אחרון: '+t.deadline):''}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
