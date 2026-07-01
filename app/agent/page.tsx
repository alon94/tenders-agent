"use client";
import { useState, useEffect, useMemo } from "react";
import SiteNav from "../components/SiteNav";

interface Tender { id:string; title?:string; publisher?:string; publishDate?:string; deadline?:string; status?:string; url?:string; type?:string; }

const NAVY="#0b2e52",BLUE="#2e86de",PURPLE="#7c5cf0",MUTED="#64778a";
const RBK="Rubik,'Assistant',Arial,sans-serif";

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
    <div style={{minHeight:'100vh',background:'#e9f3fc',fontFamily:"'Assistant',Arial,sans-serif",direction:'rtl',color:NAVY}}>
      <SiteNav active="/agent"/>
      <div style={{maxWidth:900,margin:'0 auto',padding:'28px 16px 40px'}}>
        {/* AI hero */}
        <div style={{background:'linear-gradient(135deg,#7c5cf0,#b44be8)',borderRadius:22,padding:'24px 26px',color:'#fff',marginBottom:22}}>
          <div style={{fontFamily:RBK,fontSize:24,fontWeight:800,display:'flex',alignItems:'center',gap:10}}>✦ הסוכן החכם</div>
          <div style={{fontSize:14,opacity:.9,marginTop:6}}>כל מה שהסוכן מצא עבור התאריך הנבחר</div>
        </div>
        {loading?(<div style={{color:MUTED}}>הסוכן סורק מכרזים...</div>):(
          <>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20,background:'#fff',padding:'16px 20px',borderRadius:18,boxShadow:'0 10px 28px rgba(11,46,82,.05)',flexWrap:'wrap'}}>
              <label style={{fontSize:14,fontWeight:700,color:'#33475b'}}>בחרו תאריך:</label>
              <div style={{position:'relative'}}>
                <select value={date} onChange={e=>setDate(e.target.value)} style={{padding:'10px 14px',paddingLeft:34,borderRadius:12,border:'1px solid #e2ecf6',background:'#f2f7fc',color:'#33475b',fontSize:14,appearance:'none' as const,WebkitAppearance:'none' as const,fontFamily:'inherit'}}>
                  {dateOptions.map(d=>(<option key={d} value={d}>{d}</option>))}
                </select>
                <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:11,color:'#9fb2c6',pointerEvents:'none'}}>▾</span>
              </div>
              <span style={{marginInlineStart:'auto',background:'#e3f6ea',color:'#1e9e5a',borderRadius:999,padding:'7px 16px',fontSize:13,fontWeight:700}}>נמצאו {dayItems.length} מכרזים</span>
            </div>
            {dayItems.length===0?(
              <div style={{background:'#fff',borderRadius:20,padding:40,color:MUTED,textAlign:'center',boxShadow:'0 10px 28px rgba(11,46,82,.05)'}}>הסוכן לא מצא מכרזים לתאריך זה.</div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                {dayItems.map(t=>(
                  <div key={t.id} style={{background:'#fff',borderRadius:20,padding:'20px 22px',boxShadow:'0 10px 28px rgba(11,46,82,.05)',borderInlineEnd:`4px solid ${BLUE}`,textAlign:'right'}}>
                    <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'flex-end',marginBottom:12}}>
                      {t.status&&<span style={{fontSize:12.5,fontWeight:700,padding:'5px 12px',borderRadius:999,background:'#fcf2d0',color:'#b78a18'}}>{t.status}</span>}
                      <span style={{fontSize:12.5,fontWeight:700,padding:'5px 12px',borderRadius:999,background:'#e1effb',color:'#1f73c4'}}>{t.publisher||'לא ידוע'}</span>
                    </div>
                    <a href={`/tender/${t.id}`} style={{fontFamily:RBK,fontSize:19,fontWeight:600,color:NAVY,lineHeight:1.4,textDecoration:'none',display:'block'}}>{t.title||'ללא כותרת'}</a>
                    {t.deadline&&<div style={{fontSize:13,color:MUTED,marginTop:12}}>⏱ מועד אחרון: <b style={{color:'#33475b'}}>{t.deadline}</b></div>}
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
