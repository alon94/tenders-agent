"use client";
import { useState, useEffect } from "react";
import SiteNav from "../components/SiteNav";

interface Tender { id:string; title?:string; publisher?:string; publishDate?:string; deadline?:string; status?:string; url?:string; type?:string; }

const NAVY="#0b2e52",BLUE="#2e86de",MUTED="#64778a",GOLD="#b78a18";
const RBK="Rubik,'Assistant',Arial,sans-serif";

export default function MarkedPage(){
  const [items,setItems]=useState<Tender[]>([]);
  const [loading,setLoading]=useState(true);
  const [marked,setMarked]=useState<string[]>([]);
  useEffect(()=>{
    let ids:string[]=[];
    try{const m=JSON.parse(localStorage.getItem("markedTenders")||"[]");if(Array.isArray(m))ids=m;}catch(e){}
    setMarked(ids);
    if(ids.length===0){setLoading(false);return;}
    fetch("/api/tenders?offset=0").then(r=>r.json()).then(d=>{
      const all:Tender[]=(d&&d.tenders)?d.tenders:[];
      setItems(all.filter(t=>ids.includes(String(t.id))));
      setLoading(false);
    }).catch(()=>setLoading(false));
  },[]);
  function unmark(id:string){
    const next=marked.filter(x=>x!==id);
    setMarked(next);
    try{localStorage.setItem("markedTenders",JSON.stringify(next));}catch(e){}
    setItems(prev=>prev.filter(t=>String(t.id)!==id));
  }
  return(
    <div style={{minHeight:'100vh',background:'#e9f3fc',fontFamily:"'Assistant',Arial,sans-serif",direction:'rtl',color:NAVY}}>
      <SiteNav active="/marked"/>
      <div style={{maxWidth:900,margin:'0 auto',padding:'28px 16px 40px'}}>
        <h1 style={{fontFamily:RBK,fontSize:26,fontWeight:800,color:NAVY,marginBottom:6}}>★ מכרזים מסומנים</h1>
        <div style={{color:MUTED,fontSize:14,marginBottom:22}}>המכרזים ששמרת לעיון מאוחר יותר</div>
        {loading?(<div style={{color:MUTED}}>טוען...</div>):items.length===0?(
          <div style={{background:'#fff',borderRadius:20,padding:40,color:MUTED,textAlign:'center',boxShadow:'0 10px 28px rgba(11,46,82,.05)'}}>אין מכרזים מסומנים עדיין. סמנו מכרזים בדף הבית כדי לראותם כאן.</div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {items.map(t=>(
              <div key={t.id} style={{background:'#fff',borderRadius:20,padding:'20px 22px',boxShadow:'0 10px 28px rgba(11,46,82,.05)',borderInlineEnd:'4px solid #f0932b',display:'flex',gap:20,alignItems:'flex-start'}}>
                <div style={{flex:1,minWidth:0,textAlign:'right'}}>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'flex-end',marginBottom:12}}>
                    {t.status&&<span style={{fontSize:12.5,fontWeight:700,padding:'5px 12px',borderRadius:999,background:'#fcf2d0',color:GOLD}}>{t.status}</span>}
                    <span style={{fontSize:12.5,fontWeight:700,padding:'5px 12px',borderRadius:999,background:'#e1effb',color:'#1f73c4'}}>{t.publisher||'לא ידוע'}</span>
                  </div>
                  <a href={`/tender/${t.id}`} style={{fontFamily:RBK,fontSize:19,fontWeight:600,color:NAVY,lineHeight:1.4,textDecoration:'none',display:'block'}}>{t.title||'ללא כותרת'}</a>
                  {t.deadline&&<div style={{fontSize:13,color:MUTED,marginTop:12}}>⏱ מועד אחרון: <b style={{color:'#33475b'}}>{t.deadline}</b></div>}
                </div>
                <button onClick={()=>unmark(String(t.id))} title="הסר מסימונים" style={{flex:'0 0 auto',fontSize:12,fontWeight:700,color:GOLD,background:'#fcf2d0',padding:'8px 14px',borderRadius:999,border:'none',cursor:'pointer',whiteSpace:'nowrap'}}>★ הסר</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
