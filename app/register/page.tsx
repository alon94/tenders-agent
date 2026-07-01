'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const NAVY="#0b2e52",BLUE="#2e86de",LIME="#cdef4a",GREEN="#1e9e5a",MUTED="#64778a";
const RBK="Rubik,'Assistant',Arial,sans-serif";

type FormData = {
  businessName: string; ownerName: string; email: string; phone: string;
  category: string; region: string; employees: string; notification: string;
};

const cats = ['טכנולוגיה','בנייה','בריאות','חינוך','ניקיון ותחזוקה','מזון','בטיחות','סביבה','אחר'];
const regs = ['כל הארץ','צפון','מרכז','דרום','ירושלים','חיפה'];

const field={width:'100%',border:'1px solid #e2ecf6',background:'#f2f7fc',borderRadius:12,padding:'12px 14px',fontSize:15,color:'#33475b',boxSizing:'border-box' as const,fontFamily:'inherit',outline:'none'};
const selField={...field,appearance:'none' as const,WebkitAppearance:'none' as const};
const label={display:'block',fontSize:13,fontWeight:600,color:MUTED,marginBottom:6};

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormData>({
    businessName: '', ownerName: '', email: '', phone: '',
    category: '', region: '', employees: '', notification: 'whatsapp',
  });
  const upd = (f: keyof FormData, v: string) => setForm((p) => ({ ...p, [f]: v }));
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      if (res.ok) router.push('/dashboard');
      else { const d = await res.json(); alert(d.error || 'Error'); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  const btnPrimary={flex:1,background:NAVY,color:'#fff',fontWeight:700,padding:'13px',borderRadius:12,border:'none',cursor:'pointer',fontSize:15,fontFamily:RBK};
  const btnGhost={flex:1,background:'#fff',color:'#5b7085',fontWeight:600,padding:'13px',borderRadius:12,border:'1px solid #e2ecf6',cursor:'pointer',fontSize:15};

  return (
    <main style={{minHeight:'100vh',background:'#e9f3fc',display:'flex',alignItems:'center',justifyContent:'center',padding:16,direction:'rtl',fontFamily:"'Assistant',Arial,sans-serif",color:NAVY}}>
      <div style={{background:'#fff',borderRadius:24,boxShadow:'0 24px 60px rgba(11,46,82,.14)',padding:32,width:'100%',maxWidth:440}}>
        {/* brand */}
        <div style={{display:'flex',alignItems:'center',gap:10,justifyContent:'center',marginBottom:24}}>
          <div style={{width:38,height:38,borderRadius:12,background:'linear-gradient(135deg,#2e86de,#1a5fa8)',display:'flex',alignItems:'center',justifyContent:'center',color:LIME,fontSize:20}}>↻</div>
          <div style={{fontFamily:RBK,fontWeight:800,fontSize:24,color:NAVY,letterSpacing:'-.5px'}}>שווה<span style={{color:BLUE}}>מכרזים</span></div>
        </div>
        {/* progress */}
        <div style={{display:'flex',gap:8,marginBottom:28}}>
          {[1,2,3].map((n) => (<div key={n} style={{flex:1,height:6,borderRadius:999,background:step>=n?BLUE:'#e2ecf6'}}/>))}
        </div>

        {step === 1 && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <h2 style={{fontFamily:RBK,fontSize:22,fontWeight:700,margin:'0 0 4px'}}>פרטי עסק</h2>
            <div><label style={label}>שם עסק</label><input type="text" value={form.businessName} onChange={(e)=>upd('businessName',e.target.value)} style={field}/></div>
            <div><label style={label}>שם בעלים</label><input type="text" value={form.ownerName} onChange={(e)=>upd('ownerName',e.target.value)} style={field}/></div>
            <div><label style={label}>אימייל</label><input type="email" value={form.email} onChange={(e)=>upd('email',e.target.value)} style={field}/></div>
            <div><label style={label}>טלפון</label><input type="tel" value={form.phone} onChange={(e)=>upd('phone',e.target.value)} style={field}/></div>
            <button onClick={()=>setStep(2)} disabled={!form.businessName||!form.email||!form.phone} style={{...btnPrimary,background:(!form.businessName||!form.email||!form.phone)?'#c9d6e3':NAVY,cursor:(!form.businessName||!form.email||!form.phone)?'default':'pointer'}}>המשך</button>
          </div>
        )}

        {step === 2 && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <h2 style={{fontFamily:RBK,fontSize:22,fontWeight:700,margin:'0 0 4px'}}>פרופיל עסקי</h2>
            <div><label style={label}>תחום עסק</label>
              <div style={{position:'relative'}}>
                <select value={form.category} onChange={(e)=>upd('category',e.target.value)} style={selField}>
                  <option value="">בחרו...</option>{cats.map((c)=><option key={c} value={c}>{c}</option>)}
                </select>
                <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:11,color:'#9fb2c6',pointerEvents:'none'}}>▾</span>
              </div>
            </div>
            <div><label style={label}>אזור</label>
              <div style={{position:'relative'}}>
                <select value={form.region} onChange={(e)=>upd('region',e.target.value)} style={selField}>
                  <option value="">בחרו...</option>{regs.map((r)=><option key={r} value={r}>{r}</option>)}
                </select>
                <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:11,color:'#9fb2c6',pointerEvents:'none'}}>▾</span>
              </div>
            </div>
            <div style={{display:'flex',gap:12}}>
              <button onClick={()=>setStep(1)} style={btnGhost}>חזרה</button>
              <button onClick={()=>setStep(3)} disabled={!form.category||!form.region} style={{...btnPrimary,background:(!form.category||!form.region)?'#c9d6e3':NAVY,cursor:(!form.category||!form.region)?'default':'pointer'}}>המשך</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <h2 style={{fontFamily:RBK,fontSize:22,fontWeight:700,margin:'0 0 8px'}}>עדכונים</h2>
            {[{v:'whatsapp',l:'WhatsApp'},{v:'email',l:'אימייל'},{v:'both',l:'שניהם'}].map(({v,l})=>{
              const on=form.notification===v;
              return(
                <label key={v} style={{display:'flex',alignItems:'center',gap:12,padding:16,border:on?`2px solid ${BLUE}`:'2px solid #e2ecf6',borderRadius:14,cursor:'pointer',background:on?'#e8f1fb':'#fff'}}>
                  <input type="radio" name="notification" value={v} checked={on} onChange={()=>upd('notification',v)} style={{accentColor:BLUE,width:18,height:18}}/>
                  <span style={{fontWeight:600,fontSize:15,color:'#33475b'}}>{l}</span>
                </label>
              );
            })}
            <div style={{display:'flex',gap:12,marginTop:12}}>
              <button onClick={()=>setStep(2)} style={btnGhost}>חזרה</button>
              <button onClick={handleSubmit} disabled={loading} style={{...btnPrimary,background:loading?'#c9d6e3':GREEN,cursor:loading?'default':'pointer'}}>{loading?'שומר...':'הרשמה'}</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
