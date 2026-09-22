const $=id=>document.getElementById(id);
const state={
  program:"camera1",preview:"camera2",programSource:null,previewSource:null,
  programStream:null,previewStream:null,live:false,recording:false,recorder:null,chunks:[],
  transition:"CUT",format:"16:9",sources:new Map(),graphics:new Map(),ticker:""
};
const scenes=[
 {id:"camera1",name:"Camera 1",type:"Rear camera",source:"camera1"},
 {id:"camera2",name:"Camera 2",type:"Front camera",source:"camera2"},
 {id:"screen",name:"Screen",type:"Screen share",source:"screen"},
 {id:"media",name:"Media",type:"Video URL",source:"media"},
 {id:"lower",name:"Lower Third",type:"Graphic",source:"graphic"}
];

function toast(m){const e=$("toast");e.textContent=m;e.classList.add("show");clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>e.classList.remove("show"),2200)}
function name(id){return scenes.find(s=>s.id===id)?.name||state.sources.get(id)?.name||id}
function camera(id){return id==="camera1"||id==="camera2"}
function stopStream(s){if(s?.getTracks)s.getTracks().forEach(t=>t.stop())}
function clearMedia(which){
  const video=$(which==="program"?"programVideo":"previewVideo");
  video.pause();video.removeAttribute("src");video.srcObject=null;video.load();
  const img=$(which==="program"?"programImage":"previewImage");img.hidden=true;img.removeAttribute("src");
}
function showGraphic(which,graphic){
  const box=$(which==="program"?"programGraphic":"previewGraphic");
  const n=$(which==="program"?"programGraphicName":"previewGraphicName");
  const r=$(which==="program"?"programGraphicRole":"previewGraphicRole");
  if(!graphic){box.hidden=true;return}
  n.textContent=graphic.name||"";
  r.textContent=graphic.role||"";
  if(graphic.color)box.style.setProperty("--accent",graphic.color);
  box.hidden=false;
}
function showTicker(){
  document.querySelectorAll(".ticker-live").forEach(e=>e.remove());
  if(!state.ticker)return;
  ["programFrame"].forEach(id=>{const d=document.createElement("div");d.className="ticker-live";d.textContent=state.ticker;$(id).appendChild(d)})
}
function attachVideo(which,stream){
  const v=$(which==="program"?"programVideo":"previewVideo");
  v.srcObject=stream||null;v.removeAttribute("src");v.load();
  v.style.display=stream?"block":"none";
  $(which==="program"?"programPlaceholder":"previewPlaceholder").style.display=stream?"none":"flex";
}
function attachUrl(which,url){
  const v=$(which==="program"?"programVideo":"previewVideo");
  stopStream(v.srcObject);v.srcObject=null;v.src=url;v.loop=false;v.muted=true;v.controls=false;v.style.display="block";
  $(which==="program"?"programPlaceholder":"previewPlaceholder").style.display="none";
  v.play().catch(()=>toast("Press play in the browser if autoplay is blocked"));
}
function attachImage(which,url){
  const img=$(which==="program"?"programImage":"previewImage");
  const v=$(which==="program"?"programVideo":"previewVideo");
  v.style.display="none";v.pause();v.srcObject=null;v.removeAttribute("src");
  img.src=url;img.hidden=false;
  $(which==="program"?"programPlaceholder":"previewPlaceholder").style.display="none";
}
function attachPlaceholder(which,label){
  clearMedia(which);
  const p=$(which==="program"?"programPlaceholder":"previewPlaceholder");
  p.style.display="flex";p.innerHTML="<b>"+String(label).toUpperCase()+"</b><span>Source ready — TAKE to put it on program</span>";
}
async function openCapture(type){
  if(!navigator.mediaDevices)return null;
  try{
    if(type==="screen") return await navigator.mediaDevices.getDisplayMedia({video:true,audio:true,systemAudio:"include"});
    return await navigator.mediaDevices.getUserMedia({video:{facingMode:type==="camera1"?"environment":"user",width:{ideal:1920},height:{ideal:1080}},audio:true});
  }catch(err){toast("Permission/source was not available");return null}
}
async function createSource(id){
  if(camera(id)||id==="screen"){
    const stream=await openCapture(id);
    if(!stream)return null;
    state.sources.set(id,{id,name:id==="screen"?"Screen share":id==="camera1"?"Camera 1":"Camera 2",kind:"stream",stream});
    stream.getVideoTracks()[0]?.addEventListener("ended",()=>{state.sources.delete(id);toast(name(id)+" stopped")});
    return state.sources.get(id);
  }
  return state.sources.get(id)||null;
}
async function previewSource(id){
  state.preview=id;
  const existing=await createSource(id);
  state.previewSource=existing;
  stopStream(state.previewStream);state.previewStream=null;
  clearMedia("preview");
  if(existing?.kind==="stream"){state.previewStream=existing.stream;attachVideo("preview",existing.stream)}
  else if(existing?.kind==="media"){attachUrl("preview",existing.url)}
  else if(existing?.kind==="image"){attachImage("preview",existing.url)}
  else if(existing?.kind==="graphic"){showGraphic("preview",existing.graphic);attachPlaceholder("preview","Lower third")}
  else attachPlaceholder("preview",name(id));
  render();
}
async function take(fade=false){
  if(state.preview===state.program){toast("Preview is already on program");return}
  stopStream(state.programStream);state.programStream=null;
  state.program=state.preview;state.programSource=state.previewSource;state.programStream=state.previewSource?.kind==="stream"?state.previewSource.stream:null;
  state.transition=fade?"FADE":"CUT";
  clearMedia("program");
  const src=state.programSource;
  if(src?.kind==="stream")attachVideo("program",src.stream);
  else if(src?.kind==="media")attachUrl("program",src.url);
  else if(src?.kind==="image")attachImage("program",src.url);
  else if(src?.kind==="graphic"){attachPlaceholder("program","Lower third");showGraphic("program",src.graphic)}
  else attachPlaceholder("program",name(state.program));
  if(fade) $("programFrame").animate([{opacity:1},{opacity:.15},{opacity:1}],{duration:500});
  showGraphic("program",src?.kind==="graphic"?src.graphic:null);
  showTicker();render();
  preparePreview();
}
async function preparePreview(){return previewSource(state.preview)}
function render(){
  $("programLabel").textContent=name(state.program);$("programSource").textContent=name(state.program);
  $("previewLabel").textContent=name(state.preview);$("previewSource").textContent=name(state.preview);
  $("transitionStatus").textContent=state.transition;
  $("formatPill").textContent=state.format;
  document.querySelector(".program-frame").style.aspectRatio=state.format.replace(":","/");
  document.querySelector(".preview-frame").style.aspectRatio=state.format.replace(":","/");
  $("sceneGrid").innerHTML="";
  scenes.forEach(s=>{
    const b=document.createElement("button");b.className="scene"+(state.program===s.id?" program":"")+(state.preview===s.id?" preview":"");
    b.innerHTML="<b>"+s.name+"</b><small>"+s.type+"</small>";
    b.onclick=()=>previewSource(s.source);
    $("sceneGrid").appendChild(b)
  });
}
async function addMedia(){
  const url=$("mediaUrl").value.trim();if(!url)return toast("Paste a video URL first");
  const id="media-"+Date.now();
  state.sources.set(id,{id,name:"Media "+(state.sources.size+1),kind:"media",url});
  state.sources.set("media",{id:"media",name:"Media",kind:"media",url});
  state.preview="media";state.previewSource=state.sources.get("media");
  attachUrl("preview",url);render();toast("Media added to Preview");
}
function addImage(url){
  if(!url)return toast("Add an image URL or choose a file");
  state.sources.set("image",{id:"image",name:"Image",kind:"image",url});
  state.preview="image";state.previewSource=state.sources.get("image");
  attachImage("preview",url);render();toast("Image added to Preview");
}
function addGraphic(){
  const graphic={name:$("lowerName").value.trim()||"Our Production Studio",role:$("lowerRole").value.trim()||"Live",color:$("lowerColor").value};
  state.graphics.set("graphic",graphic);state.sources.set("graphic",{id:"graphic",name:"Lower Third",kind:"graphic",graphic});
  state.preview="graphic";state.previewSource=state.sources.get("graphic");
  attachPlaceholder("preview","Lower third");showGraphic("preview",graphic);render();toast("Lower third ready in Preview");
}
function addTicker(){
  state.ticker=$("tickerText").value.trim();showTicker();toast(state.ticker?"Ticker added to Program":"Ticker removed");
}
async function ensureProgram(){
  if(state.programSource?.kind==="stream")return;
  if(camera(state.program)||state.program==="screen"){
    const src=await createSource(state.program);
    state.programSource=src;state.programStream=src?.stream||null;attachVideo("program",state.programStream)
  }
}
function programRecordStream(){
  const v=$("programVideo");
  if(state.programSource?.kind==="stream")return state.programSource.stream;
  if(v.captureStream)return v.captureStream(30);
  return null;
}
async function record(){
  if(state.recording){state.recorder.stop();return}
  await ensureProgram();const stream=programRecordStream();
  if(!stream)return toast("Put a camera, screen or video on Program first");
  const mime=["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"].find(x=>MediaRecorder.isTypeSupported(x));
  try{
    state.chunks=[];state.recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
    state.recorder.ondataavailable=e=>e.data.size&&state.chunks.push(e.data);
    state.recorder.onstop=()=>{
      const blob=new Blob(state.chunks,{type:state.recorder.mimeType||"video/webm"}),a=document.createElement("a");
      a.href=URL.createObjectURL(blob);a.download="our-production-studio-recording.webm";a.click();
      state.recording=false;$("recordBtn").textContent="● Record";toast("Recording saved");
    };
    state.recorder.start(1000);state.recording=true;$("recordBtn").textContent="■ Stop";toast("Recording started")
  }catch(e){toast("Recording is not supported by this browser")}
}
$("takeBtn").onclick=()=>take(false);$("fadeBtn").onclick=()=>take(true);
$("swapBtn").onclick=()=>{
  const p=state.program,ps=state.programSource,s=state.preview,ss=state.previewSource;
  state.program=s;state.programSource=ss;state.preview=p;state.previewSource=ps;
  clearMedia("program");clearMedia("preview");
  const a=state.programSource,b=state.previewSource;
  if(a?.kind==="stream")attachVideo("program",a.stream);else if(a?.kind==="media")attachUrl("program",a.url);else if(a?.kind==="image")attachImage("program",a.url);else if(a?.kind==="graphic"){attachPlaceholder("program","Lower third");showGraphic("program",a.graphic)}else attachPlaceholder("program",name(state.program));
  render();previewSource(state.preview);toast("Program and preview swapped")
};
$("recordBtn").onclick=record;
$("goLiveBtn").onclick=()=>{
  state.live=!state.live;$("goLiveBtn").textContent=state.live?"END LIVE":"GO LIVE";
  $("streamState").textContent=state.live?"Local live session":"Offline";$("connectionDot").classList.toggle("good",state.live);
  $("connectionText").textContent=state.live?"Production active":"Ready";toast(state.live?"Production session started":"Production session ended")
};
$("addSceneBtn").onclick=()=>{
  const title=prompt("Scene name");if(!title)return;
  scenes.push({id:"custom-"+Date.now(),name:title,type:"Custom scene",source:"graphic"});render();toast("Scene created")
};
document.querySelectorAll(".source-card").forEach(b=>b.onclick=()=>previewSource(b.dataset.source));
$("cameraBtn").onclick=()=>previewSource("camera1");
$("screenBtn").onclick=()=>previewSource("screen");
$("addMediaBtn").onclick=addMedia;
$("addImageBtn").onclick=()=>addImage($("imageUrl").value.trim());
$("imageFile").onchange=e=>{const f=e.target.files[0];if(f)addImage(URL.createObjectURL(f))};
$("addGraphicBtn").onclick=addGraphic;$("tickerBtn").onclick=addTicker;
$("formatSelect").onchange=e=>{state.format=e.target.value;render()};
document.querySelectorAll("[data-mute]").forEach(b=>b.onclick=()=>{
  b.classList.toggle("muted");b.textContent=b.classList.contains("muted")?"U":"M";toast(b.dataset.mute.toUpperCase()+(b.classList.contains("muted")?" muted":" unmuted"))
});
setInterval(()=>["micMeter","programMeter","mediaMeter","masterMeter"].forEach(id=>$(id).style.width=(35+Math.random()*55)+"%"),500);
setInterval(()=>{const n=new Date();$("programClock").textContent=[n.getHours(),n.getMinutes(),n.getSeconds()].map(x=>String(x).padStart(2,"0")).join(":")},1000);
render();previewSource("camera2");