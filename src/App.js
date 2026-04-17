import { useState, useEffect, useCallback } from "react";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, onSnapshot, collection
} from "firebase/firestore";

// ============================================================
// WHO IS THE PARENT? Set your Firebase UID here after first login.
// Leave blank for now — after you sign up, check the browser console
// for "Your UID:" and paste it here, then redeploy.
// ============================================================
const PARENT_UID = "jELz4gid8PQ8GipfvGkWgRSDNRm2"; // e.g. "abc123xyz" — fill in after first login

// ============================================================
// CONFIGURATION
// ============================================================
const GOAL = 325;

const MILESTONES = [
  { pct: 25,  label: "Quarter Way!",    emoji: "🥉", color: "#cd7f32", amount: GOAL * 0.25 },
  { pct: 50,  label: "Halfway Home!",   emoji: "🥈", color: "#c0c0c0", amount: GOAL * 0.50 },
  { pct: 75,  label: "Almost There!",   emoji: "🥇", color: "#ffd700", amount: GOAL * 0.75 },
  { pct: 100, label: "SWITCH UNLOCKED!",emoji: "🏆", color: "#ff6bff", amount: GOAL        },
];

const RATINGS = {
  great: { emoji: "😄", label: "Great",       multiplier: 1.00 },
  okay:  { emoji: "😐", label: "Okay",        multiplier: 0.75 },
  rough: { emoji: "😕", label: "Rough",       multiplier: 0.25 },
  none:  { emoji: "❌", label: "Didn't earn", multiplier: 0.00 },
};
const RATING_KEYS = ["great","okay","rough","none"];
const isStreakWorthy = r => r === "great" || r === "okay";

const EARNINGS = {
  jewishClass1: { label: "Jewish Class 1",              amount: 1.00, difficulty: 2 },
  break:        { label: "Break",                       amount: 0.50, difficulty: 1 },
  jewishClass2: { label: "Jewish Class 2",              amount: 1.50, difficulty: 3 },
  recess1:      { label: "Recess (Morning)",            amount: 0.50, difficulty: 1 },
  jewishClass3: { label: "Jewish Class 3",              amount: 2.00, difficulty: 4 },
  lunch:        { label: "Lunch",                       amount: 0.50, difficulty: 1 },
  mincha:       { label: "Mincha 🙏",                   amount: 0.50, difficulty: 1 },
  recess2:      { label: "Recess (Afternoon)",          amount: 0.50, difficulty: 1 },
  secClass4:    { label: "Class 4 — Mr. Berger (Math)", amount: 0.75, difficulty: 2 },
};

const TEACHERS = {
  rabbiR: { label: "Rabbi Rothberger", amount: 0.75, difficulty: 1 },
  rabbiI: { label: "Rabbi Isaac",      amount: 2.00, difficulty: 4 },
  mrsW:   { label: "Mrs. Welikson",    amount: 1.50, difficulty: 3 },
  gym:    { label: "Gym",              amount: 0.50, difficulty: 1 },
};

const BEDTIME_OPTIONS = {
  early:   { label: "In bed by 10:30pm 🌟", amount: 5.00 },
  regular: { label: "In bed by 11pm",       amount: 3.00 },
  none:    { label: "No bedtime bonus",      amount: 0.00 },
};

const STREAK_DEFS = {
  jewishClass1: { label: "Rodkin Rising",      emoji: "📕", color: "#ff6b9d", tier: "hard", desc: "Jewish Class 1",
    milestones: [{n:3,bonus:1,badge:"🥉",secretName:"Early Bird"},{n:5,bonus:2,badge:"🥈",secretName:"Morning Mode"},{n:10,bonus:5,badge:"🏆",secretName:"Class Act"}] },
  jewishClass2: { label: "Rodkin Steady",      emoji: "📗", color: "#fb923c", tier: "hard", desc: "Jewish Class 2",
    milestones: [{n:3,bonus:1,badge:"🥉",secretName:"Holding Strong"},{n:5,bonus:2,badge:"🥈",secretName:"Locked In"},{n:10,bonus:5,badge:"🏆",secretName:"Iron Will"}] },
  jewishClass3: { label: "Rodkin Strong",      emoji: "📘", color: "#f87171", tier: "hard", desc: "Jewish Class 3",
    milestones: [{n:3,bonus:1,badge:"🥉",secretName:"The Push"},{n:5,bonus:2,badge:"🥈",secretName:"Last Man Standing"},{n:10,bonus:5,badge:"🏆",secretName:"Conqueror"}] },
  rabbiI:       { label: "Rabbi I Warrior",    emoji: "🔥", color: "#ff4500", tier: "hard", desc: "Rabbi Isaac's class",
    milestones: [{n:3,bonus:1,badge:"🥉",secretName:"Brave Heart"},{n:5,bonus:2,badge:"🥈",secretName:"Battle Tested"},{n:10,bonus:5,badge:"🏆",secretName:"Rabbi I's Respect"}] },
  mrsW:         { label: "Welikson Wonder",    emoji: "⭐", color: "#ffd93d", tier: "hard", desc: "Mrs. Welikson's class",
    milestones: [{n:3,bonus:1,badge:"🥉",secretName:"Gold Star"},{n:5,bonus:2,badge:"🥈",secretName:"Teacher's Champion"},{n:10,bonus:5,badge:"🏆",secretName:"Welikson's MVP"}] },
  recess1:      { label: "Morning Maverick",   emoji: "🌅", color: "#f59e0b", tier: "easy", desc: "Morning recess",
    milestones: [{n:5,bonus:0.5,badge:"🥉",secretName:"Chill Vibes"},{n:10,bonus:1,badge:"🥈",secretName:"Recess King"},{n:20,bonus:2,badge:"🏆",secretName:"Untouchable"}] },
  recess2:      { label: "Afternoon All-Star", emoji: "☀️", color: "#facc15", tier: "easy", desc: "Afternoon recess",
    milestones: [{n:5,bonus:0.5,badge:"🥉",secretName:"Cool Down"},{n:10,bonus:1,badge:"🥈",secretName:"Afternoon Pro"},{n:20,bonus:2,badge:"🏆",secretName:"All Day Every Day"}] },
  berger:       { label: "Number Ninja",       emoji: "➕", color: "#4d96ff", tier: "easy", desc: "Math with Mr. Berger",
    milestones: [{n:5,bonus:0.5,badge:"🥉",secretName:"Calculator"},{n:10,bonus:1,badge:"🥈",secretName:"Math Whiz"},{n:20,bonus:2,badge:"🏆",secretName:"Einstein Mode"}] },
  rabbiR:       { label: "Rothberger Rock Solid", emoji: "🕍", color: "#6bcb77", tier: "easy", desc: "Rabbi Rothberger's class",
    milestones: [{n:5,bonus:0.5,badge:"🥉",secretName:"Steady Eddie"},{n:10,bonus:1,badge:"🥈",secretName:"Rock Solid"},{n:20,bonus:2,badge:"🏆",secretName:"The Foundation"}] },
};

const HAT_TRICK_DEF = {
  label: "Rodkin Hat Trick", emoji: "👑", color: "#c084fc", desc: "All 3 Jewish periods 😄/😐 same day",
  milestones: [{n:3,bonus:2,badge:"🥉",secretName:"Triple Threat"},{n:7,bonus:4,badge:"🥈",secretName:"Morning Maestro"},{n:15,bonus:8,badge:"🏆",secretName:"Rodkin Legend"}],
};

// ============================================================
// DATE HELPERS
// ============================================================
function toLocalIso(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function getTodayIso() { return toLocalIso(new Date()); }
function parseLocal(iso) { const [y,m,d]=iso.split("-").map(Number); return new Date(y,m-1,d,12,0,0); }
function formatDate(iso) { return parseLocal(iso).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}); }
function getDow(iso) { return parseLocal(iso).getDay(); }
function isFriday(iso) { return getDow(iso)===5; }
function hasBedtime(iso) { return !isFriday(iso); }

// ============================================================
// CALENDAR
// ============================================================
function buildSchoolDays() {
  const days=[], noSchool=["2026-04-26","2026-05-22","2026-05-23"], hebrewOnly=["2026-05-21","2026-05-25","2026-06-23"];
  const start=new Date(2026,3,15,12,0,0), end=new Date(2026,5,23,12,0,0);
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
    const dow=d.getDay(); if(dow===6) continue;
    const iso=toLocalIso(d); if(noSchool.includes(iso)) continue;
    const type=(dow===0||dow===5||hebrewOnly.includes(iso))?"hebrew":"full";
    days.push({date:iso,type,isWednesday:dow===3,isSunday:dow===0,dow});
  }
  return days;
}
function buildBedtimeNights() {
  const nights=[], start=new Date(2026,3,15,12,0,0), end=new Date(2026,5,23,12,0,0);
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){ const iso=toLocalIso(d); if(!isFriday(iso)) nights.push(iso); }
  return nights;
}

const SCHOOL_DAYS = buildSchoolDays();
const BEDTIME_NIGHTS = buildBedtimeNights();
const getSchoolDay = iso => SCHOOL_DAYS.find(d=>d.date===iso);
const isPastOrToday = iso => iso <= getTodayIso();
const loggableSchoolDays = () => SCHOOL_DAYS.filter(d=>isPastOrToday(d.date));
const loggableBedtimeNights = () => BEDTIME_NIGHTS.filter(iso=>isPastOrToday(iso));

const diffColor = n => n<=1?"#4ade80":n===2?"#facc15":n===3?"#fb923c":"#f87171";
const diffStars = n => "★".repeat(n)+"☆".repeat(4-n);
const calcEarning = (base,rk) => rk?parseFloat((base*(RATINGS[rk]?.multiplier||0)).toFixed(2)):0;
const getMilestonesEarned = t => MILESTONES.filter(m=>t>=m.amount);
const getNextMilestone = t => MILESTONES.find(m=>t<m.amount)||null;

