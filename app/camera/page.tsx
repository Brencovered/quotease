"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Ruler, Pencil, RotateCcw, X, Check, Minus, Plus, ChevronRight } from "lucide-react";
import { Suspense } from "react";

type AnnotationType = "point" | "line" | "area";
interface Pt { x: number; y: number; }
interface Annotation {
  id: string; type: AnnotationType; points: Pt[];
  label: string; itemKey: string; qty: number; unit: string; note: string;
  length?: number; frameData: string; colour: string;
}

const COLOURS = ["#FFB400","#EF4444","#3B82F6","#10B981","#8B5CF6","#F97316"];

const TRADE_ITEMS: Record<string, {key:string;label:string;unit:string;defaultType:AnnotationType}[]> = {
  electrician: [
    {key:"dl",label:"Downlight",unit:"each",defaultType:"point"},
    {key:"gpo",label:"Power point (GPO)",unit:"each",defaultType:"point"},
    {key:"switch",label:"Switch",unit:"each",defaultType:"point"},
    {key:"data",label:"Data point",unit:"each",defaultType:"point"},
    {key:"exhaust",label:"Exhaust fan",unit:"each",defaultType:"point"},
    {key:"smoke",label:"Smoke alarm",unit:"each",defaultType:"point"},
    {key:"cable",label:"Cable run",unit:"m",defaultType:"line"},
    {key:"conduit",label:"Conduit run",unit:"m",defaultType:"line"},
    {key:"sb",label:"Switchboard",unit:"each",defaultType:"point"},
    {key:"circuit",label:"New circuit",unit:"each",defaultType:"line"},
  ],
  plumber: [
    {key:"tap",label:"Tap / mixer",unit:"each",defaultType:"point"},
    {key:"toilet",label:"Toilet (WC)",unit:"each",defaultType:"point"},
    {key:"basin",label:"Basin",unit:"each",defaultType:"point"},
    {key:"shower",label:"Shower",unit:"each",defaultType:"point"},
    {key:"hwu",label:"Hot water unit",unit:"each",defaultType:"point"},
    {key:"pipe",label:"Pipe run",unit:"m",defaultType:"line"},
    {key:"drain",label:"Drain line",unit:"m",defaultType:"line"},
  ],
  roofer: [
    {key:"gutter",label:"Gutter run",unit:"m",defaultType:"line"},
    {key:"downpipe",label:"Downpipe",unit:"each",defaultType:"point"},
    {key:"ridge",label:"Ridge line",unit:"m",defaultType:"line"},
    {key:"valley",label:"Valley iron",unit:"m",defaultType:"line"},
    {key:"skylight",label:"Skylight",unit:"each",defaultType:"point"},
    {key:"damage",label:"Damaged area",unit:"m2",defaultType:"area"},
  ],
};

function dist(a:Pt,b:Pt){return Math.sqrt((b.x-a.x)**2+(b.y-a.y)**2);}
function uid(){return Math.random().toString(36).slice(2,9);}

