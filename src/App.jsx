import { useState, useEffect, useRef } from "react";

const SEATS = [
  {id:"A1",x:75,y:80},{id:"A2",x:135,y:80},{id:"A3",x:195,y:80},
  {id:"A4",x:75,y:140},{id:"A5",x:135,y:140},{id:"A6",x:195,y:140},
  {id:"B1",x:262,y:80},{id:"B2",x:322,y:80},{id:"B3",x:382,y:80},
  {id:"B4",x:262,y:140},{id:"B5",x:322,y:140},{id:"B6",x:382,y:140},
  {id:"C1",x:75,y:282},{id:"C2",x:135,y:282},{id:"C3",x:195,y:282},
  {id:"C4",x:255,y:282},{id:"C5",x:315,y:282},{id:"C6",x:375,y:282},
];
const C_FREE="#10b981", C_OCC="#3b82f6", C_FIX="#f43f5e";

function getToday(){const d=new Date();d.setHours(0,0,0,0);return d;}
function toISO(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function fromISO(s){const p=s.split("-");return new Date(+p[0],+p[1]-1,+p[2]);}
function daysInMonth(y,m){return new Date(y,m+1,0).getDate();}
function firstMon(y,m){return(new Date(y,m,1).getDay()+6)%7;}
function fmtShort(iso){return fromISO(iso).toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"short"});}
function fmtMY(y,m){return new Date(y,m,1).toLocaleDateString("es-ES",{month:"long",year:"numeric"});}
function sName(s){return(s||"").split(" ")[0].slice(0,9);}
function isWE(iso){const d=fromISO(iso).getDay();return d===0||d===6;}

// ── localStorage persistence ──────────────────────────────────────────────────
const DB_KEY="hotdesk-v12";
const DEFAULT_ADMIN={name:"Admin",password:"admin",role:"admin"};