// ============================================================
// STREAK COMPUTATION
// ============================================================
function computeStreaks(schoolLogs) {
  const dates=Object.keys(schoolLogs).sort();
  const streaks={};
  Object.keys(STREAK_DEFS).forEach(k=>{ streaks[k]={current:0,best:0}; });
  const hatTrickDays=[];
  dates.forEach(date=>{
    const log=schoolLogs[date]; const ratings=log.ratings||{}; const teachers=log.teachers||{};
    ["jewishClass1","jewishClass2","jewishClass3"].forEach(k=>{
      if(ratings[k]!==undefined){ if(isStreakWorthy(ratings[k])){streaks[k].current++;streaks[k].best=Math.max(streaks[k].best,streaks[k].current);}else{streaks[k].current=0;} }
    });
    const jc1=ratings.jewishClass1,jc2=ratings.jewishClass2,jc3=ratings.jewishClass3;
    if(jc1!==undefined&&jc2!==undefined&&jc3!==undefined&&isStreakWorthy(jc1)&&isStreakWorthy(jc2)&&isStreakWorthy(jc3)) hatTrickDays.push(date);
    ["recess1","recess2"].forEach(k=>{
      if(ratings[k]!==undefined){ if(isStreakWorthy(ratings[k])){streaks[k].current++;streaks[k].best=Math.max(streaks[k].best,streaks[k].current);}else{streaks[k].current=0;} }
    });
    ["secClass1","secClass2","secClass3","secClass5"].forEach(k=>{
      const teacher=teachers[k]; if(!teacher) return; const r=ratings[k]; if(r===undefined) return;
      if(teacher==="rabbiI"){ if(isStreakWorthy(r)){streaks.rabbiI.current++;streaks.rabbiI.best=Math.max(streaks.rabbiI.best,streaks.rabbiI.current);}else{streaks.rabbiI.current=0;} }
      else if(teacher==="mrsW"){ if(isStreakWorthy(r)){streaks.mrsW.current++;streaks.mrsW.best=Math.max(streaks.mrsW.best,streaks.mrsW.current);}else{streaks.mrsW.current=0;} }
      else if(teacher==="rabbiR"){ if(isStreakWorthy(r)){streaks.rabbiR.current++;streaks.rabbiR.best=Math.max(streaks.rabbiR.best,streaks.rabbiR.current);}else{streaks.rabbiR.current=0;} }
    });
    if(ratings.secClass4!==undefined){ if(isStreakWorthy(ratings.secClass4)){streaks.berger.current++;streaks.berger.best=Math.max(streaks.berger.best,streaks.berger.current);}else{streaks.berger.current=0;} }
  });
  return {streaks,hatTrickCount:hatTrickDays.length,hatTrickDays};
}

function getNewMilestones(key,oldC,newC,def) {
  return def.milestones.filter(m=>oldC<m.n&&newC>=m.n);
}

// ============================================================
// FIRESTORE HELPERS
// ============================================================
// We store all data under /trackerData/{NOACH_UID}/
// Parent reads same UID via real-time listener

async function saveToFirestore(uid, key, value) {
  try {
    await setDoc(doc(db, "trackerData", uid, "data", key), { value: JSON.stringify(value) }, { merge: true });
  } catch(e) { console.error("Save error:", e); }
}

// ============================================================
// ROOT APP
// ============================================================
export default function App() {
  const [authUser,    setAuthUser]    = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isParent,    setIsParent]    = useState(false);
  const [noachUID,    setNoachUID]    = useState(null);

  // Listen for auth state
  useEffect(()=>{
    return onAuthStateChanged(auth, user=>{
      setAuthUser(user);
      setAuthLoading(false);
      if(user) {
        console.log("Your UID:", user.uid); // For setting PARENT_UID
        const parentIsLoggedIn = PARENT_UID && user.uid === PARENT_UID;
        setIsParent(parentIsLoggedIn);
        // If parent, watch Noach's data. If Noach, watch own data.
        // For now noachUID is either self (if Noach) or the stored Noach UID
        if(!parentIsLoggedIn) setNoachUID(user.uid);
      }
    });
  },[]);

  if(authLoading) return <LoadingScreen/>;
  if(!authUser)   return <AuthScreen/>;

  // Parent watching Noach's data — needs Noach's UID stored
  if(isParent) return <ParentLiveView parentUser={authUser}/>;

  // Noach's view
  return <TrackerApp user={authUser} isParent={false}/>;
}

// ============================================================
// LOADING SCREEN
// ============================================================
function LoadingScreen() {
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(145deg,#0d0b1e,#1a1040)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{fontSize:48,animation:"spin 1s linear infinite"}}>🎮</div>
      <div style={{fontFamily:"'Fredoka One',cursive",fontSize:20,color:"#ffd93d"}}>Loading...</div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;700;800;900&display=swap'); @keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box} body{margin:0;font-family:'Nunito',sans-serif;}`}</style>
    </div>
  );
}

