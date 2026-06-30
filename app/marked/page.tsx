"use client";
import { useState, useEffect } from "react";

interface Tender { id:string; title?:string; publisher?:string; publishDate?:string; deadline?:string; status?:string; url?:string; type?:string; }

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
    <div style={{minHeight:'100vh',background:'#f0f4f8',fontFamily:'Heebo,Arial,sans-serif',direction:'rtl'}}>
      <nav style={{background:'linear-gradient(90deg,#1a56a0,#2d8ef5)',color:'white',padding:'0 16px',display:'flex',alignItems:'center',height:50,boxShadow:'0 2px 6px rgba(0,0,0,0.2)',gap:0}}>
        <a href='/dashboard' style={{fontWeight:900,fontSize:19,marginLeft:12,whiteSpace:'nowrap',color:'white',textDecoration:'none'}}>שווה מכרזים</a>
        <span style={{background:'rgba(255,255,255,0.18)',borderRadius:4,padding:'1px 7px',fontSize:10,marginLeft:20,whiteSpace:'nowrap'}}>מודל בטון שווה ביזנס 360</span>
        {[{l:'גילוי מכרזים',h:'/dashboard'},{l:'מכרזים מסומנים',h:'/marked'},{l:'סוכן חכם',h:'/agent'},{l:'ערבויות וליווי',h:'/guarantee'},{l:'מקורות',h:'/dashboard'}].map((it)=>(
          <a key={it.l} href={it.h} style={{padding:'0 12px',fontSize:13,cursor:'pointer',height:50,display:'flex',alignItems:'center',borderBottom:it.h==='/marked'?'3px solid white':'3px solid transparent',color:it.h==='/marked'?'white':'rgba(255,255,255,0.8)',whiteSpace:'nowrap',textDecoration:'none'}}>{it.l}</a>
        ))}
        <a href='/profile' style={{marginRight:'auto',width:28,height:28,borderRadius:'50%',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'white',textDecoration:'none'}}>א</a>
      </nav>
      <div style={{maxWidth:900,margin:'0 auto',padding:'24px 16px'}}>
        <h1 style={{fontSize:24,fontWeight:800,color:'#1a56a0',marginBottom:16}}>★ מכרזים מסומנים</h1>
        {loading?(<div style={{color:'#6b7280'}}>טוען...</div>):items.length===0?(
          <div style={{background:'white',borderRadius:10,padding:24,color:'#6b7280',textAlign:'center'}}>אין מכרזים מסומנים עדיין. סמן מכרזים בדף הבית כדי לראות אותם כאן.</div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {items.map(t=>(
              <div key={t.id} style={{background:'white',borderRadius:10,padding:'14px 16px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',borderRight:'4px solid #f59e0b',position:'relative'}}>
                <button onClick={()=>unmark(String(t.id))} title='הסר מסימונים' style={{position:'absolute',top:10,left:10,background:'none',border:'none',cursor:'pointer',fontSize:18,color:'#f59e0b'}}>★</button>
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
      </div>
    </div>
  );
}