function loadDB(){
  try{
    const raw=localStorage.getItem(DB_KEY);
    if(raw){
      const d=JSON.parse(raw);
      if(!d.users)d.users=[];
      // migrate: ensure at least one admin exists
      if(!d.users.find(u=>u.role==="admin"))d.users.unshift(DEFAULT_ADMIN);
      return d;
    }
  }catch(e){}
  return{fixed:{},res:[],users:[DEFAULT_ADMIN]};
}
function saveDB(d){
  try{localStorage.setItem(DB_KEY,JSON.stringify(d));}catch(e){}
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App(){
  const[db,setDb]=useState(()=>loadDB());
  const[user,setUser]=useState(null);
  const[view,setView]=useState("map");
  const[modal,setModal]=useState(null);
  const[toast,setToast]=useState(null);
  const[ty,setTy]=useState(()=>new Date().getFullYear());
  const[tm,setTm]=useState(()=>new Date().getMonth());
  const TODAY=toISO(getToday());

  function save(d){setDb(d);saveDB(d);}
  function notify(m,e){setToast({m,e:!!e});setTimeout(()=>setToast(null),3200);}

  function stOf(sid,iso){
    if(db.fixed[sid])return"fixed";
    return db.res.find(r=>r.sid===sid&&r.date===iso)?"occupied":"free";
  }
  function resOf(sid,iso){return db.res.find(r=>r.sid===sid&&r.date===iso)||null;}

  function doReserve(sid,dates){
    if(!dates.length)return;
    const alreadyBooked=new Set(db.res.filter(r=>r.u===user.name).map(r=>r.date));
    const clean=dates.filter(d=>!alreadyBooked.has(d));
    if(!clean.length){notify("Ya tienes reserva en todas las fechas seleccionadas.",true);return;}
    save({...db,res:[...db.res,...clean.map(date=>({sid,date,u:user.name}))]});
    setModal(null);
    const sk=dates.length-clean.length;
    notify("✓ "+clean.length+" reserva"+(clean.length>1?"s":"")+" — Puesto "+sid+(sk?" ("+sk+" omitida"+(sk>1?"s":"")+")":""));
  }
  function doRelease(sid,iso){save({...db,res:db.res.filter(r=>!(r.sid===sid&&r.date===iso))});setModal(null);notify("Reserva liberada");}
  function adminRelease(sid,iso){save({...db,res:db.res.filter(r=>!(r.sid===sid&&r.date===iso))});setModal(null);notify("Reserva liberada (admin)");}
  function toggleFixed(sid,name){
    const was=!!db.fixed[sid];const f={...db.fixed};
    if(was)delete f[sid];else f[sid]=name||"Asignado";
    save({...db,fixed:f,res:was?db.res:db.res.filter(r=>r.sid!==sid)});
    setModal(null);notify(was?"Puesto "+sid+" desbloqueado":"Puesto "+sid+" → fijo");
  }
  function adminReserveForUser(sid,dates,uName,asFixed){
    if(asFixed){
      const f={...db.fixed};f[sid]=uName;
      save({...db,fixed:f,res:db.res.filter(r=>r.sid!==sid)});
      notify("Puesto "+sid+" fijado para "+uName);
    }else{
      if(!dates.length)return;
      const cleaned=db.res.filter(r=>!dates.includes(r.date)||r.u!==uName);
      save({...db,res:[...cleaned,...dates.map(date=>({sid,date,u:uName}))]});
      notify("✓ "+dates.length+" reserva"+(dates.length>1?"s":"")+" para "+uName+" — Puesto "+sid);
    }
  }
  function clickSeat(sid,iso){
    const st=stOf(sid,iso);
    if(user.role==="admin"){setModal({t:"admin",sid,iso});return;}
    if(st==="fixed"){notify("Puesto con asignación fija.",true);return;}
    if(st==="occupied"){
      const r=resOf(sid,iso);
      if(r&&r.u===user.name){setModal({t:"release",sid,iso});}
      else notify("Este puesto ya está ocupado.",true);
      return;
    }
    const existing=db.res.find(r=>r.u===user.name&&r.date===iso);
    if(existing){notify("Ya tienes el puesto "+existing.sid+" reservado para esta fecha.",true);return;}
    setModal({t:"reserve",sid,iso});
  }
  function prevM(){if(tm===0){setTy(y=>y-1);setTm(11);}else setTm(m=>m-1);}
  function nextM(){if(tm===11){setTy(y=>y+1);setTm(0);}else setTm(m=>m+1);}

  function handleLogin(loggedUser){
    setUser(loggedUser);
    setView("map");
  }

  if(!user)return <LoginScreen db={db} onLogin={handleLogin}/>;

  const isAdmin=user.role==="admin";
  const freeN=SEATS.filter(s=>stOf(s.id,TODAY)==="free").length;
  const roleLabel=isAdmin?"⚙ Admin":user.role==="fixed"?"📌 Fijo":"💻 Hotdesk";
  const roleBorder=isAdmin?"#4c1d95":user.role==="fixed"?C_FIX+"80":"#075985";
  const roleColor=isAdmin?"#c4b5fd":user.role==="fixed"?"#fda4af":"#67e8f9";
  const roleBg=isAdmin?"#1a0930":user.role==="fixed"?"#1a0514":"#041e2c";

  return(
    <div style={{fontFamily:"'Outfit',system-ui,sans-serif",background:"#080e17",color:"#dde6f0",minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <style>{GS}</style>
      <div style={{background:"#0b1422",borderBottom:"1px solid #162032",padding:"10px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div style={{fontSize:20,fontWeight:800}}><span style={{color:"#22d3ee"}}>Hot</span>Desk</div>
        <div style={{flex:1}}/>
        {view!=="admin"&&(
          <div style={{display:"flex",background:"#060c14",border:"1px solid #162032",borderRadius:8,padding:3,gap:2}}>
            {[["map","🗺 Mapa"],["table","📋 Tabla"]].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)} style={{border:"none",padding:"5px 14px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:500,fontFamily:"inherit",background:view===v?"#162032":"transparent",color:view===v?"#67e8f9":"#2a4060"}}>{l}</button>
            ))}
          </div>
        )}
        {isAdmin&&(
          <button onClick={()=>setView(v=>v==="admin"?"map":"admin")}
            style={{background:view==="admin"?"#2e1065":"transparent",border:"1px solid "+(view==="admin"?"#7c3aed":"#2e1065"),color:view==="admin"?"#ddd6fe":"#7c3aed",padding:"5px 14px",borderRadius:7,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            ⚙ Panel Admin{view==="admin"?" ✕":""}
          </button>
        )}
        <div style={{background:roleBg,border:"1px solid "+roleBorder,borderRadius:20,padding:"4px 13px",fontSize:12,color:roleColor}}>
          {roleLabel} · {user.name}
        </div>
        <button onClick={()=>setUser(null)} style={{background:"#0b1422",border:"1px solid #162032",color:"#374151",padding:"5px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
      </div>
      {view!=="admin"&&(
        <div style={{background:"#060c14",borderBottom:"1px solid #0a1525",padding:"5px 16px",display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
          <Dot c={C_FREE} l="Libre"/><Dot c={C_OCC} l="Ocupado"/><Dot c={C_FIX} l="Fijo"/>
          <div style={{flex:1}}/>
          <span style={{fontSize:11,color:"#1e3a5f"}}>{freeN} libre{freeN!==1?"s":""} hoy</span>
        </div>
      )}
      <div style={{flex:1,padding:16,overflow:"auto"}}>
        {view==="admin"&&isAdmin
          ?<AdminPanel db={db} save={save} notify={notify} today={TODAY} stOf={stOf} resOf={resOf} onReserveForUser={adminReserveForUser} onToggleFixed={toggleFixed}/>
          :view==="map"
            ?<MapView db={db} stOf={stOf} resOf={resOf} user={user} today={TODAY} onSeat={sid=>clickSeat(sid,TODAY)}/>
            :<TableView db={db} stOf={stOf} resOf={resOf} user={user} today={TODAY} y={ty} m={tm} onPrev={prevM} onNext={nextM} onCell={clickSeat}/>
        }
      </div>
      {modal?.t==="reserve"&&<ReserveModal sid={modal.sid} initIso={modal.iso} db={db} user={user} today={TODAY} onConfirm={doReserve} onClose={()=>setModal(null)}/>}
      {modal?.t==="release"&&(
        <Overlay onClose={()=>setModal(null)}>
          <Tag>LIBERAR RESERVA</Tag><Title>Puesto {modal.sid}</Title><Sub>{fmtShort(modal.iso)}</Sub>
          <p style={{color:"#4a6a8a",fontSize:13,marginBottom:22}}>¿Deseas liberar tu reserva?</p>
          <Row><Btn ghost onClick={()=>setModal(null)}>Cancelar</Btn><Btn danger onClick={()=>doRelease(modal.sid,modal.iso)}>Liberar</Btn></Row>
        </Overlay>
      )}
      {modal?.t==="admin"&&<QuickAdminModal sid={modal.sid} iso={modal.iso} db={db} stOf={stOf} resOf={resOf} onToggle={toggleFixed} onRelease={adminRelease} onClose={()=>setModal(null)}/>}
      {toast&&<div style={{position:"fixed",bottom:20,right:20,zIndex:9999,padding:"11px 20px",borderRadius:8,fontSize:13,fontWeight:500,background:toast.e?"#2a0a3f":"#012e14",border:"1px solid "+(toast.e?"#7c3aed":"#16a34a"),color:toast.e?"#e9d5ff":"#bbf7d0",boxShadow:"0 8px 30px rgba(0,0,0,.6)",animation:"hdUp .2s ease"}}>{toast.m}</div>}
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel({db,save,notify,today,stOf,resOf,onReserveForUser,onToggleFixed}){
  const[tab,setTab]=useState("seats");
  const[selSeat,setSelSeat]=useState(null);
  const[selUser,setSelUser]=useState("");
  const[asFixed,setAsFixed]=useState(false);
  const[calY,setCalY]=useState(new Date().getFullYear());
  const[calM,setCalM]=useState(new Date().getMonth());
  const[selDates,setSelDates]=useState([]);
  const[newName,setNewName]=useState("");
  const[newPass,setNewPass]=useState("");
  const[newRole,setNewRole]=useState("hotdesk");
  const[showPass,setShowPass]=useState({});
  const[editPass,setEditPass]=useState({});

  const users=db.users||[];
  const hotdeskUsers=users.filter(u=>u.role==="hotdesk");
  const fixedUsers=users.filter(u=>u.role==="fixed");
  const adminUsers=users.filter(u=>u.role==="admin");

  function addUser(){
    if(!newName.trim())return;
    if(!newPass.trim()){notify("La contraseña no puede estar vacía.",true);return;}
    if(users.find(u=>u.name.toLowerCase()===newName.trim().toLowerCase())){notify("El usuario ya existe.",true);return;}
    save({...db,users:[...users,{name:newName.trim(),password:newPass.trim(),role:newRole}]});
    setNewName("");setNewPass("");
    notify("Usuario '"+newName.trim()+"' añadido");
  }
  function removeUser(name){
    if(adminUsers.length===1&&adminUsers[0].name===name){notify("No puedes eliminar el único administrador.",true);return;}
    save({...db,users:users.filter(u=>u.name!==name)});
    notify("Usuario eliminado");
  }
  function setUserRole(name,role){
    if(role!=="admin"&&adminUsers.length===1&&adminUsers[0].name===name){notify("Debe existir al menos un administrador.",true);return;}
    save({...db,users:users.map(u=>u.name===name?{...u,role}:u)});
    notify("Rol actualizado");
  }
  function updatePassword(name,pwd){
    if(!pwd.trim()){notify("La contraseña no puede estar vacía.",true);return;}
    save({...db,users:users.map(u=>u.name===name?{...u,password:pwd.trim()}:u)});
    setEditPass(p=>({...p,[name]:""}));
    notify("Contraseña actualizada para "+name);
  }
  function removeFixed(sid){const f={...db.fixed};delete f[sid];save({...db,fixed:f});notify("Puesto "+sid+" desbloqueado");}

  const daysInMo=daysInMonth(calY,calM),firstDow=firstMon(calY,calM);
  function isoD(d){return String(calY)+"-"+String(calM+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");}
  const seatTaken=selSeat?new Set(db.res.filter(r=>r.sid===selSeat).map(r=>r.date)):new Set();
  const userTaken=selUser?new Set(db.res.filter(r=>r.u===selUser).map(r=>r.date)):new Set();
  function toggleCalDay(d){
    const iso=isoD(d),dow=(fromISO(iso).getDay()+6)%7;
    if(dow>=5||fromISO(iso)<getToday()||seatTaken.has(iso))return;
    setSelDates(p=>p.includes(iso)?p.filter(x=>x!==iso):[...p,iso]);
  }
  function confirmReservation(){
    if(!selSeat||!selUser)return;
    onReserveForUser(selSeat,selDates,selUser,asFixed);
    setSelSeat(null);setSelUser("");setSelDates([]);setAsFixed(false);
  }
  const DL=["Lu","Ma","Mi","Ju","Vi","Sá","Do"];

  const roleColor={admin:"#c4b5fd",fixed:C_FIX,hotdesk:"#67e8f9"};
  const roleLabel={admin:"⚙ Admin",fixed:"📌 Fijo",hotdesk:"💻 Hotdesk"};

  return(
    <div style={{maxWidth:980,margin:"0 auto",animation:"hdFade .3s ease"}}>
      <div style={{fontSize:10,color:"#4c1d95",fontWeight:700,letterSpacing:3,marginBottom:16}}>⚙ PANEL DE ADMINISTRACIÓN</div>
      <div style={{display:"flex",background:"#060c14",border:"1px solid #162032",borderRadius:8,padding:3,gap:2,marginBottom:20,width:"fit-content"}}>
        {[["seats","🪑 Gestión de puestos"],["users","👥 Usuarios"]].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} style={{border:"none",padding:"7px 18px",borderRadius:6,cursor:"pointer",fontSize:13,fontWeight:500,fontFamily:"inherit",background:tab===v?"#2e1065":"transparent",color:tab===v?"#ddd6fe":"#2a4060"}}>{l}</button>
        ))}
      </div>

      {tab==="seats"&&(
        <div style={{display:"grid",gridTemplateColumns:"minmax(220px,320px) 1fr",gap:20,alignItems:"start"}}>
          <div>
            <div style={{fontSize:10,color:"#1e3a5f",fontWeight:700,letterSpacing:2,marginBottom:10}}>SELECCIONAR PUESTO</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:20}}>
              {SEATS.map(seat=>{
                const st=stOf(seat.id,today),col=st==="fixed"?C_FIX:st==="occupied"?C_OCC:C_FREE,isSel=selSeat===seat.id;
                return(
                  <button key={seat.id} onClick={()=>{setSelSeat(seat.id);setSelDates([]);setSelUser("");setAsFixed(false);}}
                    style={{background:isSel?col+"22":"#0b1422",border:"2px solid "+(isSel?col:"#162032"),borderRadius:8,padding:"10px 4px",cursor:"pointer",fontFamily:"inherit",color:isSel?col:"#4a6a8a",fontWeight:isSel?700:400,fontSize:12,lineHeight:1.4,transition:"all .12s"}}>
                    {seat.id}{db.fixed[seat.id]&&<div style={{fontSize:9,color:C_FIX,marginTop:2}}>{sName(db.fixed[seat.id])}</div>}
                  </button>
                );
              })}
            </div>
            {Object.keys(db.fixed).length>0&&(
              <div>
                <div style={{fontSize:10,color:"#1e3a5f",fontWeight:700,letterSpacing:2,marginBottom:8}}>PUESTOS FIJOS ACTIVOS</div>
                {Object.entries(db.fixed).map(([sid,uname])=>(
                  <div key={sid} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"#0b1422",border:"1px solid "+C_FIX+"40",borderRadius:7,marginBottom:5}}>
                    <span style={{color:C_FIX,fontWeight:700,fontSize:12,minWidth:32}}>{sid}</span>
                    <span style={{color:"#f87171",fontSize:12,flex:1}}>{uname}</span>
                    <button onClick={()=>removeFixed(sid)} style={{background:"transparent",border:"none",color:"#6b1a1a",cursor:"pointer",fontSize:13}} onMouseOver={e=>e.currentTarget.style.color="#fca5a5"} onMouseOut={e=>e.currentTarget.style.color="#6b1a1a"}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selSeat?(
            <div style={{background:"#0b1422",border:"1px solid #162032",borderRadius:12,padding:20}}>
              <div style={{fontSize:10,color:"#1e3a5f",fontWeight:700,letterSpacing:2,marginBottom:6}}>CONFIGURAR PUESTO</div>
              <div style={{fontSize:20,fontWeight:700,marginBottom:16}}>Puesto <span style={{color:"#22d3ee"}}>{selSeat}</span>{db.fixed[selSeat]&&<span style={{color:C_FIX,fontSize:12,fontWeight:400,marginLeft:8}}>fijo: {db.fixed[selSeat]}</span>}</div>
              <div style={{fontSize:10,color:"#1e3a5f",fontWeight:700,letterSpacing:1,marginBottom:6}}>ASIGNAR A USUARIO</div>
              <select value={selUser} onChange={e=>setSelUser(e.target.value)}
                style={{width:"100%",background:"#060c14",border:"1px solid "+(selUser?"#0891b2":"#162032"),color:selUser?"#bae6fd":"#3a5a7a",padding:"9px 12px",borderRadius:7,fontSize:13,outline:"none",fontFamily:"inherit",marginBottom:16,cursor:"pointer"}}>
                <option value="">— Seleccionar usuario —</option>
                {users.length===0&&<option disabled>No hay usuarios registrados</option>}
                {adminUsers.length>0&&<optgroup label="── Admin">{adminUsers.map(u=><option key={u.name} value={u.name}>⚙ {u.name}</option>)}</optgroup>}
                {fixedUsers.length>0&&<optgroup label="── Puesto fijo">{fixedUsers.map(u=><option key={u.name} value={u.name}>📌 {u.name}</option>)}</optgroup>}
                {hotdeskUsers.length>0&&<optgroup label="── Hotdesk">{hotdeskUsers.map(u=><option key={u.name} value={u.name}>💻 {u.name}</option>)}</optgroup>}
              </select>
              <div onClick={()=>setAsFixed(f=>!f)} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",background:"#060c14",borderRadius:8,border:"1px solid "+(asFixed?C_FIX+"60":"#162032"),cursor:"pointer",marginBottom:16}}>
                <div style={{width:18,height:18,borderRadius:4,background:asFixed?C_FIX:"transparent",border:"2px solid "+(asFixed?C_FIX:"#2a4060"),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {asFixed&&<span style={{color:"#fff",fontSize:11,fontWeight:700}}>✓</span>}
                </div>
                <div>
                  <div style={{fontSize:12,color:asFixed?C_FIX:"#4a6a8a",fontWeight:asFixed?600:400}}>📌 Fijar como reserva permanente</div>
                  <div style={{fontSize:10,color:"#1e3a5f",marginTop:1}}>El puesto quedará bloqueado para esta persona</div>
                </div>
              </div>
              {!asFixed&&(
                <>
                  <div style={{fontSize:10,color:"#1e3a5f",fontWeight:700,letterSpacing:1,marginBottom:10}}>SELECCIONAR FECHAS</div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <button onClick={()=>{if(calM===0){setCalY(y=>y-1);setCalM(11);}else setCalM(m=>m-1);}} style={CB}>‹</button>
                    <span style={{fontSize:12,fontWeight:600,color:"#7dd3fc",textTransform:"capitalize"}}>{fmtMY(calY,calM)}</span>
                    <button onClick={()=>{if(calM===11){setCalY(y=>y+1);setCalM(0);}else setCalM(m=>m+1);}} style={CB}>›</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:8}}>
                    {DL.map(l=><div key={l} style={{textAlign:"center",fontSize:9,color:"#1e3a5f",fontWeight:700,padding:"2px 0"}}>{l}</div>)}
                    {Array.from({length:firstDow}).map((_,i)=><div key={"e"+i}/>)}
                    {Array.from({length:daysInMo},(_,i)=>i+1).map(d=>{
                      const iso=isoD(d),dow=(fromISO(iso).getDay()+6)%7;
                      const we=dow>=5,past=fromISO(iso)<getToday(),occ=seatTaken.has(iso);
                      const uHas=selUser&&userTaken.has(iso)&&!selDates.includes(iso);
                      const isSel=selDates.includes(iso),dis=we||past||occ;
                      let bg="transparent",bo="#162032",co="#3a5a7a";
                      if(we||past){co="#1e2535";bo="#0d1525";}
                      else if(occ){bg=C_OCC+"18";bo=C_OCC+"50";co="#60a5fa";}
                      else if(uHas){bg="#f59e0b14";bo="#f59e0b40";co="#6b5a30";}
                      else if(isSel){bg=C_FREE+"22";bo=C_FREE;co="#34d399";}
                      else{co="#94a3b8";}
                      return(
                        <div key={d} onClick={()=>!dis&&toggleCalDay(d)}
                          style={{textAlign:"center",borderRadius:5,padding:"4px 1px",fontSize:11,fontWeight:isSel?700:400,background:bg,border:"1px solid "+bo,color:co,cursor:dis?"not-allowed":"pointer",minHeight:26,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
                          {d}{isSel&&<div style={{width:3,height:3,borderRadius:"50%",background:C_FREE}}/>}
                        </div>
                      );
                    })}
                  </div>
                  {selDates.length>0&&<div style={{fontSize:10,color:"#22d3ee",marginBottom:12,lineHeight:1.8,background:"#060c14",padding:"8px 10px",borderRadius:7,border:"1px solid #162032"}}><span style={{color:"#1e4060"}}>Fechas ({selDates.length}): </span>{selDates.slice().sort().map(d=>fmtShort(d)).join(" · ")}</div>}
                </>
              )}
              <Row>
                <Btn ghost onClick={()=>{setSelSeat(null);setSelDates([]);setSelUser("");setAsFixed(false);}}>Cancelar</Btn>
                <Btn primary onClick={confirmReservation} disabled={!selUser||((!asFixed)&&selDates.length===0)}>{asFixed?"📌 Fijar puesto":"✓ Reservar ("+selDates.length+")"}</Btn>
              </Row>
            </div>
          ):(
            <div style={{background:"#0b1422",border:"1px solid #162032",borderRadius:12,padding:32,display:"flex",alignItems:"center",justifyContent:"center",color:"#1e3a5f",fontSize:13,minHeight:200}}>← Selecciona un puesto para configurarlo</div>
          )}
        </div>
      )}

      {tab==="users"&&(
        <div style={{maxWidth:600}}>
          {/* Add user */}
          <div style={{background:"#0b1422",border:"1px solid #162032",borderRadius:10,padding:18,marginBottom:20}}>
            <div style={{fontSize:10,color:"#1e3a5f",fontWeight:700,letterSpacing:2,marginBottom:12}}>AÑADIR USUARIO</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
              <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Nombre completo"
                style={{flex:"1 1 160px",background:"#060c14",border:"1px solid #162032",color:"#dde6f0",padding:"9px 12px",borderRadius:7,fontSize:13,outline:"none",fontFamily:"inherit"}}
                onFocus={e=>e.target.style.borderColor="#22d3ee"} onBlur={e=>e.target.style.borderColor="#162032"}/>
              <div style={{position:"relative",flex:"1 1 140px"}}>
                <input value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="Contraseña"
                  type={showPass.__new?"text":"password"}
                  style={{width:"100%",background:"#060c14",border:"1px solid #162032",color:"#dde6f0",padding:"9px 36px 9px 12px",borderRadius:7,fontSize:13,outline:"none",fontFamily:"inherit"}}
                  onFocus={e=>e.target.style.borderColor="#22d3ee"} onBlur={e=>e.target.style.borderColor="#162032"}/>
                <button onClick={()=>setShowPass(p=>({...p,__new:!p.__new}))} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"transparent",border:"none",color:"#3a5a7a",cursor:"pointer",fontSize:13,padding:2}}>
                  {showPass.__new?"🙈":"👁"}
                </button>
              </div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <div style={{display:"flex",background:"#060c14",border:"1px solid #162032",borderRadius:7,padding:3,gap:2,flex:1}}>
                {[["hotdesk","💻 Hotdesk"],["fixed","📌 Fijo"],["admin","⚙ Admin"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setNewRole(v)} style={{flex:1,border:"none",padding:"6px 8px",borderRadius:5,cursor:"pointer",fontSize:11,fontWeight:500,fontFamily:"inherit",background:newRole===v?(v==="admin"?"#2e1065":v==="fixed"?"#1a0514":"#041e2c"):"transparent",color:newRole===v?roleColor[v]:"#2a4060",transition:"all .12s"}}>{l}</button>
                ))}
              </div>
              <Btn primary onClick={addUser} disabled={!newName.trim()||!newPass.trim()}>+ Añadir</Btn>
            </div>
          </div>

          {/* User list */}
          {users.length===0?(
            <div style={{color:"#1e3a5f",fontSize:13,textAlign:"center",padding:40,background:"#0b1422",border:"1px solid #162032",borderRadius:10}}>No hay usuarios registrados.</div>
          ):(
            <div>
              <div style={{fontSize:10,color:"#1e3a5f",fontWeight:700,letterSpacing:2,marginBottom:10}}>USUARIOS ({users.length})</div>
              {users.map(u=>{
                const rc=roleColor[u.role]||"#67e8f9";
                const isEditingPass=editPass[u.name]!==undefined;
                const fixedSeat=Object.entries(db.fixed).find(([,v])=>v===u.name);
                return(
                  <div key={u.name} style={{background:"#0b1422",border:"1px solid #162032",borderRadius:8,marginBottom:8,overflow:"hidden"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px"}}>
                      <div style={{width:36,height:36,borderRadius:"50%",background:u.role==="admin"?"#1a0930":u.role==="fixed"?"#1a0514":"#041e2c",border:"1.5px solid "+rc,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>
                        {u.role==="admin"?"⚙":u.role==="fixed"?"📌":"💻"}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:"#dde6f0"}}>{u.name}</div>
                        <div style={{fontSize:10,color:rc,marginTop:1}}>
                          {roleLabel[u.role]}
                          {fixedSeat&&<span style={{color:"#6b1a1a",marginLeft:6}}>→ {fixedSeat[0]}</span>}
                        </div>
                      </div>
                      {/* Role selector */}
                      <div style={{display:"flex",background:"#060c14",border:"1px solid #162032",borderRadius:6,padding:2,gap:1}}>
                        {[["hotdesk","💻"],["fixed","📌"],["admin","⚙"]].map(([v,icon])=>(
                          <button key={v} onClick={()=>setUserRole(u.name,v)} title={roleLabel[v]}
                            style={{border:"none",padding:"4px 7px",borderRadius:4,cursor:"pointer",fontSize:12,fontFamily:"inherit",background:u.role===v?(v==="admin"?"#2e1065":v==="fixed"?"#1a0514":"#041e2c"):"transparent",color:u.role===v?roleColor[v]:"#2a4060",transition:"all .12s"}}>
                            {icon}
                          </button>
                        ))}
                      </div>
                      {/* Edit pass toggle */}
                      <button onClick={()=>setEditPass(p=>isEditingPass?Object.fromEntries(Object.entries(p).filter(([k])=>k!==u.name)):{...p,[u.name]:""})}
                        style={{background:"transparent",border:"1px solid #1e2a3a",color:"#3a5a7a",padding:"5px 9px",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:"inherit"}}
                        onMouseOver={e=>{e.currentTarget.style.borderColor="#0891b2";e.currentTarget.style.color="#7dd3fc";}}
                        onMouseOut={e=>{e.currentTarget.style.borderColor="#1e2a3a";e.currentTarget.style.color="#3a5a7a";}}>
                        🔑
                      </button>
                      {/* Delete */}
                      <button onClick={()=>removeUser(u.name)}
                        style={{background:"transparent",border:"1px solid #450a0a",color:"#6b1a1a",padding:"5px 9px",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:"inherit"}}
                        onMouseOver={e=>{e.currentTarget.style.background="#450a0a";e.currentTarget.style.color="#fca5a5";}}
                        onMouseOut={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#6b1a1a";}}>
                        ✕
                      </button>
                    </div>
                    {/* Inline password editor */}
                    {isEditingPass&&(
                      <div style={{borderTop:"1px solid #162032",padding:"10px 14px",background:"#060c14",display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{fontSize:11,color:"#1e3a5f",whiteSpace:"nowrap"}}>Nueva contraseña:</span>
                        <div style={{position:"relative",flex:1}}>
                          <input value={editPass[u.name]||""} onChange={e=>setEditPass(p=>({...p,[u.name]:e.target.value}))}
                            type={showPass[u.name]?"text":"password"} placeholder="Nueva contraseña"
                            style={{width:"100%",background:"#0b1422",border:"1px solid #162032",color:"#dde6f0",padding:"7px 34px 7px 10px",borderRadius:6,fontSize:12,outline:"none",fontFamily:"inherit"}}
                            onFocus={e=>e.target.style.borderColor="#22d3ee"} onBlur={e=>e.target.style.borderColor="#162032"}/>
                          <button onClick={()=>setShowPass(p=>({...p,[u.name]:!p[u.name]}))} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"transparent",border:"none",color:"#3a5a7a",cursor:"pointer",fontSize:12,padding:0}}>
                            {showPass[u.name]?"🙈":"👁"}
                          </button>
                        </div>
                        <Btn primary onClick={()=>updatePassword(u.name,editPass[u.name]||"")} disabled={!(editPass[u.name]||"").trim()}>Guardar</Btn>
                        <Btn ghost onClick={()=>setEditPass(p=>Object.fromEntries(Object.entries(p).filter(([k])=>k!==u.name)))}>✕</Btn>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{marginTop:16,padding:"10px 14px",background:"#0a0f1a",border:"1px solid #162032",borderRadius:8,fontSize:11,color:"#1e3a5f"}}>
            💡 Credenciales por defecto del sistema: <span style={{color:"#2a4060"}}>Admin / admin</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── OFFICE SVG ───────────────────────────────────────────────────────────────
function OfficeSVG({db,iso,stOf,resOf,user,onSeat,hl}){
  return(
    <svg viewBox="0 0 640 390" style={{width:"100%",display:"block"}}>
      <rect x={8} y={8} width={624} height={374} rx={10} fill="#04090f" stroke="#162032" strokeWidth={2}/>
      {[52,142,232,322].map(x=><rect key={x} x={x} y={7} width={56} height={5} rx={2} fill="#082f49"/>)}
      {[70,175,278].map(y=><rect key={y} x={7} y={y} width={5} height={45} rx={2} fill="#082f49"/>)}
      <line x1={453} y1={10} x2={453} y2={382} stroke="#1a2e45" strokeWidth={2.5}/>
      <line x1={453} y1={200} x2={632} y2={200} stroke="#1a2e45" strokeWidth={2.5}/>
      <rect x={455} y={11} width={174} height={188} fill="#030810"/>
      <text x={542} y={90} textAnchor="middle" fill="#0f1e30" fontSize={11} fontWeight={700} letterSpacing={2}>SALA DE</text>
      <text x={542} y={106} textAnchor="middle" fill="#0f1e30" fontSize={11} fontWeight={700} letterSpacing={2}>REUNIONES</text>
      <ellipse cx={542} cy={152} rx={48} ry={26} fill="#0a1626" stroke="#142038" strokeWidth={1}/>
      <rect x={455} y={201} width={174} height={181} fill="#030810"/>
      <text x={542} y={284} textAnchor="middle" fill="#0f1e30" fontSize={11} fontWeight={700} letterSpacing={2}>COCINA /</text>
      <text x={542} y={300} textAnchor="middle" fill="#0f1e30" fontSize={11} fontWeight={700} letterSpacing={2}>BAÑOS</text>
      <rect x={270} y={376} width={100} height={12} rx={3} fill="#04090f" stroke="#1a2e45"/>
      <text x={320} y={385} textAnchor="middle" fill="#1a2e45" fontSize={9} fontWeight={700} letterSpacing={2}>▲ ENTRADA</text>
      <rect x={52} y={58} width={165} height={107} rx={9} fill="#060c18" stroke="#1a2e45" strokeWidth={1.5}/>
      <rect x={239} y={58} width={165} height={107} rx={9} fill="#060c18" stroke="#1a2e45" strokeWidth={1.5}/>
      <rect x={52} y={260} width={345} height={48} rx={9} fill="#060c18" stroke="#1a2e45" strokeWidth={1.5}/>
      <text x={134} y={50} textAnchor="middle" fill="#0b1e35" fontSize={9} fontWeight={700} letterSpacing={3}>ZONA A</text>
      <text x={321} y={50} textAnchor="middle" fill="#0b1e35" fontSize={9} fontWeight={700} letterSpacing={3}>ZONA B</text>
      <text x={225} y={252} textAnchor="middle" fill="#0b1e35" fontSize={9} fontWeight={700} letterSpacing={3}>ZONA C</text>
      {hl&&SEATS.filter(s=>s.id===hl).map(s=>(
        <circle key="ring" cx={s.x} cy={s.y} r={27} fill="none" stroke="#fbbf24" strokeWidth={2.5} strokeDasharray="5 3"
          style={{animation:"hdSpin 3s linear infinite",transformOrigin:s.x+"px "+s.y+"px"}}/>
      ))}
      {SEATS.map(seat=>{
        const st=stOf(seat.id,iso),r=resOf(seat.id,iso);
        const col=st==="fixed"?C_FIX:st==="occupied"?C_OCC:C_FREE;
        const mine=r&&user&&r.u===user.name;
        const lbl=sName(db.fixed[seat.id]||(r&&r.u)||"");
        return(
          <g key={seat.id} className={onSeat?"hd-seat":""} onClick={()=>onSeat&&onSeat(seat.id)}>
            <rect x={seat.x-22} y={seat.y-22} width={44} height={44} rx={7} fill={col+"1a"} stroke={mine?"#fbbf24":col} strokeWidth={mine?2.5:1.5}/>
            <rect x={seat.x-14} y={seat.y-4} width={28} height={13} rx={3} fill={col+"28"} stroke={col+"40"} strokeWidth={1}/>
            <circle cx={seat.x} cy={seat.y-13} r={4} fill={col+"30"} stroke={col+"60"} strokeWidth={1}/>
            <text x={seat.x} y={seat.y+19} textAnchor="middle" fill={col} fontSize={9} fontWeight={700}>{seat.id}</text>
            {lbl&&<text x={seat.x} y={seat.y+7} textAnchor="middle" fill={col+"bb"} fontSize={8}>{lbl}</text>}
            {mine&&<circle cx={seat.x+18} cy={seat.y-18} r={4} fill="#fbbf24" stroke="#78350f" strokeWidth={1}/>}
          </g>
        );
      })}
    </svg>
  );
}

function MapView({db,stOf,resOf,user,today,onSeat}){
  return(
    <div style={{display:"flex",justifyContent:"center",animation:"hdFade .3s ease"}}>
      <div style={{background:"#0b1422",border:"1px solid #162032",borderRadius:12,padding:18,maxWidth:680,width:"100%"}}>
        <div style={{fontSize:10,color:"#1e3a5f",fontWeight:700,letterSpacing:2,marginBottom:12}}>PLANTA · <span style={{color:"#0891b2"}}>{fmtShort(today).toUpperCase()}</span></div>
        <OfficeSVG db={db} iso={today} stOf={stOf} resOf={resOf} user={user} onSeat={onSeat}/>
        <div style={{fontSize:10,color:"#1e3a5f",textAlign:"center",marginTop:8}}>Clic en un puesto para reservar · <span style={{color:"#78350f"}}>● tu reserva</span></div>
      </div>
    </div>
  );
}

function Tooltip({sid,iso,ax,ay,db,stOf,resOf,user}){
  const ref=useRef(null);
  const[pos,setPos]=useState({left:ax,top:ay});
  useEffect(()=>{
    if(!ref.current)return;
    const el=ref.current,r=el.getBoundingClientRect();
    let left=ax-r.width/2,top=ay+6;
    if(left+r.width>window.innerWidth-10)left=window.innerWidth-r.width-10;
    if(left<10)left=10;
    if(top+r.height>window.innerHeight-10)top=ay-r.height-6;
    setPos({left,top});
  },[ax,ay]);
  return(
    <div ref={ref} style={{position:"fixed",left:pos.left,top:pos.top,zIndex:8000,background:"#0a1422",border:"1px solid #1e3a5f",borderRadius:10,padding:10,pointerEvents:"none",boxShadow:"0 20px 60px rgba(0,0,0,.9)",width:300,animation:"hdUp .15s ease"}}>
      <div style={{fontSize:9,color:"#1e3a5f",fontWeight:700,letterSpacing:2,marginBottom:6}}>PUESTO <span style={{color:"#22d3ee"}}>{sid}</span> · HOY</div>
      <OfficeSVG db={db} iso={iso} stOf={stOf} resOf={resOf} user={user} onSeat={null} hl={sid}/>
    </div>
  );
}

function TableView({db,stOf,resOf,user,today,y,m,onPrev,onNext,onCell}){
  const days=daysInMonth(y,m),daysArr=Array.from({length:days},(_,i)=>i+1);
  const[tip,setTip]=useState(null);
  function isoD(day){return String(y)+"-"+String(m+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");}
  const DOW=["D","L","M","X","J","V","S"];
  return(
    <div style={{animation:"hdFade .3s ease"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
        <button onClick={onPrev} style={NB}>‹</button>
        <span style={{fontSize:14,fontWeight:600,color:"#7dd3fc",textTransform:"capitalize",minWidth:190,textAlign:"center"}}>{fmtMY(y,m)}</span>
        <button onClick={onNext} style={NB}>›</button>
        <span style={{fontSize:10,color:"#1e3a5f"}}>💡 Pasa el cursor sobre el ID del puesto para ver el mapa</span>
      </div>
      <div style={{overflowX:"auto",position:"relative"}}>
        <table style={{borderCollapse:"collapse",fontSize:11}}>
          <thead>
            <tr style={{background:"#060c14"}}>
              <th style={{...TH,minWidth:115,position:"sticky",left:0,zIndex:10,background:"#060c14",textAlign:"left",paddingLeft:10,borderRight:"2px solid #162032"}}>FECHA</th>
              {SEATS.map(seat=>(
                <th key={seat.id} onMouseEnter={e=>{const r=e.currentTarget.getBoundingClientRect();setTip({sid:seat.id,ax:r.left+r.width/2,ay:r.bottom+4});}} onMouseLeave={()=>setTip(null)} style={{...TH,minWidth:54,borderLeft:"1px solid #0a1525",cursor:"help"}}>
                  <span style={{color:"#22d3ee"}}>{seat.id}</span>
                  {db.fixed[seat.id]&&<div style={{color:C_FIX,fontSize:8,fontWeight:400,marginTop:1}}>{sName(db.fixed[seat.id])}</div>}
                  <div style={{color:"#1a2d3a",fontSize:9}}>🗺</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {daysArr.map(day=>{
              const iso=isoD(day),dow=fromISO(iso).getDay(),weekend=dow===0||dow===6,isToday=iso===today;
              const rowBg=isToday?"#0a1e32":weekend?"#060910":day%2===0?"#0b1422":"#091220";
              return(
                <tr key={day}>
                  <td style={{padding:"5px 10px",background:rowBg,borderBottom:"1px solid #0a1525",borderRight:"2px solid #162032",position:"sticky",left:0,zIndex:5,whiteSpace:"nowrap",fontSize:11}}>
                    {isToday&&<span style={{color:"#0891b2",marginRight:4,fontWeight:700}}>▶</span>}
                    <span style={{color:weekend?"#2a3a4a":isToday?"#22d3ee":"#64748b",fontWeight:isToday?700:400}}>{DOW[dow]}</span>
                    {" "}<span style={{color:isToday?"#e0f7ff":weekend?"#1e3045":"#94a3b8",fontWeight:isToday?700:400}}>{String(day).padStart(2,"0")}</span>
                    {" "}<span style={{color:"#1e3a5f",fontSize:10}}>{fromISO(iso).toLocaleDateString("es-ES",{month:"short"})}</span>
                  </td>
                  {SEATS.map(seat=>{
                    const st=stOf(seat.id,iso),r=resOf(seat.id,iso),mine=r&&user&&r.u===user.name;
                    const col=st==="fixed"?C_FIX:st==="occupied"?C_OCC:C_FREE;
                    const lbl=db.fixed[seat.id]?sName(db.fixed[seat.id]):r?sName(r.u):"";
                    return(
                      <td key={seat.id} style={{padding:3,background:rowBg,borderBottom:"1px solid #0a1525",borderLeft:"1px solid #0a1525"}}>
                        {weekend?<div style={{height:32,background:"#060912",borderRadius:4,border:"1px solid #0a1525"}}/>:(
                          <div className="hd-cell" onClick={()=>onCell(seat.id,iso)} title={st==="free"?"Libre":st==="fixed"?"Fijo: "+(db.fixed[seat.id]||""):"Ocupado: "+(r&&r.u||"")}
                            style={{background:col+"14",border:"1px solid "+(mine?"#fbbf2470":col+"30"),borderRadius:4,height:32,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
                            <span style={{width:7,height:7,borderRadius:"50%",background:mine?"#fbbf24":col,display:"block"}}/>
                            {lbl&&<span style={{fontSize:8,color:mine?"#fbbf24":col,maxWidth:46,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lbl}</span>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tip&&<Tooltip sid={tip.sid} iso={today} ax={tip.ax} ay={tip.ay} db={db} stOf={stOf} resOf={resOf} user={user}/>}
      <div style={{fontSize:10,color:"#1e3a5f",textAlign:"center",marginTop:8}}>Clic en celda para reservar · <span style={{color:"#78350f"}}>● mis reservas</span> · fines de semana no disponibles</div>
    </div>
  );
}

function ReserveModal({sid,initIso,db,user,today,onConfirm,onClose}){
  const sd=initIso?fromISO(initIso):getToday();
  const[cy,setCy]=useState(sd.getFullYear());
  const[cm,setCm]=useState(sd.getMonth());
  const alreadyBooked=new Set(db.res.filter(r=>r.u===user.name).map(r=>r.date));
  const validInit=initIso&&!isWE(initIso)&&fromISO(initIso)>=getToday()&&!db.fixed[sid]&&!db.res.find(r=>r.sid===sid&&r.date===initIso)&&!alreadyBooked.has(initIso);
  const[sel,setSel]=useState(validInit?[initIso]:[]);
  const days=daysInMonth(cy,cm),first=firstMon(cy,cm);
  function isoD(d){return String(cy)+"-"+String(cm+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");}
  const seatTaken=new Set(db.res.filter(r=>r.sid===sid).map(r=>r.date));
  function toggle(d){
    const iso=isoD(d),dow=(fromISO(iso).getDay()+6)%7;
    if(dow>=5||fromISO(iso)<getToday()||db.fixed[sid]||seatTaken.has(iso))return;
    if(alreadyBooked.has(iso)&&!sel.includes(iso))return;
    setSel(p=>p.includes(iso)?p.filter(x=>x!==iso):[...p,iso]);
  }
  function pm(){if(cm===0){setCy(y=>y-1);setCm(11);}else setCm(m=>m-1);}
  function nm(){if(cm===11){setCy(y=>y+1);setCm(0);}else setCm(m=>m+1);}
  const DL=["Lu","Ma","Mi","Ju","Vi","Sá","Do"];
  return(
    <Overlay onClose={onClose}>
      <Tag>NUEVA RESERVA</Tag><Title>Puesto {sid}</Title>
      <div style={{color:"#1e4060",fontSize:12,marginBottom:18}}>Selecciona fechas · <span style={{color:"#6b5a30"}}>Ámbar = ya tienes reserva ese día</span></div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <button onClick={pm} style={CB}>‹</button>
        <span style={{fontSize:13,fontWeight:600,color:"#7dd3fc",textTransform:"capitalize"}}>{fmtMY(cy,cm)}</span>
        <button onClick={nm} style={CB}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:6}}>
        {DL.map(l=><div key={l} style={{textAlign:"center",fontSize:9,color:"#1e3a5f",fontWeight:700,padding:"2px 0",letterSpacing:1}}>{l}</div>)}
        {Array.from({length:first}).map((_,i)=><div key={"e"+i}/>)}
        {Array.from({length:days},(_,i)=>i+1).map(d=>{
          const iso=isoD(d),dow=(fromISO(iso).getDay()+6)%7;
          const we=dow>=5,past=fromISO(iso)<getToday(),fix=!!db.fixed[sid];
          const occ=seatTaken.has(iso),ub=alreadyBooked.has(iso)&&!sel.includes(iso);
          const isSel=sel.includes(iso),isTod=iso===today,dis=we||past||fix||occ||ub;
          let bg="transparent",bo="#162032",co="#3a5a7a";
          if(we||past){co="#1e2535";bo="#0d1525";}
          else if(fix){bg=C_FIX+"18";bo=C_FIX+"50";co="#f87171";}
          else if(occ){bg=C_OCC+"18";bo=C_OCC+"50";co="#60a5fa";}
          else if(ub){bg="#f59e0b14";bo="#f59e0b40";co="#b45309";}
          else if(isSel){bg=C_FREE+"22";bo=C_FREE;co="#34d399";}
          else{co="#94a3b8";}
          return(
            <div key={d} onClick={()=>!dis&&toggle(d)} title={occ?"Ocupado":ub?"Ya tienes reserva":""}
              style={{textAlign:"center",borderRadius:6,padding:"5px 2px",fontSize:12,fontWeight:isSel?700:400,background:bg,border:"1px solid "+bo,color:co,cursor:dis?"not-allowed":"pointer",outline:isTod?"2px solid #0891b240":"none",outlineOffset:1,minHeight:30,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
              {d}{isSel&&<div style={{width:4,height:4,borderRadius:"50%",background:C_FREE}}/>}
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"10px 0 14px",fontSize:10}}>
        <Dot c={C_FREE} l="Seleccionado"/><Dot c={C_OCC} l="Ocupado"/><Dot c={C_FIX} l="Fijo"/><Dot c="#f59e0b" l="Ya tienes reserva"/>
      </div>
      {sel.length>0&&<div style={{background:"#060c14",border:"1px solid #162032",borderRadius:8,padding:"8px 12px",marginBottom:14,fontSize:11,color:"#22d3ee",lineHeight:1.8}}><span style={{color:"#1e4060",marginRight:6}}>Seleccionadas ({sel.length}):</span>{sel.slice().sort().map(d=>fmtShort(d)).join(" · ")}</div>}
      <Row><Btn ghost onClick={onClose}>Cancelar</Btn><Btn primary onClick={()=>onConfirm(sid,sel)} disabled={sel.length===0}>Confirmar{sel.length?" ("+sel.length+")":""}</Btn></Row>
    </Overlay>
  );
}

function QuickAdminModal({sid,iso,db,stOf,resOf,onToggle,onRelease,onClose}){
  const[name,setName]=useState(db.fixed[sid]||"");
  const isF=!!db.fixed[sid],st=stOf(sid,iso),r=resOf(sid,iso);
  const col=st==="fixed"?C_FIX:st==="occupied"?C_OCC:C_FREE;
  const lbl=st==="fixed"?"Fijo":st==="occupied"?"Ocupado":"Libre";
  return(
    <Overlay onClose={onClose}>
      <div style={{fontSize:10,color:"#4c1d95",fontWeight:700,letterSpacing:2,marginBottom:8}}>⚙ GESTIÓN RÁPIDA</div>
      <Title>Puesto {sid}</Title><Sub>{iso&&fmtShort(iso)}</Sub>
      <div style={{background:"#060c14",borderRadius:8,padding:12,marginBottom:16,fontSize:13,border:"1px solid #162032"}}>
        <div style={{color:"#2a4060",marginBottom:(r||isF)?6:0}}>Estado: <span style={{color:col,fontWeight:600}}>{lbl}</span></div>
        {r&&<div style={{color:"#1e3a5f",fontSize:12}}>Reservado por: <span style={{color:"#4a9ebe"}}>{r.u}</span></div>}
        {isF&&<div style={{color:"#1e3a5f",fontSize:12}}>Titular: <span style={{color:C_FIX}}>{db.fixed[sid]}</span></div>}
      </div>
      {!isF&&<div style={{marginBottom:16}}><div style={{fontSize:10,color:"#1e3a5f",fontWeight:700,letterSpacing:1,marginBottom:6}}>ASIGNAR TITULAR FIJO:</div><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre del titular" style={{width:"100%",background:"#060c14",border:"1px solid #162032",color:"#dde6f0",padding:"8px 12px",borderRadius:7,fontSize:14,outline:"none",fontFamily:"inherit"}} onFocus={e=>e.target.style.borderColor="#22d3ee"} onBlur={e=>e.target.style.borderColor="#162032"}/></div>}
      <Row>
        <Btn ghost onClick={onClose}>Cancelar</Btn>
        {r&&!isF&&<Btn danger onClick={()=>onRelease(sid,iso)}>🗑 Liberar</Btn>}
        {isF?<Btn danger onClick={()=>onToggle(sid,"")}>🔓 Desbloquear</Btn>:<Btn purple onClick={()=>onToggle(sid,name)}>🔒 Marcar fijo</Btn>}
      </Row>
    </Overlay>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({db,onLogin}){
  const[name,setName]=useState("");
  const[pass,setPass]=useState("");
  const[showPass,setShowPass]=useState(false);
  const[error,setError]=useState("");

  function go(){
    if(!name.trim()||!pass.trim())return;
    const found=(db.users||[]).find(u=>u.name.toLowerCase()===name.trim().toLowerCase());
    if(!found){setError("Usuario no encontrado.");return;}
    if(found.password!==pass){setError("Contraseña incorrecta.");return;}
    onLogin({name:found.name,role:found.role});
  }

  return(
    <div style={{background:"#080e17",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Outfit',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');@keyframes hdUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes hdShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}`}</style>
      <div style={{background:"#0b1422",border:"1px solid #162032",borderRadius:16,padding:40,width:"100%",maxWidth:380,animation:"hdUp .3s ease",boxShadow:"0 32px 80px rgba(0,0,0,.7)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:44,fontWeight:800,letterSpacing:-1,marginBottom:6,color:"#dde6f0"}}><span style={{color:"#22d3ee"}}>Hot</span>Desk</div>
          <div style={{color:"#1e3a5f",fontSize:10,letterSpacing:3,fontWeight:700}}>SISTEMA DE RESERVA DE PUESTOS</div>
        </div>

        <div style={{fontSize:10,color:"#1e3a5f",fontWeight:700,letterSpacing:1,marginBottom:6}}>USUARIO</div>
        <input value={name} onChange={e=>{setName(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&go()}
          placeholder="Tu nombre de usuario" autoFocus
          style={{width:"100%",background:"#060c14",border:"1px solid "+(error?"#7f1d1d":"#162032"),color:"#dde6f0",padding:"11px 14px",borderRadius:8,fontSize:15,outline:"none",marginBottom:14,fontFamily:"inherit"}}
          onFocus={e=>e.target.style.borderColor=error?"#dc2626":"#22d3ee"} onBlur={e=>e.target.style.borderColor=error?"#7f1d1d":"#162032"}/>

        <div style={{fontSize:10,color:"#1e3a5f",fontWeight:700,letterSpacing:1,marginBottom:6}}>CONTRASEÑA</div>
        <div style={{position:"relative",marginBottom:error?10:24}}>
          <input value={pass} onChange={e=>{setPass(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&go()}
            placeholder="Contraseña" type={showPass?"text":"password"}
            style={{width:"100%",background:"#060c14",border:"1px solid "+(error?"#7f1d1d":"#162032"),color:"#dde6f0",padding:"11px 42px 11px 14px",borderRadius:8,fontSize:15,outline:"none",fontFamily:"inherit"}}
            onFocus={e=>e.target.style.borderColor=error?"#dc2626":"#22d3ee"} onBlur={e=>e.target.style.borderColor=error?"#7f1d1d":"#162032"}/>
          <button onClick={()=>setShowPass(v=>!v)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"transparent",border:"none",color:"#2a4060",cursor:"pointer",fontSize:16,padding:2}}>
            {showPass?"🙈":"👁"}
          </button>
        </div>

        {error&&(
          <div style={{background:"#1a0505",border:"1px solid #7f1d1d",borderRadius:7,padding:"8px 12px",marginBottom:16,fontSize:12,color:"#fca5a5",animation:"hdShake .3s ease"}}>
            ⚠ {error}
          </div>
        )}

        <button onClick={go} disabled={!name.trim()||!pass.trim()}
          style={{width:"100%",padding:12,borderRadius:8,background:(name.trim()&&pass.trim())?"#0c4a6e":"#060c14",border:"1px solid "+((name.trim()&&pass.trim())?"#0891b2":"#162032"),color:(name.trim()&&pass.trim())?"#bae6fd":"#1e3a5f",fontSize:15,fontWeight:600,cursor:(name.trim()&&pass.trim())?"pointer":"not-allowed",fontFamily:"inherit",transition:"all .12s"}}>
          Entrar →
        </button>

        <div style={{marginTop:20,padding:"10px 12px",background:"#060c14",border:"1px solid #0a1525",borderRadius:7,fontSize:11,color:"#1e3a5f",textAlign:"center"}}>
          Acceso por defecto: <span style={{color:"#2a4060"}}>Admin / admin</span>
        </div>
      </div>
    </div>
  );
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function Dot({c,l}){return <span style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#3a5a7a"}}><span style={{width:9,height:9,borderRadius:2,background:c,display:"inline-block"}}/>{l}</span>;}
function Tag({children}){return <div style={{fontSize:10,color:"#1e4d6a",fontWeight:700,letterSpacing:2,marginBottom:8}}>{children}</div>;}
function Title({children}){return <div style={{fontSize:22,fontWeight:700,marginBottom:4}}>{children}</div>;}
function Sub({children}){return <div style={{color:"#2a4a6e",fontSize:13,marginBottom:20}}>{children}</div>;}
function Row({children}){return <div style={{display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap"}}>{children}</div>;}
function Btn({ghost,primary,danger,purple,onClick,disabled,children}){
  const s=primary?{bg:"#0c4a6e",bo:"#0891b2",co:"#bae6fd"}:danger?{bg:"#450a0a",bo:"#dc2626",co:"#fca5a5"}:purple?{bg:"#2e1065",bo:"#7c3aed",co:"#ddd6fe"}:{bg:"transparent",bo:"#1e2a3a",co:"#64748b"};
  return <button onClick={onClick} disabled={disabled} style={{background:s.bg,border:"1px solid "+s.bo,color:s.co,padding:"8px 16px",borderRadius:7,fontSize:13,fontWeight:500,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",opacity:disabled?0.45:1,transition:"opacity .12s"}} onMouseOver={e=>{if(!disabled)e.currentTarget.style.opacity="0.7";}} onMouseOut={e=>{e.currentTarget.style.opacity=disabled?"0.45":"1";}}>{children}</button>;
}
function Overlay({onClose,children}){
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,animation:"hdFade .15s"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#0b1422",border:"1px solid #1e3350",borderRadius:14,padding:28,minWidth:300,maxWidth:440,width:"calc(100% - 32px)",boxShadow:"0 30px 80px rgba(0,0,0,.8)",animation:"hdUp .2s ease",maxHeight:"90vh",overflowY:"auto"}}>{children}</div>
    </div>
  );
}

const GS=`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box}@keyframes hdUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes hdFade{from{opacity:0}to{opacity:1}}@keyframes hdSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes hdShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}.hd-seat{cursor:pointer;transition:filter .12s}.hd-seat:hover{filter:brightness(1.4) drop-shadow(0 0 6px rgba(100,220,255,.5))}.hd-cell{cursor:pointer;transition:opacity .12s}.hd-cell:hover{opacity:.65}select option{background:#0b1422}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:#0b1422}::-webkit-scrollbar-thumb{background:#162032;border-radius:3px}`;
const NB={background:"#0b1422",border:"1px solid #162032",color:"#64748b",padding:"6px 11px",borderRadius:7,fontSize:13,cursor:"pointer",outline:"none"};
const CB={background:"#060c14",border:"1px solid #162032",color:"#4a7090",width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"};
const TH={padding:"7px 4px",textAlign:"center",borderBottom:"2px solid #162032",color:"#1e3a5f",fontWeight:700,fontSize:11};