// ============================================================
// AUTH SCREEN
// ============================================================
function AuthScreen() {
  const [mode,     setMode]     = useState("login"); // login | signup
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if(mode==="signup") await createUserWithEmailAndPassword(auth,email,password);
      else                await signInWithEmailAndPassword(auth,email,password);
    } catch(err) {
      setError(err.message.replace("Firebase: ","").replace(/\(auth.*\)/,""));
    }
    setLoading(false);
  }

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(145deg,#0d0b1e 0%,#1a1040 50%,#0d1f3c 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Nunito',sans-serif",color:"#fff"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;700;800;900&display=swap'); *{box-sizing:border-box} body{margin:0} input{outline:none;} button{cursor:pointer;border:none;}`}</style>
      <div style={{width:"100%",maxWidth:360,textAlign:"center"}}>
        <div style={{fontSize:64,marginBottom:8,animation:"floatY 3s ease-in-out infinite"}}>🎮</div>
        <h1 style={{fontFamily:"'Fredoka One',cursive",fontSize:28,margin:"0 0 4px",background:"linear-gradient(90deg,#ffd93d,#ff6b9d,#6bcb77)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          Noach's Switch 2
        </h1>
        <p style={{fontSize:13,opacity:.5,marginBottom:32,fontWeight:700}}>Earn it. Own it. Play it. 🎯</p>

        <div style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:20,padding:28}}>
          <div style={{display:"flex",gap:8,marginBottom:24}}>
            {["login","signup"].map(m=>(
              <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"10px",borderRadius:12,background:mode===m?"rgba(255,217,61,.15)":"rgba(255,255,255,.05)",border:`1px solid ${mode===m?"rgba(255,217,61,.4)":"rgba(255,255,255,.1)"}`,color:mode===m?"#ffd93d":"rgba(255,255,255,.5)",fontFamily:"'Fredoka One',cursive",fontSize:15,transition:"all .2s"}}>
                {m==="login"?"Sign In":"Sign Up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:12}}>
            <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required
              style={{padding:"12px 16px",borderRadius:12,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",color:"#fff",fontSize:15,fontFamily:"'Nunito',sans-serif",fontWeight:700}}/>
            <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}
              style={{padding:"12px 16px",borderRadius:12,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",color:"#fff",fontSize:15,fontFamily:"'Nunito',sans-serif",fontWeight:700}}/>
            {error&&<div style={{color:"#f87171",fontSize:12,fontWeight:700,background:"rgba(248,113,113,.1)",border:"1px solid rgba(248,113,113,.2)",borderRadius:10,padding:"8px 12px"}}>{error}</div>}
            <button type="submit" disabled={loading} style={{padding:"14px",borderRadius:14,background:"linear-gradient(135deg,#ffd93d,#ff6b9d)",color:"#1a1a2e",fontFamily:"'Fredoka One',cursive",fontSize:18,marginTop:4,opacity:loading?.6:1}}>
              {loading?"...":(mode==="login"?"Let's Go! 🚀":"Create Account 🎮")}
            </button>
          </form>

          <p style={{fontSize:11,opacity:.4,marginTop:16,fontWeight:700,lineHeight:1.5}}>
            Noach uses one account. Mom uses a separate account.<br/>After signing up, check the browser console for your UID.
          </p>
        </div>
      </div>
      <style>{`@keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`}</style>
    </div>
  );
}

// ============================================================
// PARENT LIVE VIEW
// ============================================================
function ParentLiveView({parentUser}) {
  const [noachUID,    setNoachUID]    = useState(localStorage.getItem("noach_uid")||"");
  const [inputUID,    setInputUID]    = useState("");
  const [schoolLogs,  setSchoolLogs]  = useState({});
  const [bedtimeLogs, setBedtimeLogs] = useState({});
  const [bonuses,     setBonuses]     = useState([]);
  const [streakBonuses,setStreakBonuses]=useState([]);
  const [badgeAlbum,  setBadgeAlbum]  = useState([]);
  const [connected,   setConnected]   = useState(false);

  useEffect(()=>{
    if(!noachUID) return;
    // Real-time listener on Noach's data
    const unsubs=[];
    const keys=[
      {key:"schoolLogs",  setter:setSchoolLogs},
      {key:"bedtimeLogs", setter:setBedtimeLogs},
      {key:"bonuses",     setter:setBonuses},
      {key:"streakBonuses",setter:setStreakBonuses},
      {key:"badgeAlbum",  setter:setBadgeAlbum},
    ];
    keys.forEach(({key,setter})=>{
      const unsub=onSnapshot(doc(db,"trackerData",noachUID,"data",key),snap=>{
        if(snap.exists()) { try{setter(JSON.parse(snap.data().value));}catch{} }
        setConnected(true);
      });
      unsubs.push(unsub);
    });
    return ()=>unsubs.forEach(u=>u());
  },[noachUID]);

  const schoolTotal  = Object.values(schoolLogs).reduce((s,l)=>s+(l.total||0),0);
  const bedtimeTotal = Object.values(bedtimeLogs).reduce((s,l)=>s+(l.amount||0),0);
  const bonusTotal   = bonuses.reduce((s,b)=>s+(b.amount||0),0);
  const streakTotal  = streakBonuses.reduce((s,b)=>s+(b.amount||0),0);
  const totalEarned  = parseFloat((schoolTotal+bedtimeTotal+bonusTotal+streakTotal).toFixed(2));
  const progress     = Math.min((totalEarned/GOAL)*100,100);
  const {streaks,hatTrickCount} = computeStreaks(schoolLogs);

  const schoolDays=[...Object.keys(schoolLogs)].sort((a,b)=>b.localeCompare(a));
  const bedNights=[...Object.keys(bedtimeLogs)].sort((a,b)=>b.localeCompare(a));

  if(!noachUID) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(145deg,#0d0b1e,#1a1040)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Nunito',sans-serif",color:"#fff"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;700;800;900&display=swap'); *{box-sizing:border-box} body{margin:0}`}</style>
      <div style={{width:"100%",maxWidth:360,textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:16}}>👩</div>
        <div style={{fontFamily:"'Fredoka One',cursive",fontSize:24,marginBottom:8}}>Parent Dashboard</div>
        <p style={{fontSize:13,opacity:.6,marginBottom:24,fontWeight:700}}>Enter Noach's UID to connect to his data live.</p>
        <input value={inputUID} onChange={e=>setInputUID(e.target.value)} placeholder="Noach's UID..."
          style={{width:"100%",padding:"12px 16px",borderRadius:12,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",color:"#fff",fontSize:14,fontFamily:"'Nunito',sans-serif",fontWeight:700,outline:"none",marginBottom:12}}/>
        <button onClick={()=>{localStorage.setItem("noach_uid",inputUID);setNoachUID(inputUID);}}
          style={{width:"100%",padding:"14px",borderRadius:14,background:"linear-gradient(135deg,#c084fc,#818cf8)",color:"#fff",fontFamily:"'Fredoka One',cursive",fontSize:18,border:"none",cursor:"pointer"}}>
          Connect 🔗
        </button>
      </div>
    </div>
  );

  const remaining = Math.max(GOAL-totalEarned,0);
  const counts={great:0,okay:0,rough:0,none:0}; let totalRated=0;
  Object.values(schoolLogs).forEach(log=>{Object.values(log.ratings||{}).forEach(r=>{if(r&&counts[r]!==undefined){counts[r]++;totalRated++;}});});

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(145deg,#0d0b1e 0%,#1a1040 50%,#0d1f3c 100%)",fontFamily:"'Nunito',sans-serif",color:"#fff",overflowX:"hidden"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;700;800;900&display=swap'); *{box-sizing:border-box} body{margin:0} .tap{cursor:pointer;border:none;background:none;outline:none;transition:opacity .15s;} .tap:active{opacity:.7}`}</style>
      <div style={{maxWidth:500,margin:"0 auto",padding:"20px 16px 40px"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <div style={{fontFamily:"'Fredoka One',cursive",fontSize:22}}>👩 Parent Dashboard</div>
            <div style={{fontSize:11,color:connected?"#6bcb77":"#f87171",fontWeight:800,marginTop:2}}>
              {connected?"🟢 Live":"🔴 Connecting..."}
            </div>
          </div>
          <button className="tap" onClick={()=>signOut(auth)} style={{fontSize:12,fontWeight:800,opacity:.5,color:"#fff",padding:"6px 10px",borderRadius:10,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)"}}>Sign Out</button>
        </div>

        {/* Grand total + split */}
        <div style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:20,padding:20,marginBottom:14}}>
          <div style={{fontSize:10,opacity:.5,fontWeight:900,marginBottom:4,letterSpacing:.5}}>GRAND TOTAL</div>
          <div style={{fontFamily:"'Fredoka One',cursive",fontSize:44,color:"#ffd93d",marginBottom:12}}>${totalEarned.toFixed(2)}</div>
          <div style={{background:"rgba(255,255,255,.08)",borderRadius:100,height:14,overflow:"hidden",marginBottom:10}}>
            <div style={{width:`${progress}%`,height:"100%",background:"linear-gradient(90deg,#ffd93d,#6bcb77)",borderRadius:100,transition:"width .8s ease"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div style={{background:"rgba(77,150,255,.1)",border:"1px solid rgba(77,150,255,.2)",borderRadius:12,padding:"10px 12px"}}>
              <div style={{fontSize:10,fontWeight:900,opacity:.6,marginBottom:4}}>📚 SCHOOL + BONUSES</div>
              <div style={{fontFamily:"'Fredoka One',cursive",fontSize:20,color:"#4d96ff"}}>${(schoolTotal+bonusTotal+streakTotal).toFixed(2)}</div>
              <div style={{fontSize:10,opacity:.45,fontWeight:700,marginTop:2}}>Dad splits this</div>
            </div>
            <div style={{background:"rgba(192,132,252,.1)",border:"1px solid rgba(192,132,252,.2)",borderRadius:12,padding:"10px 12px"}}>
              <div style={{fontSize:10,fontWeight:900,opacity:.6,marginBottom:4}}>🌙 BEDTIME</div>
              <div style={{fontFamily:"'Fredoka One',cursive",fontSize:20,color:"#c084fc"}}>${bedtimeTotal.toFixed(2)}</div>
              <div style={{fontSize:10,opacity:.45,fontWeight:700,marginTop:2}}>Mom keeps this</div>
            </div>
          </div>
          <div style={{marginTop:10,fontSize:11,opacity:.4,fontWeight:800}}>Remaining: ${remaining.toFixed(2)}</div>
        </div>

        {/* Behavior */}
        {totalRated>0&&(
          <div style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,padding:14,marginBottom:14}}>
            <div style={{fontSize:10,opacity:.5,fontWeight:900,marginBottom:10,letterSpacing:.5}}>BEHAVIOR BREAKDOWN</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,textAlign:"center"}}>
              {RATING_KEYS.map(rk=>(
                <div key={rk}>
                  <div style={{fontSize:22}}>{RATINGS[rk].emoji}</div>
                  <div style={{fontFamily:"'Fredoka One',cursive",fontSize:18,marginTop:3}}>{Math.round((counts[rk]/totalRated)*100)}%</div>
                  <div style={{fontSize:10,opacity:.4,fontWeight:800}}>{counts[rk]}×</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active streaks */}
        {Object.entries(streaks).some(([,s])=>s.current>0)&&(
          <div style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,padding:14,marginBottom:14}}>
            <div style={{fontSize:10,opacity:.5,fontWeight:900,marginBottom:10,letterSpacing:.5}}>🔥 ACTIVE STREAKS</div>
            {Object.entries(STREAK_DEFS).filter(([k])=>streaks[k]?.current>0).map(([k,def])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <span style={{fontSize:20}}>{def.emoji}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:13}}>{def.label}</div>
                  <div style={{fontSize:11,opacity:.5,fontWeight:700}}>
                    {(()=>{const nxt=def.milestones.find(m=>streaks[k].current<m.n);return nxt?`${nxt.n-streaks[k].current} more for $${nxt.bonus}`:""})()}
                  </div>
                </div>
                <div style={{fontFamily:"'Fredoka One',cursive",fontSize:20,color:def.color}}>{streaks[k].current}🔥</div>
              </div>
            ))}
            {hatTrickCount>0&&(
              <div style={{display:"flex",alignItems:"center",gap:10,paddingTop:8,borderTop:"1px solid rgba(255,255,255,.07)"}}>
                <span style={{fontSize:20}}>👑</span>
                <div style={{flex:1,fontWeight:800,fontSize:13}}>Hat Tricks</div>
                <div style={{fontFamily:"'Fredoka One',cursive",fontSize:20,color:"#c084fc"}}>{hatTrickCount}👑</div>
              </div>
            )}
          </div>
        )}

        {/* School logs */}
        {schoolDays.length>0&&(
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,opacity:.5,fontWeight:900,marginBottom:8,letterSpacing:.5}}>SCHOOL LOGS</div>
            {schoolDays.map(date=>{
              const log=schoolLogs[date];
              const gc=Object.values(log.ratings||{}).filter(r=>r==="great").length;
              const hasNotes=log.notes&&Object.values(log.notes).some(n=>n&&n.trim());
              return(
                <div key={date} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:"12px 14px",marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:hasNotes?8:0}}>
                    <div>
                      <div style={{fontWeight:800,fontSize:13}}>{formatDate(date)}</div>
                      <div style={{fontSize:11,opacity:.4,fontWeight:700,marginTop:2}}>{log.type==="full"?"Full":"Hebrew"} · {gc} 😄{log.gemaraStudied&&" · 📖"}{hasNotes&&" · 📝"}</div>
                    </div>
                    <div style={{fontFamily:"'Fredoka One',cursive",fontSize:17,color:"#ffd93d"}}>${(log.total||0).toFixed(2)}</div>
                  </div>
                  {hasNotes&&(
                    <div style={{display:"flex",flexDirection:"column",gap:5}}>
                      {Object.entries(log.notes||{}).filter(([,v])=>v&&v.trim()).map(([k,v])=>(
                        <div key={k} style={{background:"rgba(255,255,255,.06)",borderRadius:8,padding:"5px 9px",fontSize:12}}>
                          <span style={{fontWeight:800,opacity:.7}}>{EARNINGS[k]?.label||k}</span>
                          {log.ratings?.[k]&&<span style={{marginLeft:5}}>{RATINGS[log.ratings[k]]?.emoji}</span>}
                          <span style={{opacity:.5}}> — </span>
                          <span style={{opacity:.85}}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bedtime logs */}
        {bedNights.length>0&&(
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,opacity:.5,fontWeight:900,marginBottom:8,letterSpacing:.5}}>BEDTIME LOGS</div>
            {bedNights.map(date=>{
              const log=bedtimeLogs[date];
              return(
                <div key={date} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:"11px 14px",marginBottom:7,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:13}}>{formatDate(date)}</div>
                    <div style={{fontSize:11,opacity:.4,fontWeight:700,marginTop:2}}>{BEDTIME_OPTIONS[log.option]?.label||"—"}</div>
                  </div>
                  <div style={{fontFamily:"'Fredoka One',cursive",fontSize:17,color:"#c084fc"}}>${(log.amount||0).toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Badge album preview */}
        {badgeAlbum.length>0&&(
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,opacity:.5,fontWeight:900,marginBottom:10,letterSpacing:.5}}>🎖️ BADGES EARNED ({badgeAlbum.length})</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {badgeAlbum.map(b=>(
                <div key={b.id} style={{background:`${b.color}18`,border:`1px solid ${b.color}35`,borderRadius:12,padding:"8px 10px",textAlign:"center",minWidth:70}}>
                  <div style={{fontSize:20}}>{b.badge}</div>
                  <div style={{fontSize:9,fontWeight:900,color:b.color,marginTop:2,lineHeight:1.2}}>{b.secretName}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TRACKER APP (Noach's view) — full app with tabs
// ============================================================
function TrackerApp({user}) {
  const [tab,          setTab]          = useState("home");
  const [celebration,  setCelebration]  = useState(null);
  const [loaded,       setLoaded]       = useState(false);
  const [schoolLogs,   setSchoolLogs]   = useState({});
  const [bedtimeLogs,  setBedtimeLogs]  = useState({});
  const [bonuses,      setBonuses]      = useState([]);
  const [streakBonuses,setStreakBonuses]= useState([]);
  const [badgeAlbum,   setBadgeAlbum]   = useState([]);

  const uid = user.uid;

  // Load from Firestore on mount
  useEffect(()=>{
    async function load() {
      const keys = ["schoolLogs","bedtimeLogs","bonuses","streakBonuses","badgeAlbum"];
      const setters = {schoolLogs:setSchoolLogs,bedtimeLogs:setBedtimeLogs,bonuses:setBonuses,streakBonuses:setStreakBonuses,badgeAlbum:setBadgeAlbum};
      await Promise.all(keys.map(async k=>{
        try {
          const snap=await getDoc(doc(db,"trackerData",uid,"data",k));
          if(snap.exists()) setters[k](JSON.parse(snap.data().value));
        } catch(e) {}
      }));
      setLoaded(true);
    }
    load();
  },[uid]);

  const schoolTotal      = Object.values(schoolLogs).reduce((s,l)=>s+(l.total||0),0);
  const bedtimeTotal     = Object.values(bedtimeLogs).reduce((s,l)=>s+(l.amount||0),0);
  const bonusTotal       = bonuses.reduce((s,b)=>s+(b.amount||0),0);
  const streakBonusTotal = streakBonuses.reduce((s,b)=>s+(b.amount||0),0);
  const totalEarned      = parseFloat((schoolTotal+bedtimeTotal+bonusTotal+streakBonusTotal).toFixed(2));
  const progress         = Math.min((totalEarned/GOAL)*100,100);
  const earnedBadges     = getMilestonesEarned(totalEarned);
  const {streaks,hatTrickCount,hatTrickDays} = computeStreaks(schoolLogs);

  function fireCelebration(newT,oldT,streakInfo) {
    const newlyHit=getMilestonesEarned(newT).find(m=>!getMilestonesEarned(oldT).find(om=>om.pct===m.pct));
    if(streakInfo) setCelebration({type:"streak",...streakInfo});
    else if(newlyHit) setCelebration({type:"milestone",milestone:newlyHit});
    else setCelebration({type:"day"});
    setTimeout(()=>setCelebration(null),3800);
  }

  async function saveSchoolLog(date,log) {
    const oldStreaksData=computeStreaks(schoolLogs);
    const newLogs={...schoolLogs,[date]:log};
    const newStreaksData=computeStreaks(newLogs);
    const old=totalEarned;
    let streakRewardTotal=0;
    const newStreakBonusEntries=[];
    const newAlbumEntries=[];

    Object.entries(STREAK_DEFS).forEach(([key,def])=>{
      const oldC=oldStreaksData.streaks[key]?.current||0;
      const newC=newStreaksData.streaks[key]?.current||0;
      getNewMilestones(key,oldC,newC,def).forEach(m=>{
        newStreakBonusEntries.push({id:Date.now()+Math.random(),label:`${def.emoji} ${def.label} — ${m.n}-day streak! ${m.badge}`,amount:m.bonus,date,type:"streak",streakKey:key});
        newAlbumEntries.push({id:`${key}-${m.n}`,streakKey:key,milestoneN:m.n,secretName:m.secretName,badge:m.badge,emoji:def.emoji,streakLabel:def.label,color:def.color,dateEarned:date,bonus:m.bonus});
        streakRewardTotal+=m.bonus;
      });
    });
    getNewMilestones("hatTrick",oldStreaksData.hatTrickCount,newStreaksData.hatTrickCount,HAT_TRICK_DEF).forEach(m=>{
      newStreakBonusEntries.push({id:Date.now()+Math.random(),label:`${HAT_TRICK_DEF.emoji} ${HAT_TRICK_DEF.label} — ${m.n} hat tricks! ${m.badge}`,amount:m.bonus,date,type:"hatTrick"});
      newAlbumEntries.push({id:`hatTrick-${m.n}`,streakKey:"hatTrick",milestoneN:m.n,secretName:m.secretName,badge:m.badge,emoji:HAT_TRICK_DEF.emoji,streakLabel:HAT_TRICK_DEF.label,color:HAT_TRICK_DEF.color,dateEarned:date,bonus:m.bonus});
      streakRewardTotal+=m.bonus;
    });

    const newSL=newLogs; const newSB=[...streakBonuses,...newStreakBonusEntries];
    const existingIds=new Set(badgeAlbum.map(b=>b.id));
    const newBA=[...badgeAlbum,...newAlbumEntries.filter(b=>!existingIds.has(b.id))];

    setSchoolLogs(newSL);
    await saveToFirestore(uid,"schoolLogs",newSL);
    if(newStreakBonusEntries.length>0){setStreakBonuses(newSB);await saveToFirestore(uid,"streakBonuses",newSB);}
    if(newAlbumEntries.length>0){setBadgeAlbum(newBA);await saveToFirestore(uid,"badgeAlbum",newBA);}

    if(newStreakBonusEntries.length>0){
      const firstNew=newStreakBonusEntries[0]; const celebEntry=newAlbumEntries[0];
      fireCelebration(parseFloat((old+streakRewardTotal).toFixed(2)),old,{label:firstNew.label,emoji:celebEntry?.emoji||"🔥",amount:firstNew.amount,secretName:celebEntry?.secretName});
    } else {
      fireCelebration(parseFloat((schoolTotal+bedtimeTotal+bonusTotal+streakBonusTotal+(log.total||0)-(schoolLogs[date]?.total||0)).toFixed(2)),old,null);
    }
  }

  async function saveBedtimeLog(date,log){
    const old=totalEarned;
    const newBL={...bedtimeLogs,[date]:log};
    setBedtimeLogs(newBL);
    await saveToFirestore(uid,"bedtimeLogs",newBL);
    fireCelebration(parseFloat((schoolTotal+bedtimeTotal+bonusTotal+streakBonusTotal+(log.amount||0)-(bedtimeLogs[date]?.amount||0)).toFixed(2)),old,null);
  }

  async function addBonus(bonus){
    const old=totalEarned;
    const newB=[...bonuses,{...bonus,id:Date.now()}];
    setBonuses(newB);
    await saveToFirestore(uid,"bonuses",newB);
    fireCelebration(parseFloat((totalEarned+bonus.amount).toFixed(2)),old,null);
  }

  if(!loaded) return <LoadingScreen/>;

  const TABS=[
    {id:"home",     emoji:"🏠",label:"Home"},
    {id:"school",   emoji:"📚",label:"School"},
    {id:"bed",      emoji:"🌙",label:"Bedtime"},
    {id:"tests",    emoji:"⭐",label:"Bonuses"},
    {id:"trophies", emoji:"🏆",label:"Trophies"},
  ];

  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(145deg,#0d0b1e 0%,#1a1040 50%,#0d1f3c 100%)",fontFamily:"'Nunito',sans-serif",color:"#fff",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box} body{margin:0}
        .tap{cursor:pointer;transition:transform .14s,opacity .14s;user-select:none;border:none;outline:none;background:none}
        .tap:active{transform:scale(.95);opacity:.8}
        .rbtn{transition:transform .12s,box-shadow .14s;cursor:pointer;border:none;outline:none}
        .rbtn:hover{transform:scale(1.07)} .rbtn.sel{transform:scale(1.13)}
        textarea{resize:none;font-family:'Nunito',sans-serif;}
        @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-11px)}}
        @keyframes shimmer{0%{background-position:200% center}100%{background-position:-200% center}}
        @keyframes fall{0%{transform:translateY(-30px) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(800deg);opacity:0}}
        @keyframes pop{0%{transform:scale(0);opacity:0}65%{transform:scale(1.2)}100%{transform:scale(1);opacity:1}}
        @keyframes blink{0%,100%{opacity:.9}50%{opacity:.35}}
        @keyframes up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes badgePop{0%{transform:scale(0) rotate(-20deg);opacity:0}70%{transform:scale(1.25) rotate(5deg)}100%{transform:scale(1) rotate(0deg);opacity:1}}
        @keyframes streakPop{0%{transform:scale(0) rotate(-10deg);opacity:0}60%{transform:scale(1.3) rotate(5deg)}100%{transform:scale(1) rotate(0deg);opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {[...Array(20)].map((_,i)=>(
        <div key={i} style={{position:"fixed",borderRadius:"50%",width:i%4===0?5:2,height:i%4===0?5:2,background:"#fff",opacity:.06+(i%5)*.04,top:`${(i*47)%100}%`,left:`${(i*73)%100}%`,animation:`blink ${2+(i%4)}s ease-in-out infinite`,animationDelay:`${i*.2}s`,pointerEvents:"none"}}/>
      ))}

      {celebration&&(
        <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:999}}>
          {[...Array(44)].map((_,i)=>(
            <div key={i} style={{position:"absolute",width:i%3===0?13:8,height:i%3===0?13:8,borderRadius:i%2===0?"50%":3,background:["#ff6b6b","#ffd93d","#6bcb77","#4d96ff","#ff6bff","#fff"][i%6],left:`${4+(i*7.1)%92}%`,animation:`fall ${1.1+(i%9)*.18}s ease-in forwards`,animationDelay:`${(i%14)*.07}s`}}/>
          ))}
          {celebration.type==="streak"?(
            <>
              <div style={{position:"absolute",top:"25%",left:"50%",transform:"translate(-50%,-50%)",fontSize:76,animation:"streakPop .6s cubic-bezier(.34,1.56,.64,1)"}}>{celebration.emoji}</div>
              {celebration.secretName&&<div style={{position:"absolute",top:"40%",left:"50%",transform:"translate(-50%,-50%)",fontFamily:"'Fredoka One',cursive",fontSize:26,color:"#ffd93d",textShadow:"0 0 30px rgba(255,217,61,.9)",whiteSpace:"nowrap",animation:"pop .5s cubic-bezier(.34,1.56,.64,1) .15s both",textAlign:"center"}}>🏅 "{celebration.secretName}"</div>}
              <div style={{position:"absolute",top:celebration.secretName?"55%":"46%",left:"50%",transform:"translate(-50%,-50%)",fontFamily:"'Fredoka One',cursive",fontSize:26,color:"#6bcb77",animation:"pop .5s cubic-bezier(.34,1.56,.64,1) .3s both"}}>+${celebration.amount?.toFixed(2)} 💰</div>
            </>
          ):celebration.type==="milestone"?(
            <>
              <div style={{position:"absolute",top:"30%",left:"50%",transform:"translate(-50%,-50%)",fontSize:80,animation:"badgePop .6s cubic-bezier(.34,1.56,.64,1)"}}>{celebration.milestone.emoji}</div>
              <div style={{position:"absolute",top:"46%",left:"50%",transform:"translate(-50%,-50%)",fontFamily:"'Fredoka One',cursive",fontSize:28,color:celebration.milestone.color,textShadow:`0 0 30px ${celebration.milestone.color}`,whiteSpace:"nowrap",animation:"pop .5s cubic-bezier(.34,1.56,.64,1) .2s both"}}>{celebration.milestone.label}</div>
            </>
          ):(
            <>
              <div style={{position:"absolute",top:"37%",left:"50%",transform:"translate(-50%,-50%)",fontSize:74,animation:"pop .48s cubic-bezier(.34,1.56,.64,1)"}}>🎉</div>
              <div style={{position:"absolute",top:"51%",left:"50%",transform:"translate(-50%,-50%)",fontFamily:"'Fredoka One',cursive",fontSize:27,color:"#ffd93d",textShadow:"0 0 30px rgba(255,217,61,.9)",whiteSpace:"nowrap",animation:"pop .48s cubic-bezier(.34,1.56,.64,1) .2s both"}}>AWESOME JOB NOACH! 🔥</div>
            </>
          )}
        </div>
      )}

      <div style={{maxWidth:500,margin:"0 auto",padding:"0 16px 90px"}}>
        {tab==="home"    && <HomeTab totalEarned={totalEarned} progress={progress} earnedBadges={earnedBadges} schoolLogs={schoolLogs} bedtimeLogs={bedtimeLogs} schoolTotal={schoolTotal} bedtimeTotal={bedtimeTotal} bonusTotal={bonusTotal} streakBonusTotal={streakBonusTotal} streaks={streaks} hatTrickCount={hatTrickCount} onSignOut={()=>signOut(auth)}/>}
        {tab==="school"  && <SchoolTab schoolLogs={schoolLogs} onSave={saveSchoolLog}/>}
        {tab==="bed"     && <BedtimeTab bedtimeLogs={bedtimeLogs} onSave={saveBedtimeLog}/>}
        {tab==="tests"   && <BonusTab bonuses={bonuses} onAdd={addBonus}/>}
        {tab==="trophies"&& <TrophiesTab streaks={streaks} hatTrickCount={hatTrickCount} hatTrickDays={hatTrickDays} streakBonuses={streakBonuses} schoolLogs={schoolLogs} badgeAlbum={badgeAlbum}/>}
      </div>

      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(13,11,30,.95)",backdropFilter:"blur(16px)",borderTop:"1px solid rgba(255,255,255,.1)",display:"flex",justifyContent:"space-around",padding:"8px 0 12px",zIndex:100}}>
        {TABS.map(t=>{
          const active=tab===t.id;
          return(
            <button key={t.id} className="tap" onClick={()=>setTab(t.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"4px 10px",borderRadius:12,background:active?"rgba(255,217,61,.12)":"transparent",border:`1px solid ${active?"rgba(255,217,61,.3)":"transparent"}`}}>
              <span style={{fontSize:20}}>{t.emoji}</span>
              <span style={{fontSize:9,fontWeight:900,color:active?"#ffd93d":"rgba(255,255,255,.4)",letterSpacing:.3}}>{t.label.toUpperCase()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// HOME TAB
// ============================================================
function HomeTab({totalEarned,progress,earnedBadges,schoolLogs,bedtimeLogs,schoolTotal,bedtimeTotal,bonusTotal,streakBonusTotal,streaks,hatTrickCount,onSignOut}){
  const remaining=Math.max(GOAL-totalEarned,0);
  const next=getNextMilestone(totalEarned);
  const icon=progress<20?"🎮":progress<40?"🕹️":progress<60?"⚡":progress<80?"🔥":progress<100?"💥":"🏆";
  const todayIso=getTodayIso();
  const todaySchool=getSchoolDay(todayIso);
  const todaySchoolLogged=!!schoolLogs[todayIso];
  const todayBedLogged=!!bedtimeLogs[todayIso];
  const unloggedSchool=loggableSchoolDays().filter(d=>d.date!==todayIso&&!schoolLogs[d.date]).length;
  const topStreaks=Object.entries(STREAK_DEFS).map(([k,def])=>({key:k,def,current:streaks[k]?.current||0})).filter(s=>s.current>0).sort((a,b)=>b.current-a.current).slice(0,3);

  return(
    <div style={{animation:"up .5s ease both"}}>
      <div style={{textAlign:"center",paddingTop:40,paddingBottom:12}}>
        <div style={{fontSize:68,lineHeight:1,animation:"floatY 3s ease-in-out infinite"}}>{icon}</div>
        <h1 style={{fontFamily:"'Fredoka One',cursive",fontSize:32,margin:"10px 0 4px",background:"linear-gradient(90deg,#ffd93d,#ff6b9d,#6bcb77,#4d96ff)",backgroundSize:"200% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:"shimmer 4s linear infinite"}}>NOACH'S SWITCH 2</h1>
        <p style={{fontSize:12,opacity:.45,margin:0,fontWeight:700}}>Earn it. Own it. Play it. 🎯</p>
      </div>

      {earnedBadges.length>0&&(
        <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          {earnedBadges.map(m=>(
            <div key={m.pct} style={{display:"flex",flexDirection:"column",alignItems:"center",background:`${m.color}18`,border:`1px solid ${m.color}44`,borderRadius:12,padding:"6px 12px"}}>
              <span style={{fontSize:24}}>{m.emoji}</span>
              <span style={{fontSize:9,fontWeight:900,color:m.color,marginTop:2,letterSpacing:.3}}>{m.label.toUpperCase()}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{background:"rgba(255,255,255,.06)",backdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,.1)",borderRadius:24,padding:22,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
          <span style={{fontSize:11,opacity:.5,fontWeight:900,letterSpacing:.5}}>TOTAL EARNED</span>
          <span style={{fontSize:11,opacity:.4,fontWeight:900}}>GOAL: ${GOAL}</span>
        </div>
        <div style={{fontFamily:"'Fredoka One',cursive",fontSize:48,color:"#ffd93d",lineHeight:1.1,marginBottom:12}}>${totalEarned.toFixed(2)}</div>
        <div style={{position:"relative",marginBottom:22}}>
          <div style={{background:"rgba(255,255,255,.08)",borderRadius:100,height:22,overflow:"hidden"}}>
            <div style={{width:`${progress}%`,height:"100%",borderRadius:100,background:"linear-gradient(90deg,#ffd93d,#ff6b9d,#6bcb77)",backgroundSize:"200% auto",animation:"shimmer 3s linear infinite",transition:"width 1s cubic-bezier(.34,1.56,.64,1)",display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:8}}>
              {progress>9&&<span style={{fontSize:11,fontWeight:900,color:"#1a1a2e"}}>{Math.round(progress)}%</span>}
            </div>
          </div>
          {MILESTONES.map(m=>{
            const earned=totalEarned>=m.amount;
            return(<div key={m.pct} style={{position:"absolute",top:-4,left:`${m.pct}%`,transform:"translateX(-50%)",display:"flex",flexDirection:"column",alignItems:"center",pointerEvents:"none"}}>
              <div style={{width:3,height:30,background:earned?m.color:"rgba(255,255,255,.18)",borderRadius:2,transition:"background .5s"}}/>
              <span style={{fontSize:10,marginTop:1,opacity:earned?1:.25}}>{m.emoji}</span>
            </div>);
          })}
        </div>
        <div style={{fontSize:11,opacity:.4,fontWeight:900,textAlign:"right",marginBottom:10}}>${remaining.toFixed(2)} to go</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
          {[{label:"📚",value:schoolTotal},{label:"🌙",value:bedtimeTotal},{label:"⭐",value:bonusTotal},{label:"🔥",value:streakBonusTotal}].map(s=>(
            <div key={s.label} style={{background:"rgba(255,255,255,.06)",borderRadius:10,padding:"6px 4px",textAlign:"center"}}>
              <div style={{fontSize:14,marginBottom:2}}>{s.label}</div>
              <div style={{fontFamily:"'Fredoka One',cursive",fontSize:14,color:"#ffd93d"}}>${s.value.toFixed(2)}</div>
            </div>
          ))}
        </div>
        {next&&(<div style={{marginTop:12,background:`${next.color}14`,border:`1px solid ${next.color}26`,borderRadius:12,padding:"8px 12px",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:20}}>{next.emoji}</span>
          <div><div style={{fontSize:12,fontWeight:900,color:next.color}}>{next.label}</div><div style={{fontSize:11,opacity:.45,fontWeight:700}}>${(next.amount-totalEarned).toFixed(2)} away</div></div>
        </div>)}
      </div>

      {topStreaks.length>0&&(
        <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:14,marginBottom:12}}>
          <div style={{fontSize:11,opacity:.5,fontWeight:900,marginBottom:10,letterSpacing:.5}}>🔥 ACTIVE STREAKS</div>
          {topStreaks.map(s=>{
            const nextM=s.def.milestones.find(m=>s.current<m.n);
            return(<div key={s.key} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <span style={{fontSize:22}}>{s.def.emoji}</span>
              <div style={{flex:1}}><div style={{fontWeight:800,fontSize:13}}>{s.def.label}</div>{nextM&&<div style={{fontSize:11,opacity:.5,fontWeight:700}}>{nextM.n-s.current} more → ${nextM.bonus}</div>}</div>
              <div style={{fontFamily:"'Fredoka One',cursive",fontSize:22,color:s.def.color}}>{s.current}🔥</div>
            </div>);
          })}
        </div>
      )}

      <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:14,marginBottom:12}}>
        <div style={{fontSize:11,opacity:.5,fontWeight:900,marginBottom:10,letterSpacing:.5}}>TODAY — {formatDate(todayIso).toUpperCase()}</div>
        {todaySchool?(<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{fontWeight:700,fontSize:14}}>📚 {todaySchool.type==="full"?"Full":"Hebrew-only"} day</span><span>{todaySchoolLogged?"✅":"⏳"}</span></div>):(<div style={{opacity:.5,fontSize:14,fontWeight:700,marginBottom:6}}>🏖️ No school</div>)}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontWeight:700,fontSize:14}}>🌙 Bedtime</span><span>{!hasBedtime(todayIso)?"🕯️":bedtimeLogs[todayIso]?"✅":"⏳"}</span></div>
      </div>

      {unloggedSchool>0&&(<div style={{background:"rgba(251,191,36,.1)",border:"1px solid rgba(251,191,36,.25)",borderRadius:14,padding:"10px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:20}}>⏳</span>
        <div><div style={{fontWeight:800,fontSize:14}}>{unloggedSchool} past day{unloggedSchool>1?"s":""} not logged</div><div style={{fontSize:12,opacity:.6,fontWeight:700}}>Tap School tab</div></div>
      </div>)}

      <button className="tap" onClick={onSignOut} style={{width:"100%",padding:"11px",borderRadius:14,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.4)",fontFamily:"'Fredoka One',cursive",fontSize:14}}>Sign Out</button>
    </div>
  );
}

// ============================================================
// RATING PICKER
// ============================================================
function RatingPicker({periodKey,baseAmount,label,difficulty,rating,note,onChange,onNoteChange,teacherSlot}){
  const [showNote,setShowNote]=useState(!!note);
  const dc=difficulty?diffColor(difficulty):"#6bcb77";
  const earned=baseAmount!=null?calcEarning(baseAmount,rating):null;
  const active=rating&&rating!=="none";
  return(
    <div style={{background:active?`linear-gradient(135deg,${dc}20,${dc}08)`:"rgba(255,255,255,.04)",border:`2px solid ${active?dc:"rgba(255,255,255,.09)"}`,borderRadius:14,padding:"12px 14px",marginBottom:9,transition:"all .22s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:9}}>
        <div style={{flex:1}}><div style={{fontWeight:800,fontSize:14}}>{label}</div>{difficulty&&<div style={{fontSize:10,color:dc,marginTop:2}}>{diffStars(difficulty)}</div>}</div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button className="tap" onClick={()=>setShowNote(p=>!p)} style={{fontSize:15,opacity:showNote||note?1:.3}}>📝</button>
          <div style={{textAlign:"right",minWidth:52}}>
            {earned!=null&&<div style={{fontFamily:"'Fredoka One',cursive",fontSize:19,color:earned>0?"#ffd93d":"rgba(255,255,255,.22)",lineHeight:1}}>{earned>0?`$${earned.toFixed(2)}`:"—"}</div>}
            {baseAmount!=null&&rating&&rating!=="none"&&rating!=="great"&&<div style={{fontSize:9,opacity:.4,marginTop:1}}>of ${baseAmount.toFixed(2)}</div>}
          </div>
        </div>
      </div>
      {teacherSlot&&<div style={{marginBottom:9}}>{teacherSlot}</div>}
      {baseAmount!=null&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,marginBottom:(showNote||note)?10:0}}>
          {RATING_KEYS.map(rk=>{
            const sel=rating===rk;
            return(<button key={rk} className={`rbtn${sel?" sel":""}`} onClick={()=>onChange(periodKey,rk)} style={{border:`2px solid ${sel?"rgba(255,255,255,.7)":"rgba(255,255,255,.13)"}`,borderRadius:10,padding:"7px 2px",background:sel?"rgba(255,255,255,.16)":"rgba(255,255,255,.04)",color:"#fff",display:"flex",flexDirection:"column",alignItems:"center",gap:2,boxShadow:sel?"0 0 14px rgba(255,255,255,.2)":"none"}}>
              <span style={{fontSize:17}}>{RATINGS[rk].emoji}</span>
              <span style={{fontSize:7,fontWeight:900,opacity:sel?1:.5}}>{rk==="great"?"FULL":rk==="okay"?"75%":rk==="rough"?"25%":"$0"}</span>
            </button>);
          })}
        </div>
      )}
      {(showNote||note)&&(<textarea value={note||""} onChange={e=>onNoteChange(periodKey,e.target.value)} placeholder="Add a note..." rows={2} style={{width:"100%",padding:"8px 10px",borderRadius:10,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",color:"#fff",fontSize:13,fontWeight:600,outline:"none",lineHeight:1.4,marginTop:4}}/>)}
    </div>
  );
}

// ============================================================
// SCHOOL TAB
// ============================================================
function SchoolTab({schoolLogs,onSave}){
  const [selectedDate,setSelectedDate]=useState(getTodayIso());
  const days=loggableSchoolDays().slice().reverse();
  const dayInfo=getSchoolDay(selectedDate);
  const [ratings,setRatings]=useState({});
  const [teachers,setTeachers]=useState({});
  const [notes,setNotes]=useState({});
  const [gemaraStudied,setGemaraStudied]=useState(false);
  const [saved,setSaved]=useState(false);

  useEffect(()=>{
    const log=schoolLogs[selectedDate];
    setRatings(log?.ratings||{}); setTeachers(log?.teachers||{}); setNotes(log?.notes||{}); setGemaraStudied(log?.gemaraStudied||false); setSaved(false);
  },[selectedDate, schoolLogs]);

  if(!dayInfo) return(<div style={{paddingTop:60,textAlign:"center",animation:"up .4s ease both"}}><div style={{fontSize:48,marginBottom:12}}>🏖️</div><div style={{fontFamily:"'Fredoka One',cursive",fontSize:20,opacity:.6}}>No school on this day</div></div>);

  const isHebrew=dayInfo.type==="hebrew", isSunday=dayInfo.isSunday;
  const setRating=(k,v)=>setRatings(p=>({...p,[k]:v}));
  const setNote=(k,v)=>setNotes(p=>({...p,[k]:v}));
  function varInfo(k){const tKey=k==="secClass5"&&dayInfo.isWednesday?"gym":teachers[k];return tKey?TEACHERS[tKey]:null;}
  function varLabel(k,n){const ti=varInfo(k);return `Class ${n}${ti?" — "+ti.label:""}`;}
  function calcTotal(){
    let t=0;
    ["jewishClass1","break","jewishClass2","recess1","jewishClass3"].forEach(k=>{t+=calcEarning(EARNINGS[k].amount,ratings[k]);});
    if(!isHebrew){
      ["lunch","mincha","recess2","secClass4"].forEach(k=>{t+=calcEarning(EARNINGS[k].amount,ratings[k]);});
      ["secClass1","secClass2","secClass3","secClass5"].forEach(k=>{const ti=varInfo(k);if(ti)t+=calcEarning(ti.amount,ratings[k]);});
    }
    if(isSunday&&gemaraStudied) t+=3;
    return parseFloat(t.toFixed(2));
  }
  const total=calcTotal();

  const TeacherSelect=({classKey})=>{
    const isWedGym=classKey==="secClass5"&&dayInfo.isWednesday;
    if(isWedGym) return <div style={{fontSize:12,opacity:.55,fontWeight:700}}>🏃 Gym</div>;
    return(<select value={teachers[classKey]||""} onChange={e=>{setTeachers(p=>({...p,[classKey]:e.target.value}));if(!e.target.value)setRating(classKey,undefined);}} style={{width:"100%",padding:"8px 12px",borderRadius:10,background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",color:"#fff",fontSize:13,fontFamily:"'Nunito',sans-serif",fontWeight:700,outline:"none"}}>
      <option value="">— Select teacher —</option>
      <option value="rabbiR">Rabbi Rothberger · 75¢</option>
      <option value="mrsW">Mrs. Welikson · $1.50</option>
      <option value="rabbiI">Rabbi Isaac · $2.00</option>
    </select>);
  };

  const SH=({emoji,label,color})=><div style={{fontFamily:"'Fredoka One',cursive",fontSize:16,marginBottom:10,marginTop:4,color,borderBottom:`1px solid ${color}2a`,paddingBottom:7}}>{emoji} {label}</div>;

  async function handleSave(){
    await onSave(selectedDate,{ratings,teachers,notes,gemaraStudied,total,date:selectedDate,type:dayInfo.type});
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  }

  return(
    <div style={{animation:"up .4s ease both",paddingTop:20}}>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,opacity:.5,fontWeight:900,marginBottom:8,letterSpacing:.5}}>SELECT DAY</div>
        <select value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} style={{width:"100%",padding:"12px 14px",borderRadius:14,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",color:"#fff",fontSize:14,fontFamily:"'Nunito',sans-serif",fontWeight:800,outline:"none"}}>
          {days.map(d=>{const logged=!!schoolLogs[d.date];const isToday=d.date===getTodayIso();return(<option key={d.date} value={d.date}>{isToday?"📍 Today — ":logged?"✅ ":"⬜ "}{formatDate(d.date)} ({d.type==="full"?"Full":"Hebrew"})</option>);})}
        </select>
      </div>

      <div style={{background:"linear-gradient(135deg,rgba(255,217,61,.17),rgba(255,107,157,.09))",border:"1px solid rgba(255,217,61,.28)",borderRadius:16,padding:"12px 18px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:11,opacity:.65,fontWeight:900}}>SCHOOL EARNINGS</div>
        <div style={{fontFamily:"'Fredoka One',cursive",fontSize:34,color:"#ffd93d"}}>${total.toFixed(2)}</div>
      </div>

      <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:"8px 12px",marginBottom:4,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,textAlign:"center"}}>
        {RATING_KEYS.map(rk=>(<div key={rk}><div style={{fontSize:16}}>{RATINGS[rk].emoji}</div><div style={{fontSize:8,fontWeight:900,opacity:.5,marginTop:1}}>{rk==="great"?"FULL":rk==="okay"?"75%":rk==="rough"?"25%":"NONE"}</div></div>))}
      </div>
      <div style={{fontSize:10,opacity:.4,fontWeight:700,textAlign:"center",marginBottom:14}}>Tap 📝 to add a note</div>

      <SH emoji="🌅" label="Morning — Jewish Studies" color="#ffd93d"/>
      {[{key:"jewishClass1",...EARNINGS.jewishClass1},{key:"break",...EARNINGS.break},{key:"jewishClass2",...EARNINGS.jewishClass2},{key:"recess1",...EARNINGS.recess1},{key:"jewishClass3",...EARNINGS.jewishClass3}].map(p=>(
        <RatingPicker key={p.key} periodKey={p.key} baseAmount={p.amount} label={p.label} difficulty={p.difficulty} rating={ratings[p.key]} note={notes[p.key]} onChange={setRating} onNoteChange={setNote}/>
      ))}

      {isSunday&&(
        <div className="tap" onClick={()=>setGemaraStudied(p=>!p)} style={{background:gemaraStudied?"rgba(251,191,36,.18)":"rgba(255,255,255,.04)",border:`2px solid ${gemaraStudied?"#fbbf24":"rgba(255,255,255,.09)"}`,borderRadius:14,padding:"12px 14px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:800,fontSize:14}}>📖 Studied for Gemara Test</div><div style={{fontSize:11,opacity:.6,marginTop:2,fontWeight:700}}>Took it seriously</div></div>
          <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontFamily:"'Fredoka One',cursive",fontSize:18,color:gemaraStudied?"#ffd93d":"rgba(255,255,255,.3)"}}>$3.00</span><span style={{fontSize:20}}>{gemaraStudied?"✅":"⬜"}</span></div>
        </div>
      )}

      {!isHebrew&&<>
        <SH emoji="☀️" label="Afternoon — Secular" color="#6bcb77"/>
        <RatingPicker periodKey="lunch"  baseAmount={.50} label="Lunch"     difficulty={1} rating={ratings.lunch}  note={notes.lunch}  onChange={setRating} onNoteChange={setNote}/>
        <RatingPicker periodKey="mincha" baseAmount={.50} label="Mincha 🙏" difficulty={1} rating={ratings.mincha} note={notes.mincha} onChange={setRating} onNoteChange={setNote}/>
        {["secClass1","secClass2"].map((k,i)=>(<RatingPicker key={k} periodKey={k} baseAmount={varInfo(k)?.amount||null} label={varLabel(k,i+1)} difficulty={varInfo(k)?.difficulty||null} rating={ratings[k]} note={notes[k]} onChange={setRating} onNoteChange={setNote} teacherSlot={<TeacherSelect classKey={k}/>}/>))}
        <RatingPicker periodKey="recess2"   baseAmount={.50} label="Recess (Afternoon) 🏃" difficulty={1} rating={ratings.recess2}   note={notes.recess2}   onChange={setRating} onNoteChange={setNote}/>
        <RatingPicker periodKey="secClass3" baseAmount={varInfo("secClass3")?.amount||null} label={varLabel("secClass3",3)} difficulty={varInfo("secClass3")?.difficulty||null} rating={ratings.secClass3} note={notes.secClass3} onChange={setRating} onNoteChange={setNote} teacherSlot={<TeacherSelect classKey="secClass3"/>}/>
        <RatingPicker periodKey="secClass4" baseAmount={.75} label="Class 4 — Mr. Berger (Math)" difficulty={2} rating={ratings.secClass4} note={notes.secClass4} onChange={setRating} onNoteChange={setNote}/>
        <RatingPicker periodKey="secClass5" baseAmount={varInfo("secClass5")?.amount||null} label={varLabel("secClass5",5)} difficulty={varInfo("secClass5")?.difficulty||null} rating={ratings.secClass5} note={notes.secClass5} onChange={setRating} onNoteChange={setNote} teacherSlot={<TeacherSelect classKey="secClass5"/>}/>
      </>}

      <button className="tap" onClick={handleSave} style={{width:"100%",padding:"16px",borderRadius:18,background:saved?"linear-gradient(135deg,#6bcb77,#4ade80)":"linear-gradient(135deg,#6bcb77,#4d96ff)",color:"#fff",fontFamily:"'Fredoka One',cursive",fontSize:20,boxShadow:"0 8px 24px rgba(107,203,119,.25)",marginTop:8}}>
        {saved?"✅ Saved!":"💾 Save — $"+total.toFixed(2)}
      </button>
    </div>
  );
}

// ============================================================
// BEDTIME TAB
// ============================================================
function BedtimeTab({bedtimeLogs,onSave}){
  const nights=loggableBedtimeNights().slice().reverse();
  const [selectedDate,setSelectedDate]=useState(()=>{const t=getTodayIso();return hasBedtime(t)?t:(nights[0]||t);});
  const [option,setOption]=useState("none");
  const [saved,setSaved]=useState(false);
  useEffect(()=>{setOption(bedtimeLogs[selectedDate]?.option||"none");setSaved(false);},[selectedDate, bedtimeLogs]);
  async function handleSave(){await onSave(selectedDate,{option,amount:BEDTIME_OPTIONS[option]?.amount||0,date:selectedDate});setSaved(true);setTimeout(()=>setSaved(false),2000);}
  const earned=BEDTIME_OPTIONS[option]?.amount||0;
  return(
    <div style={{animation:"up .4s ease both",paddingTop:20}}>
      <div style={{textAlign:"center",marginBottom:20}}><div style={{fontSize:48}}>🌙</div><div style={{fontFamily:"'Fredoka One',cursive",fontSize:24,marginTop:8}}>Bedtime Log</div><div style={{fontSize:13,opacity:.5,fontWeight:700,marginTop:4}}>Every night except Friday</div></div>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,opacity:.5,fontWeight:900,marginBottom:8,letterSpacing:.5}}>SELECT NIGHT</div>
        <select value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} style={{width:"100%",padding:"12px 14px",borderRadius:14,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",color:"#fff",fontSize:14,fontFamily:"'Nunito',sans-serif",fontWeight:800,outline:"none"}}>
          {nights.map(iso=>{const logged=!!bedtimeLogs[iso];const isToday=iso===getTodayIso();return(<option key={iso} value={iso}>{isToday?"📍 Tonight — ":logged?"✅ ":"⬜ "}{formatDate(iso)}</option>);})}
        </select>
      </div>
      <div style={{background:"linear-gradient(135deg,rgba(192,132,252,.18),rgba(129,140,248,.1))",border:"1px solid rgba(192,132,252,.28)",borderRadius:16,padding:"12px 18px",marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:11,opacity:.65,fontWeight:900}}>TONIGHT'S BONUS</div>
        <div style={{fontFamily:"'Fredoka One',cursive",fontSize:34,color:"#c084fc"}}>{earned>0?`$${earned.toFixed(2)}`:"—"}</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
        {Object.entries(BEDTIME_OPTIONS).map(([key,val])=>(
          <div key={key} className="tap" onClick={()=>setOption(key)} style={{background:option===key?"rgba(192,132,252,.18)":"rgba(255,255,255,.04)",border:`2px solid ${option===key?"#c084fc":"rgba(255,255,255,.09)"}`,borderRadius:16,padding:"16px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all .2s"}}>
            <div><div style={{fontWeight:800,fontSize:16}}>{val.label}</div>{key==="early"&&<div style={{fontSize:12,opacity:.55,marginTop:3,fontWeight:700}}>Best bonus! 🌟</div>}</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>{val.amount>0&&<span style={{fontFamily:"'Fredoka One',cursive",fontSize:22,color:option===key?"#c084fc":"rgba(255,255,255,.4)"}}>${val.amount.toFixed(2)}</span>}<span style={{fontSize:22}}>{option===key?"🔵":"⚪"}</span></div>
          </div>
        ))}
      </div>
      <button className="tap" onClick={handleSave} style={{width:"100%",padding:"16px",borderRadius:18,background:saved?"linear-gradient(135deg,#6bcb77,#4ade80)":"linear-gradient(135deg,#c084fc,#818cf8)",color:"#fff",fontFamily:"'Fredoka One',cursive",fontSize:20}}>
        {saved?"✅ Saved!":earned>0?`💾 Save — $${earned.toFixed(2)}`:"💾 Save"}
      </button>
    </div>
  );
}

// ============================================================
// BONUS TAB
// ============================================================
function BonusTab({bonuses,onAdd}){
  const [modal,setModal]=useState(null);
  const [engChapters,setEngChapters]=useState(1);
  const [engRate,setEngRate]=useState(1.00);
  async function submit(type){
    const today=getTodayIso();
    if(type==="gemara")  await onAdd({label:"📖 Gemara — Studied Seriously",amount:3.00,date:today,type:"gemara"});
    if(type==="math")    await onAdd({label:"➕ Math Test — Studied Seriously",amount:5.00,date:today,type:"math"});
    if(type==="english") await onAdd({label:`📚 English — ${engChapters} chapter${engChapters>1?"s":""} read`,amount:parseFloat((engChapters*engRate).toFixed(2)),date:today,type:"english"});
    setModal(null);
  }
  return(
    <div style={{animation:"up .4s ease both",paddingTop:20}}>
      <div style={{textAlign:"center",marginBottom:20}}><div style={{fontSize:48}}>⭐</div><div style={{fontFamily:"'Fredoka One',cursive",fontSize:24,marginTop:8}}>Special Bonuses</div><div style={{fontSize:13,opacity:.5,fontWeight:700,marginTop:4}}>Logged by a parent</div></div>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
        {[{key:"gemara",emoji:"📖",label:"Gemara Test",sub:"Studied seriously",amount:"$3.00",color:"#fbbf24"},
          {key:"math",emoji:"➕",label:"Math Test",sub:"Studied seriously",amount:"$5.00",color:"#6bcb77"},
          {key:"english",emoji:"📚",label:"English Reading",sub:"Per chapter read",amount:"custom",color:"#4d96ff"}].map(b=>(
          <button key={b.key} className="tap" onClick={()=>setModal(b.key)} style={{background:`${b.color}12`,border:`1px solid ${b.color}30`,borderRadius:16,padding:"16px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",color:"#fff"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:30}}>{b.emoji}</span><div style={{textAlign:"left"}}><div style={{fontWeight:900,fontSize:15}}>{b.label}</div><div style={{fontSize:12,opacity:.55,marginTop:2,fontWeight:700}}>{b.sub}</div></div></div>
            <div style={{fontFamily:"'Fredoka One',cursive",fontSize:18,color:b.color}}>{b.amount}</div>
          </button>
        ))}
      </div>
      {bonuses.length>0&&(<><div style={{fontSize:11,opacity:.5,fontWeight:900,marginBottom:10,letterSpacing:.5}}>HISTORY</div>
        {[...bonuses].reverse().map(b=>(<div key={b.id} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:800,fontSize:13}}>{b.label}</div>{b.date&&<div style={{fontSize:11,opacity:.45,fontWeight:700,marginTop:2}}>{formatDate(b.date)}</div>}</div>
          <span style={{fontFamily:"'Fredoka One',cursive",fontSize:18,color:"#fbbf24"}}>${b.amount.toFixed(2)}</span>
        </div>))}</>)}
      {modal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setModal(null)}>
          <div style={{background:"#1a1040",border:"1px solid rgba(255,255,255,.15)",borderRadius:20,padding:24,width:"100%",maxWidth:340}} onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:"'Fredoka One',cursive",fontSize:22,marginBottom:16,textAlign:"center"}}>{modal==="english"?"📚 English Reading":modal==="math"?"➕ Math Bonus":"📖 Gemara Bonus"}</div>
            {modal==="english"?(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:900,opacity:.6,marginBottom:8}}>CHAPTERS READ</div>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                  <button className="tap" onClick={()=>setEngChapters(p=>Math.max(1,p-1))} style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",color:"#fff",borderRadius:10,padding:"8px 16px",fontFamily:"'Fredoka One',cursive",fontSize:20}}>−</button>
                  <div style={{fontFamily:"'Fredoka One',cursive",fontSize:32,flex:1,textAlign:"center"}}>{engChapters}</div>
                  <button className="tap" onClick={()=>setEngChapters(p=>p+1)} style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",color:"#fff",borderRadius:10,padding:"8px 16px",fontFamily:"'Fredoka One',cursive",fontSize:20}}>+</button>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
                  {[0.50,0.75,1.00,1.50,2.00].map(r=>(<button key={r} className="tap" onClick={()=>setEngRate(r)} style={{padding:"6px 12px",borderRadius:10,border:`1px solid ${engRate===r?"#fbbf24":"rgba(255,255,255,.15)"}`,background:engRate===r?"rgba(251,191,36,.2)":"rgba(255,255,255,.05)",color:"#fff",fontWeight:800,fontSize:13}}>${r.toFixed(2)}</button>))}
                </div>
                <div style={{fontFamily:"'Fredoka One',cursive",fontSize:20,color:"#fbbf24",textAlign:"center"}}>Total: ${(engChapters*engRate).toFixed(2)}</div>
              </div>
            ):(<div style={{textAlign:"center",fontFamily:"'Fredoka One',cursive",fontSize:44,color:"#ffd93d",marginBottom:16}}>${modal==="gemara"?"3.00":"5.00"}</div>)}
            <button className="tap" onClick={()=>submit(modal)} style={{width:"100%",padding:"14px",borderRadius:14,background:"linear-gradient(135deg,#fbbf24,#f59e0b)",color:"#1a1a2e",fontFamily:"'Fredoka One',cursive",fontSize:18,marginBottom:8}}>✅ Add Bonus!</button>
            <button className="tap" onClick={()=>setModal(null)} style={{width:"100%",padding:"10px",borderRadius:14,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.45)",fontFamily:"'Fredoka One',cursive",fontSize:14}}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// STREAK CARD
// ============================================================
function StreakCard({streakKey,def,s,streakBonuses,hatTrickMode=false,hatTrickCount=0,hatTrickDays=[]}){
  const current=hatTrickMode?hatTrickCount:(s?.current||0);
  const best=hatTrickMode?hatTrickCount:(s?.best||0);
  const nextM=def.milestones.find(m=>current<m.n);
  const prevM=def.milestones.filter(m=>current>=m.n).pop()||null;
  const earnedBadgesArr=def.milestones.filter(m=>best>=m.n);
  const fromN=prevM?prevM.n:0, toN=nextM?nextM.n:def.milestones[def.milestones.length-1].n;
  const pct=nextM?Math.min(((current-fromN)/(toN-fromN))*100,100):100;
  const barColor=pct<33?"linear-gradient(90deg,#4d96ff,#6bcb77)":pct<66?"linear-gradient(90deg,#6bcb77,#ffd93d)":`linear-gradient(90deg,#ffd93d,${def.color})`;
  return(
    <div style={{background:"rgba(255,255,255,.04)",border:`1px solid ${def.color}30`,borderRadius:16,padding:"14px 16px",marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <span style={{fontSize:26}}>{def.emoji}</span>
        <div style={{flex:1}}><div style={{fontWeight:900,fontSize:15,color:def.color}}>{def.label}</div><div style={{fontSize:11,opacity:.5,fontWeight:700,marginTop:1}}>{def.desc}</div></div>
        <div style={{display:"flex",gap:4}}>
          {earnedBadgesArr.map(m=>(<div key={m.n} style={{textAlign:"center"}}><div style={{fontSize:18}}>{m.badge}</div><div style={{fontSize:7,fontWeight:900,color:def.color,maxWidth:40,textAlign:"center",lineHeight:1.2,marginTop:1}}>{m.secretName}</div></div>))}
        </div>
      </div>
      {nextM?(
        <div style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
            <div style={{fontFamily:"'Fredoka One',cursive",fontSize:22,color:current>0?def.color:"rgba(255,255,255,.3)"}}>{current} <span style={{fontSize:14,opacity:.6}}>/ {nextM.n}</span></div>
            <div style={{fontSize:11,fontWeight:900,opacity:.6}}>{nextM.n-current} to go</div>
          </div>
          <div style={{background:"rgba(255,255,255,.08)",borderRadius:100,height:18,overflow:"hidden",boxShadow:pct>80?`0 0 12px ${def.color}40`:"none"}}>
            <div style={{width:`${pct}%`,height:"100%",borderRadius:100,background:barColor,transition:"width .8s cubic-bezier(.34,1.56,.64,1)",display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:6}}>
              {pct>15&&<span style={{fontSize:10,fontWeight:900,color:"#1a1a2e"}}>{Math.round(pct)}%</span>}
            </div>
          </div>
          <div style={{marginTop:8,display:"flex",justifyContent:"space-between",alignItems:"center",background:`${def.color}10`,border:`1px solid ${def.color}20`,borderRadius:10,padding:"6px 10px"}}>
            <div style={{fontSize:11,fontWeight:700,opacity:.7}}>Next: <span style={{fontWeight:900,fontSize:13}}>???</span> {nextM.badge}</div>
            <div style={{fontFamily:"'Fredoka One',cursive",fontSize:14,color:def.color}}>+${nextM.bonus}</div>
          </div>
        </div>
      ):(
        <div style={{background:`${def.color}18`,border:`1px solid ${def.color}35`,borderRadius:10,padding:"8px 12px",textAlign:"center",marginBottom:10}}>
          <div style={{fontFamily:"'Fredoka One',cursive",fontSize:16,color:def.color}}>🏆 All milestones complete!</div>
        </div>
      )}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{fontSize:11,opacity:.45,fontWeight:800}}>BEST EVER</div>
        <div style={{fontFamily:"'Fredoka One',cursive",fontSize:16,color:"#ffd93d"}}>{best} ⭐</div>
      </div>
      {hatTrickMode&&hatTrickDays.length>0&&(<div style={{marginTop:8,fontSize:11,opacity:.4,fontWeight:700}}>Days: {hatTrickDays.map(d=>formatDate(d).split(",")[0]).join(", ")}</div>)}
    </div>
  );
}

// ============================================================
// TROPHIES TAB
// ============================================================
function TrophiesTab({streaks,hatTrickCount,hatTrickDays,streakBonuses,schoolLogs,badgeAlbum}){
  const dayTotals=Object.values(schoolLogs).map(l=>l.total||0);
  const bestDay=dayTotals.length?Math.max(...dayTotals):0;
  const bestWeek=(()=>{const weeks={};Object.entries(schoolLogs).forEach(([date,log])=>{const d=parseLocal(date);const ws=new Date(d);ws.setDate(d.getDate()-d.getDay());const wk=toLocalIso(ws);weeks[wk]=(weeks[wk]||0)+(log.total||0);});return Object.values(weeks).length?Math.max(...Object.values(weeks)):0;})();
  const SH=({label})=><div style={{fontSize:11,opacity:.5,fontWeight:900,marginBottom:12,letterSpacing:.5}}>{label}</div>;
  return(
    <div style={{animation:"up .4s ease both",paddingTop:20}}>
      <div style={{textAlign:"center",marginBottom:20}}><div style={{fontSize:48}}>🏆</div><div style={{fontFamily:"'Fredoka One',cursive",fontSize:24,marginTop:8}}>Trophies & Streaks</div><div style={{fontSize:13,opacity:.5,fontWeight:700,marginTop:4}}>Noach's hall of fame</div></div>
      <div style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:16,marginBottom:18}}>
        <SH label="🏅 HIGH SCORES"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[{label:"Best Day",value:`$${bestDay.toFixed(2)}`,emoji:"📅",color:"#ffd93d"},{label:"Best Week",value:`$${bestWeek.toFixed(2)}`,emoji:"📆",color:"#6bcb77"},{label:"Hat Tricks",value:`${hatTrickCount} 👑`,emoji:"👑",color:"#c084fc"},{label:"Streak $",value:`$${streakBonuses.reduce((s,b)=>s+b.amount,0).toFixed(2)}`,emoji:"🔥",color:"#ff6b9d"}].map(s=>(
            <div key={s.label} style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:12,textAlign:"center"}}>
              <div style={{fontSize:24,marginBottom:4}}>{s.emoji}</div>
              <div style={{fontFamily:"'Fredoka One',cursive",fontSize:22,color:s.color}}>{s.value}</div>
              <div style={{fontSize:10,opacity:.5,fontWeight:800,marginTop:2}}>{s.label.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>
      <SH label="🔥 HARD CLASS STREAKS"/>
      {["jewishClass1","jewishClass2","jewishClass3","rabbiI","mrsW"].map(key=>(<StreakCard key={key} streakKey={key} def={STREAK_DEFS[key]} s={streaks[key]||{current:0,best:0}} streakBonuses={streakBonuses}/>))}
      <SH label="👑 HAT TRICK"/>
      <StreakCard streakKey="hatTrick" def={HAT_TRICK_DEF} s={null} streakBonuses={streakBonuses} hatTrickMode={true} hatTrickCount={hatTrickCount} hatTrickDays={hatTrickDays}/>
      <SH label="✨ FUN STREAKS"/>
      {["recess1","recess2","berger","rabbiR"].map(key=>(<StreakCard key={key} streakKey={key} def={STREAK_DEFS[key]} s={streaks[key]||{current:0,best:0}} streakBonuses={streakBonuses}/>))}

      <div style={{marginTop:8}}>
        <div style={{fontSize:11,opacity:.5,fontWeight:900,marginBottom:4,letterSpacing:.5}}>🎖️ MY BADGE ALBUM</div>
        <div style={{fontSize:11,opacity:.4,fontWeight:700,marginBottom:14}}>Earned forever — even if logs change</div>
        {badgeAlbum.length===0?(
          <div style={{background:"rgba(255,255,255,.04)",border:"1px dashed rgba(255,255,255,.15)",borderRadius:16,padding:32,textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:10}}>🌱</div>
            <div style={{fontFamily:"'Fredoka One',cursive",fontSize:18,opacity:.5}}>No badges yet!</div>
            <div style={{fontSize:12,opacity:.35,fontWeight:700,marginTop:6}}>Keep showing up — they'll appear here</div>
          </div>
        ):(
          <>
            <div style={{fontFamily:"'Fredoka One',cursive",fontSize:14,color:"#ffd93d",marginBottom:12,textAlign:"right"}}>{badgeAlbum.length} badge{badgeAlbum.length!==1?"s":""} collected 🏅</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[...badgeAlbum].sort((a,b)=>(a.dateEarned||"").localeCompare(b.dateEarned||"")).map(badge=>(
                <div key={badge.id} style={{background:`linear-gradient(135deg,${badge.color}18,${badge.color}08)`,border:`1px solid ${badge.color}40`,borderRadius:14,padding:14,textAlign:"center",boxShadow:`0 0 16px ${badge.color}20`,position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",top:-20,right:-20,width:60,height:60,background:`${badge.color}15`,borderRadius:"50%",filter:"blur(15px)"}}/>
                  <div style={{fontSize:32,marginBottom:6}}>{badge.badge}</div>
                  <div style={{fontFamily:"'Fredoka One',cursive",fontSize:13,color:badge.color,lineHeight:1.2,marginBottom:4}}>{badge.secretName}</div>
                  <div style={{fontSize:10,opacity:.5,fontWeight:700,marginBottom:4}}>{badge.streakLabel}</div>
                  {badge.dateEarned&&<div style={{fontSize:9,opacity:.35,fontWeight:800}}>{formatDate(badge.dateEarned).split(",").slice(0,2).join(",")}</div>}
                  {badge.bonus>0&&<div style={{fontFamily:"'Fredoka One',cursive",fontSize:12,color:"#ffd93d",marginTop:4}}>+${badge.bonus}</div>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