function CameraPage() {
  const router = useRouter();
  const params = useSearchParams();
  const trade  = params.get("trade") ?? "electrician";
  const items  = TRADE_ITEMS[trade] ?? TRADE_ITEMS.electrician;

  const videoRef   = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const snapRef    = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream|null>(null);

  const [ready,       setReady]       = useState(false);
  const [error,       setCameraError] = useState<string|null>(null);
  const [drawMode,    setDrawMode]    = useState<AnnotationType>("point");
  const [isDrawing,   setIsDrawing]   = useState(false);
  const [curPts,      setCurPts]      = useState<Pt[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [colourIdx,   setColourIdx]   = useState(0);
  const [showForm,    setShowForm]    = useState(false);
  const [pendingPts,  setPendingPts]  = useState<Pt[]>([]);
  const [formItem,    setFormItem]    = useState(items[0].key);
  const [formQty,     setFormQty]     = useState(1);
  const [formNote,    setFormNote]    = useState("");
  const [review,      setReview]      = useState(false);
  const [calibMode,   setCalibMode]   = useState(false);
  const [calibPts,    setCalibPts]    = useState<Pt[]>([]);
  const [calibInput,  setCalibInput]  = useState("");
  const [showCalib,   setShowCalib]   = useState(false);
  const [calibration, setCalibration] = useState<{pxPerMetre:number}|null>(null);
  const [formLength,  setFormLength]  = useState<number|null>(null);

  // Start camera on mount
  useEffect(() => {
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        streamRef.current = stream;
        const v = videoRef.current!;
        v.srcObject = stream;
        v.onloadedmetadata = () => { v.play(); setReady(true); };
      } catch(e) {
        setCameraError(e instanceof DOMException && e.name==="NotAllowedError"
          ? "Camera access denied. Tap the camera icon in your browser address bar to allow."
          : "Could not open camera.");
      }
    }
    start();
    return () => { streamRef.current?.getTracks().forEach(t=>t.stop()); };
  }, []);

  // Canvas resize
  useEffect(()=>{
    const v = videoRef.current; const o = overlayRef.current;
    if(!v||!o) return;
    function resize(){
      if(!v||!o) return;
      o.width = v.clientWidth || window.innerWidth;
      o.height = v.clientHeight || window.innerHeight;
    }
    v.addEventListener("resize",resize);
    window.addEventListener("resize",resize);
    const t = setInterval(resize, 500); // retry until video has size
    return ()=>{ clearInterval(t); v.removeEventListener("resize",resize); window.removeEventListener("resize",resize); };
  },[]);

  // Draw overlay
  const drawOverlay = useCallback(()=>{
    const o = overlayRef.current; if(!o) return;
    const ctx = o.getContext("2d")!;
    ctx.clearRect(0,0,o.width,o.height);
    if(curPts.length>0){
      const c = COLOURS[colourIdx%COLOURS.length];
      ctx.strokeStyle=c; ctx.lineWidth=3; ctx.setLineDash([5,4]);
      if(drawMode==="line"&&curPts.length>=2){
        ctx.beginPath(); ctx.moveTo(curPts[0].x,curPts[0].y); ctx.lineTo(curPts[1].x,curPts[1].y); ctx.stroke();
      } else if(drawMode==="area"&&curPts.length>=2){
        ctx.beginPath(); ctx.moveTo(curPts[0].x,curPts[0].y);
        curPts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y)); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    if(calibMode&&calibPts.length>0){
      ctx.strokeStyle="#00FF88"; ctx.lineWidth=2;
      calibPts.forEach(p=>{ ctx.beginPath(); ctx.arc(p.x,p.y,8,0,Math.PI*2); ctx.stroke(); });
      if(calibPts.length===2){ ctx.beginPath(); ctx.moveTo(calibPts[0].x,calibPts[0].y); ctx.lineTo(calibPts[1].x,calibPts[1].y); ctx.stroke(); }
    }
  },[curPts,drawMode,colourIdx,calibMode,calibPts]);

  useEffect(()=>{
    if(!ready) return;
    const raf = requestAnimationFrame(function loop(){ drawOverlay(); requestAnimationFrame(loop); });
    return ()=>cancelAnimationFrame(raf);
  },[ready,drawOverlay]);

  function canvasPt(e: React.TouchEvent|React.MouseEvent):Pt{
    const o = overlayRef.current!; const r = o.getBoundingClientRect();
    const cx = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const cy = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {x:cx-r.left, y:cy-r.top};
  }

  function handleStart(e:React.TouchEvent|React.MouseEvent){
    e.preventDefault();
    const p = canvasPt(e);
    if(calibMode){
      const next=[...calibPts,p];
      setCalibPts(next);
      if(next.length===2) setShowCalib(true);
      return;
    }
    if(drawMode==="point"){ captureAnnotation([p]); return; }
    setIsDrawing(true); setCurPts([p]);
  }
  function handleMove(e:React.TouchEvent|React.MouseEvent){
    e.preventDefault(); if(!isDrawing) return;
    const p = canvasPt(e);
    setCurPts(prev=> drawMode==="line" ? [prev[0],p] : [...prev,p]);
  }
  function handleEnd(e:React.TouchEvent|React.MouseEvent){
    e.preventDefault(); if(!isDrawing) return;
    setIsDrawing(false);
    if(drawMode==="line"&&curPts.length===2) captureAnnotation(curPts);
    else if(drawMode==="area"&&curPts.length>=3) captureAnnotation(curPts);
  }

  function captureAnnotation(pts:Pt[]){
    const v=videoRef.current; const s=snapRef.current; const o=overlayRef.current;
    let fd="";
    if(v&&s&&o){
      s.width=v.videoWidth||o.width; s.height=v.videoHeight||o.height;
      const ctx=s.getContext("2d")!;
      ctx.drawImage(v,0,0,s.width,s.height);
      const sx=s.width/o.width; const sy=s.height/o.height;
      const c=COLOURS[colourIdx%COLOURS.length];
      ctx.fillStyle=c; ctx.strokeStyle=c; ctx.lineWidth=3;
      if(pts.length===1){
        ctx.beginPath(); ctx.arc(pts[0].x*sx,pts[0].y*sy,10,0,Math.PI*2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.moveTo(pts[0].x*sx,pts[0].y*sy);
        pts.slice(1).forEach(p=>ctx.lineTo(p.x*sx,p.y*sy)); ctx.stroke();
      }
      fd=s.toDataURL("image/jpeg",0.8);
    }
    let autoLen:number|null=null;
    if(calibration&&drawMode==="line"&&pts.length===2){
      autoLen=Math.round(dist(pts[0],pts[1])/calibration.pxPerMetre*100)/100;
    }
    const def=items.find(i=>i.defaultType===drawMode)??items[0];
    setFormItem(def.key); setFormQty(autoLen??1); setFormNote(""); setFormLength(autoLen);
    setPendingPts(pts); setCurPts([]); setShowForm(true);
  }

  function commitAnnotation(){
    const def=items.find(i=>i.key===formItem)??items[0];
    const ann:Annotation={
      id:uid(), type:drawMode, points:pendingPts,
      label:def.label, itemKey:formItem, qty:formQty, unit:def.unit,
      note:formNote, length:formLength??undefined,
      frameData: (() => {
        const v=videoRef.current; const s=snapRef.current; const o=overlayRef.current;
        if(!v||!s||!o) return "";
        s.width=v.videoWidth||o.width; s.height=v.videoHeight||o.height;
        const ctx=s.getContext("2d")!;
        ctx.drawImage(v,0,0,s.width,s.height);
        return s.toDataURL("image/jpeg",0.8);
      })(),
      colour:COLOURS[colourIdx%COLOURS.length],
    };
    setAnnotations(p=>[...p,ann]);
    setColourIdx(i=>(i+1)%COLOURS.length);
    setShowForm(false); setPendingPts([]);
  }

  function commitCalibration(){
    const real=parseFloat(calibInput);
    if(!calibPts[1]||isNaN(real)||real<=0) return;
    const px=dist(calibPts[0],calibPts[1]);
    setCalibration({pxPerMetre:px/real});
    setCalibMode(false); setCalibPts([]); setShowCalib(false); setCalibInput("");
  }

  function finish(){
    // Save full annotations (with frame images) for the report
    sessionStorage.setItem("liveAnnotations", JSON.stringify(annotations));
    // Also save a summary without large frame data for quote metadata
    sessionStorage.setItem("liveAnnotationMeta", JSON.stringify(
      annotations.map(ann => ({
        id: ann.id, type: ann.type, label: ann.label, itemKey: ann.itemKey,
        qty: ann.qty, unit: ann.unit, note: ann.note, length: ann.length,
        colour: ann.colour, frameData: ann.frameData, // keep frame for report
      }))
    ));
    router.back();
  }

  if(error) return (
    <div className="h-screen bg-black flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl p-6 text-center max-w-xs">
        <p className="font-bold text-[15px] mb-2">Camera unavailable</p>
        <p className="text-[13px] text-gray-500 mb-4">{error}</p>
        <button onClick={()=>router.back()} className="bg-[#0a1722] text-white font-bold px-6 py-3 rounded-xl">Go back</button>
      </div>
    </div>
  );

  if(review) return (
    <div className="min-h-screen bg-[#f8f9fa] p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="font-bold text-[16px]">{annotations.length} annotation{annotations.length!==1?"s":""}</p>
        <button onClick={()=>setReview(false)} className="text-sm font-bold text-blue-600">Back to camera</button>
      </div>
      <div className="space-y-3 mb-6">
        {annotations.map((ann,i)=>(
          <div key={ann.id} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
            {ann.frameData && <img src={ann.frameData} alt="" className="w-16 h-12 object-cover rounded-xl shrink-0"/>}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:ann.colour}}/>
                <p className="font-bold text-[13px] truncate">{ann.label}</p>
              </div>
              <p className="text-[12px] text-gray-500">{ann.qty} {ann.unit}{ann.length!=null?` · ~${ann.length}m`:""}{ann.note?` · ${ann.note}`:""}</p>
            </div>
            <button onClick={()=>setAnnotations(p=>p.filter((_,j)=>j!==i))} className="text-red-400 p-1"><X size={14}/></button>
          </div>
        ))}
      </div>
      {annotations.length>0
        ? <button onClick={finish} className="w-full bg-[#ffb400] text-[#0a1722] font-extrabold py-4 rounded-xl flex items-center justify-center gap-2">
            <Check size={16}/> Add {annotations.length} item{annotations.length!==1?"s":""} to quote
          </button>
        : <p className="text-center text-gray-400 text-sm">No annotations yet.</p>
      }
    </div>
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <canvas ref={snapRef} className="hidden"/>

      {/* Video -- fills screen naturally */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{width:"100%",height:"100%",objectFit:"cover"}}
      />

      {/* Canvas overlay */}
      <canvas
        ref={overlayRef}
        onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd}
        onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}
        style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",touchAction:"none"}}
      />

      {/* Top bar */}
      <div style={{position:"absolute",top:0,left:0,right:0,padding:"12px 16px",background:"linear-gradient(to bottom,rgba(0,0,0,.7),transparent)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:8,height:8,borderRadius:4,background:"#ef4444",animation:"pulse 1s infinite"}}/>
          <span style={{color:"white",fontSize:12,fontWeight:700}}>LIVE</span>
          {calibration && <span style={{color:"#4ade80",fontSize:10,fontWeight:700,background:"rgba(0,0,0,.4)",padding:"2px 8px",borderRadius:20}}>Calibrated</span>}
          {annotations.length>0 && <span style={{color:"#ffb400",fontSize:11,fontWeight:700,background:"rgba(0,0,0,.4)",padding:"2px 8px",borderRadius:20}}>{annotations.length} saved</span>}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setReview(true)} style={{background:"#ffb400",color:"#0a1722",fontWeight:800,fontSize:12,padding:"6px 14px",borderRadius:20,display:"flex",alignItems:"center",gap:4,border:"none"}}>
            Done <ChevronRight size={13}/>
          </button>
          <button onClick={()=>router.back()} style={{background:"rgba(0,0,0,.4)",color:"white",padding:6,borderRadius:10,border:"none",display:"flex",alignItems:"center"}}>
            <X size={15}/>
          </button>
        </div>
      </div>

      {/* Bottom toolbar */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"12px 16px calc(80px + env(safe-area-inset-bottom))",background:"linear-gradient(to top,rgba(0,0,0,.8),transparent)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div style={{display:"flex",gap:6}}>
            {(["point","line","area"] as AnnotationType[]).map(m=>{
              const Icon=m==="point"?MapPin:m==="line"?Ruler:Pencil;
              const label=m==="point"?"Point":m==="line"?"Line":"Area";
              return <button key={m} onClick={()=>setDrawMode(m)}
                style={{display:"flex",alignItems:"center",gap:4,padding:"6px 10px",borderRadius:10,fontSize:11,fontWeight:700,border:"none",background:drawMode===m?"#ffb400":"rgba(0,0,0,.4)",color:drawMode===m?"#0a1722":"white"}}>
                <Icon size={11}/>{label}
              </button>;
            })}
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>{setCalibMode(!calibMode);setCalibPts([]);}}
              style={{display:"flex",alignItems:"center",gap:4,padding:"6px 10px",borderRadius:10,fontSize:11,fontWeight:700,border:"none",background:calibMode?"#22c55e":"rgba(0,0,0,.4)",color:"white"}}>
              <Ruler size={11}/>{calibMode?"Calibrating...":"Calibrate"}
            </button>
            {annotations.length>0 && <button onClick={()=>setAnnotations(p=>p.slice(0,-1))} style={{background:"rgba(0,0,0,.4)",color:"white",padding:6,borderRadius:10,border:"none",display:"flex",alignItems:"center"}}>
              <RotateCcw size={13}/>
            </button>}
          </div>
        </div>
        {/* Item strip */}
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
          {items.map(item=>(
            <button key={item.key} onClick={()=>setDrawMode(item.defaultType)}
              style={{background:"rgba(0,0,0,.4)",color:"white",fontSize:11,fontWeight:700,padding:"6px 10px",borderRadius:10,whiteSpace:"nowrap",border:"1px solid rgba(255,255,255,.2)",flexShrink:0}}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Annotation form */}
      {showForm && (
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"flex-end"}}>
          <div style={{background:"white",borderRadius:"20px 20px 0 0",padding:20,width:"100%"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
              <p style={{fontWeight:700,fontSize:15}}>What is this?</p>
              <button onClick={()=>{setShowForm(false);setPendingPts([]);setCurPts([]);}} style={{background:"none",border:"none"}}><X size={17}/></button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12,maxHeight:160,overflowY:"auto"}}>
              {items.map(item=>(
                <button key={item.key} onClick={()=>setFormItem(item.key)}
                  style={{textAlign:"left",padding:"8px 12px",borderRadius:12,border:`2px solid ${formItem===item.key?"#0a1722":"#e5e7eb"}`,background:formItem===item.key?"rgba(10,23,34,.05)":"white",fontWeight:600,fontSize:13,cursor:"pointer"}}>
                  {item.label}
                </button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <div>
                <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",color:"#6b7280",marginBottom:4}}>
                  {items.find(i=>i.key===formItem)?.unit==="m"?"Length (m)":"Quantity"}
                </p>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <button onClick={()=>setFormQty(q=>Math.max(0.5,q-1))} style={{border:"1px solid #e5e7eb",borderRadius:8,padding:"6px 8px",background:"white",cursor:"pointer"}}><Minus size={12}/></button>
                  <input type="number" min={0.1} step={0.5} value={formQty} onChange={e=>setFormQty(Number(e.target.value))} style={{flex:1,textAlign:"center",border:"1px solid #e5e7eb",borderRadius:8,padding:"6px",fontSize:14}}/>
                  <button onClick={()=>setFormQty(q=>q+1)} style={{border:"1px solid #e5e7eb",borderRadius:8,padding:"6px 8px",background:"white",cursor:"pointer"}}><Plus size={12}/></button>
                </div>
                {formLength!=null && <p style={{fontSize:10,color:"#16a34a",marginTop:3}}>Est. {formLength}m</p>}
              </div>
              <div>
                <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",color:"#6b7280",marginBottom:4}}>Note (optional)</p>
                <input value={formNote} onChange={e=>setFormNote(e.target.value)} placeholder="e.g. kitchen ceiling" style={{width:"100%",border:"1px solid #e5e7eb",borderRadius:8,padding:"6px 8px",fontSize:13,boxSizing:"border-box"}}/>
              </div>
            </div>
            <button onClick={commitAnnotation} disabled={!formItem}
              style={{width:"100%",background:"#ffb400",color:"#0a1722",fontWeight:800,fontSize:15,padding:"14px",borderRadius:14,border:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:6,cursor:"pointer"}}>
              <Check size={15}/> Add annotation
            </button>
          </div>
        </div>
      )}

      {/* Calibration form */}
      {showCalib && (
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"white",borderRadius:20,padding:20,width:"100%",maxWidth:320}}>
            <p style={{fontWeight:700,fontSize:15,marginBottom:4}}>Set reference length</p>
            <p style={{fontSize:12,color:"#6b7280",marginBottom:12}}>How many metres between your two taps?</p>
            <input type="number" step="0.01" min="0.01" value={calibInput} onChange={e=>setCalibInput(e.target.value)}
              placeholder="e.g. 2.1 (for a 2100mm door)" autoFocus
              style={{width:"100%",border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 10px",fontSize:14,marginBottom:10,boxSizing:"border-box"}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={commitCalibration} disabled={!calibInput}
                style={{flex:1,background:"#0a1722",color:"white",fontWeight:700,padding:"10px",borderRadius:10,border:"none",cursor:"pointer"}}>Set</button>
              <button onClick={()=>{setShowCalib(false);setCalibPts([]);setCalibMode(false);}}
                style={{flex:1,background:"#f3f4f6",color:"#374151",fontWeight:700,padding:"10px",borderRadius:10,border:"none",cursor:"pointer"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Colour dot */}
      <div style={{position:"absolute",top:52,right:16,width:14,height:14,borderRadius:7,border:"2px solid white",background:COLOURS[colourIdx%COLOURS.length]}}/>
    </div>
  );
}

export default function CameraPageWrapper() {
  return (
    <Suspense>
      <CameraPage />
    </Suspense>
  );
}
