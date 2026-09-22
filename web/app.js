const $=id=>document.getElementById(id);

const state={
  format:"16:9",live:false,recording:false,recorder:null,chunks:[],transition:"CUT",
  scenes:[
    {id:"scene-1",name:"Camera 1",layers:[{id:"l1",source:"camera1",x:0,y:0,w:1,h:1,opacity:1,visible:true}]},
    {id:"scene-2",name:"Camera 2",layers:[{id:"l2",source:"camera2",x:0,y:0,w:1,h:1,opacity:1,visible:true}]},
    {id:"scene-3",name:"Interview",layers:[{id:"l3",source:"camera1",x:0,y:0,w:.68,h:1,opacity:1,visible:true},{id:"l4",source:"camera2",x:.68,y:.12,w:.32,h:.88,opacity:1,visible:true}]},
    {id:"scene-4",name:"Screen + Cam",layers:[{id:"l5",source:"screen",x:0,y:0,w:1,h:1,opacity:1,visible:true},{id:"l6",source:"camera1",x:.72,y:.7,w:.26,h:.26,opacity:1,visible:true}]},
    {id:"scene-5",name:"Media",layers:[{id:"l7",source:"media",x:0,y:0,w:1,h:1,opacity:1,visible:true}]}
  ],
  selectedScene:"scene-1",programScene:"scene-1",previewScene:"scene-2",
  sources:new Map(),mediaItems:[],graphics:new Map(),ticker:"",streams:{}
};

const W=1920,H=1080;
const canvases={program:$("programCanvas"),preview:$("previewCanvas")};
const ctxs={program:canvases.program.getContext("2d"),preview:canvases.preview.getContext("2d")};
const sourceVideos=new Map(),sourceImages=new Map();

function toast(m){const e=$("toast");e.textContent=m;e.classList.add("show");clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>e.classList.remove("show"),2200)}
function currentScene(id){return state.scenes.find(s=>s.id===id)}
function sceneName(id){return currentScene(id)?.name||id}
function selectedScene(){return currentScene(state.selectedScene)||state.scenes[0]}
function fmtTime(x){if(!isFinite(x))return"00:00";return String(Math.floor(x/60)).padStart(2,"0")+":"+String(Math.floor(x%60)).padStart(2,"0")}
function setFormatCanvas(){const [a,b]=state.format.split(":").map(Number);const ratio=a/b;const cw=ratio>=1?1920:1080,ch=ratio>=1?1080:1920;for(const c of Object.values(canvases)){c.width=cw;c.height=ch}render()}
function showGraphic(which,g){const box=$(which==="program"?"programGraphic":"previewGraphic"),n=$(which==="program"?"programGraphicName":"previewGraphicName"),r=$(which==="program"?"programGraphicRole":"previewGraphicRole");if(!g){box.hidden=true;return}n.textContent=g.name||"";r.textContent=g.role||"";box.style.setProperty("--accent",g.color||"#16c784");box.hidden=false}
function stopStream(s){s?.getTracks?.().forEach(t=>t.stop())}

async function captureSource(source){
  if(state.sources.has(source)&&state.sources.get(source).kind==="stream")return state.sources.get(source);
  try{
    let stream;
    if(source==="screen")stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
    else if(source==="camera1"||source==="camera2")stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:source==="camera1"?"environment":"user",width:{ideal:1920},height:{ideal:1080}},audio:true});
    else return state.sources.get(source)||null;
    const item={id:source,name:source==="screen"?"Screen share":source==="camera1"?"Camera 1":"Camera 2",kind:"stream",stream};
    state.sources.set(source,item);state.streams[source]=stream;
    const v=document.createElement("video");v.autoplay=true;v.playsInline=true;v.muted=true;v.srcObject=stream;await v.play().catch(()=>{});sourceVideos.set(source,v);
    stream.getVideoTracks()[0]?.addEventListener("ended",()=>{state.sources.delete(source);sourceVideos.delete(source);render()});
    return item;
  }catch(e){toast("Camera/screen permission was not available");return null}
}

function ensureMediaElement(item){
  let v=sourceVideos.get(item.id);
  if(v)return v;
  v=document.createElement("video");v.autoplay=false;v.playsInline=true;v.controls=false;v.preload="auto";v.muted=false;v.src=item.url;
  v.onerror=()=>toast("Media link cannot be played. Use a direct MP4/WebM URL or a supported stream URL.");
  sourceVideos.set(item.id,v);return v;
}
function ensureImage(item){let img=sourceImages.get(item.id);if(img)return img;img=new Image();img.onload=render;img.src=item.url;sourceImages.set(item.id,img);return img}

async function ensureLayerSource(source){
  if(source==="camera1"||source==="camera2"||source==="screen")return captureSource(source);
  return state.sources.get(source)||null;
}

async function drawLayer(ctx,layer){
  if(!layer.visible)return;
  const item=await ensureLayerSource(layer.source);
  if(!item)return;
  const cw=ctx.canvas.width,ch=ctx.canvas.height,x=layer.x*cw,y=layer.y*ch,w=layer.w*cw,h=layer.h*ch;
  ctx.save();ctx.globalAlpha=layer.opacity??1;
  if(item.kind==="stream"||item.kind==="media"){
    const v=sourceVideos.get(item.id);if(!v)return;
    if(v.readyState>=2){ctx.drawImage(v,x,y,w,h)}
  }else if(item.kind==="image"){const img=ensureImage(item);if(img.complete&&img.naturalWidth)ctx.drawImage(img,x,y,w,h)}
  else if(item.kind==="graphic"){ctx.fillStyle="#070a10e8";ctx.fillRect(x,y,w,h);ctx.fillStyle=item.graphic?.color||"#16c784";ctx.fillRect(x,y,5,h);ctx.fillStyle="#fff";ctx.font="700 38px system-ui";ctx.fillText(item.graphic?.name||"Lower Third",x+22,y+55);ctx.fillStyle="#b9c4d2";ctx.font="22px system-ui";ctx.fillText(item.graphic?.role||"",x+22,y+88)}
  else if(item.kind==="text"){ctx.fillStyle="#ffffff";ctx.font="700 42px system-ui";ctx.fillText(item.text||"Text",x,y+50)}
  ctx.restore();
}
async function renderCanvas(which,sceneId){
  const ctx=ctxs[which];ctx.fillStyle="#05070a";ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
  const s=currentScene(sceneId);if(!s)return;
  for(const layer of s.layers)await drawLayer(ctx,layer);
  if(which==="program"&&state.ticker){ctx.fillStyle="#0b0e13ee";ctx.fillRect(0,ctx.canvas.height-46,ctx.canvas.width,46);ctx.fillStyle="#fff";ctx.font="700 24px system-ui";ctx.fillText(state.ticker,24,ctx.canvas.height-15)}
}
async function render(){await renderCanvas("program",state.programScene);await renderCanvas("preview",state.previewScene);updateLabels();renderScenes();renderLayers()}
function updateLabels(){
  $("programLabel").textContent=sceneName(state.programScene);$("programSource").textContent=sceneName(state.programScene);
  $("previewLabel").textContent=sceneName(state.previewScene);$("previewSource").textContent=sceneName(state.previewScene);
  $("transitionStatus").textContent=state.transition;$("formatPill").textContent=state.format;
  $("selectedSceneName").textContent=sceneName(state.selectedScene);$("layerCount").textContent=(selectedScene()?.layers.length||0)+" layers";
  document.querySelector(".program-frame").style.aspectRatio=state.format.replace(":","/");
  document.querySelector(".preview-frame").style.aspectRatio=state.format.replace(":","/");
}
function renderScenes(){
  const grid=$("sceneGrid");grid.innerHTML="";
  state.scenes.forEach(s=>{const b=document.createElement("button");b.className="scene"+(state.programScene===s.id?" program":"")+(state.previewScene===s.id?" preview":"")+(state.selectedScene===s.id?" selected":"");b.innerHTML="<b>"+s.name+"</b><small>"+s.layers.length+" layers</small>";b.onclick=()=>{state.selectedScene=s.id;state.previewScene=s.id;render()};grid.appendChild(b)})
}
function renderLayers(){
  const list=$("layerList");list.innerHTML="";const s=selectedScene();if(!s)return;
  s.layers.forEach((l,i)=>{const row=document.createElement("div");row.className="layer-row";row.innerHTML="<button class='vis'>"+(l.visible?"◉":"○")+"</button><div><b>"+layerLabel(l)+"</b><small>Layer "+(i+1)+" · "+Math.round(l.x*100)+"% x "+Math.round(l.y*100)+"%</small></div><input class='opacity' type='range' min='0' max='100' value='"+Math.round((l.opacity??1)*100)+"'><button class='up'>↑</button><button class='down'>↓</button><button class='remove'>×</button>";
    row.querySelector(".vis").onclick=()=>{l.visible=!l.visible;render()};
    row.querySelector(".opacity").oninput=e=>{l.opacity=Number(e.target.value)/100;render()};
    row.querySelector(".up").onclick=()=>{if(i>0){[s.layers[i-1],s.layers[i]]=[s.layers[i],s.layers[i-1]];render()}};
    row.querySelector(".down").onclick=()=>{if(i<s.layers.length-1){[s.layers[i+1],s.layers[i]]=[s.layers[i],s.layers[i+1]];render()}};
    row.querySelector(".remove").onclick=()=>{s.layers=s.layers.filter(x=>x.id!==l.id);render()};
    list.appendChild(row)
  })
}
function layerLabel(l){const m={camera1:"Camera 1",camera2:"Camera 2",screen:"Screen",media:"Media",image:"Image",text:"Text"};return m[l.source]||l.source}
async function addLayer(source){
  const s=selectedScene();if(!s)return;
  if(["camera1","camera2","screen"].includes(source))await ensureLayerSource(source);
  if(source==="media"){const item=state.mediaItems.at(-1);if(!item)return toast("Add a video to the media library first");source=item.id}
  if(source==="image"){const item=[...state.sources.values()].find(x=>x.kind==="image");if(!item)return toast("Choose an image first");source=item.id}
  if(source==="text"){s.layers.push({id:"layer-"+Date.now(),source:"text",text:"LIVE",x:.05,y:.08,w:.4,h:.12,opacity:1,visible:true});render();return}
  const n=s.layers.length;s.layers.push({id:"layer-"+Date.now(),source,x:n%2?.55:0,y:n>1?.55:0,w:.45,h:.45,opacity:1,visible:true});render()
}

async function previewScene(id){state.previewScene=id;state.selectedScene=id;await render()}
async function take(fade=false){if(state.previewScene===state.programScene)return toast("Preview is already on Program");state.programScene=state.previewScene;state.transition=fade?"FADE":"CUT";await render();if(fade)$("programFrame").animate([{opacity:1},{opacity:.15},{opacity:1}],{duration:450})}
async function swap(){[state.programScene,state.previewScene]=[state.previewScene,state.programScene];await render();toast("Program and Preview swapped")}
function addMedia(){
  const url=$("mediaUrl").value.trim();if(!url)return toast("Paste a direct media URL first");
  const id="media-"+Date.now(),item={id,name:"Media "+(state.mediaItems.length+1),kind:"media",url};state.mediaItems.push(item);state.sources.set(id,item);renderMediaList();toast("Media added to library");render()
}
function addImage(url){if(!url)return toast("Choose an image first");const id="image-"+Date.now(),item={id,name:"Image",kind:"image",url};state.sources.set(id,item);state.selectedScene=state.previewScene;state.sources.set("image",item);render();toast("Image added")}
function addGraphic(){const g={name:$("lowerName").value.trim()||"Our Production Studio",role:$("lowerRole").value.trim()||"Live",color:$("lowerColor").value};const item={id:"graphic",name:"Lower Third",kind:"graphic",graphic:g};state.sources.set("graphic",item);selectedScene().layers.push({id:"layer-"+Date.now(),source:"graphic",x:.04,y:.75,w:.7,h:.18,opacity:1,visible:true});render();toast("Lower third added to selected scene")}
function addTicker(){state.ticker=$("tickerText").value.trim();render();toast(state.ticker?"Ticker added":"Ticker removed")}
function renderMediaList(){const list=$("mediaList");list.innerHTML="";state.mediaItems.forEach(item=>{const row=document.createElement("div");row.className="media-item";row.innerHTML="<span class='media-name'>"+item.name+"</span><span class='media-kind'>VIDEO</span><button class='prev'>Preview</button><button class='play'>▶</button><button class='del'>×</button>";row.querySelector(".prev").onclick=()=>{state.sources.set(item.id,item);selectedScene().layers.push({id:"layer-"+Date.now(),source:item.id,x:0,y:0,w:1,h:1,opacity:1,visible:true});state.previewScene=state.selectedScene;render()};row.querySelector(".play").onclick=()=>{const v=ensureMediaElement(item);v.play().catch(()=>toast("Playback was blocked or the URL is not playable"));};row.querySelector(".del").onclick=()=>{state.mediaItems=state.mediaItems.filter(x=>x.id!==item.id);state.sources.delete(item.id);renderMediaList();render()};list.appendChild(row)})}
function currentPreviewMedia(){const s=currentScene(state.previewScene);const l=s?.layers.find(x=>x.source.startsWith("media-"));return l?sourceVideos.get(l.source):null}
function programRecordStream(){return canvases.program.captureStream(30)}
function record(){
  if(state.recording){state.recorder.stop();return}
  const stream=programRecordStream();const mime=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].find(x=>MediaRecorder.isTypeSupported(x));try{state.chunks=[];state.recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);state.recorder.ondataavailable=e=>e.data.size&&state.chunks.push(e.data);state.recorder.onstop=()=>{const blob=new Blob(state.chunks,{type:state.recorder.mimeType||"video/webm"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="our-production-studio-program.webm";a.click();state.recording=false;$("recordBtn").textContent="● Record";toast("Program recording saved")};state.recorder.start(1000);state.recording=true;$("recordBtn").textContent="■ Stop";toast("Program recording started")}catch(e){toast("Recording is not supported in this browser")}}
function persist(){try{localStorage.setItem("ops-studio-scenes",JSON.stringify(state.scenes));localStorage.setItem("ops-studio-format",state.format)}catch{}}
function restore(){try{const s=JSON.parse(localStorage.getItem("ops-studio-scenes")||"null");if(Array.isArray(s)&&s.length)state.scenes=s;state.format=localStorage.getItem("ops-studio-format")||"16:9"}catch{}}

$("takeBtn").onclick=()=>take(false);$("fadeBtn").onclick=()=>take(true);$("swapBtn").onclick=swap;$("recordBtn").onclick=record;
$("goLiveBtn").onclick=()=>{state.live=!state.live;$("goLiveBtn").textContent=state.live?"END LIVE":"GO LIVE";$("streamState").textContent=state.live?"Production active":"Offline";$("connectionDot").classList.toggle("good",state.live);$("connectionText").textContent=state.live?"Production active":"Ready";toast(state.live?"Production session started":"Production session ended")};
$("addSceneBtn").onclick=()=>{const title=prompt("Scene name","New Scene");if(!title)return;const id="scene-"+Date.now();state.scenes.push({id,name:title,layers:[]});state.selectedScene=id;state.previewScene=id;persist();render()};
document.querySelectorAll("[data-add-layer]").forEach(b=>b.onclick=()=>addLayer(b.dataset.addLayer));
$("cameraBtn").onclick=()=>addLayer("camera1");$("screenBtn").onclick=()=>addLayer("screen");$("addMediaBtn").onclick=addMedia;
$("videoFile").onchange=e=>{const f=e.target.files[0];if(!f)return;const id="media-"+Date.now(),item={id,name:f.name,kind:"media",url:URL.createObjectURL(f)};state.mediaItems.push(item);state.sources.set(id,item);renderMediaList();selectedScene().layers.push({id:"layer-"+Date.now(),source:id,x:0,y:0,w:1,h:1,opacity:1,visible:true});render();toast("Local video added to selected scene")};
$("addImageBtn").onclick=()=>$("imageFile").click();$("imageFile").onchange=e=>{const f=e.target.files[0];if(f)addImage(URL.createObjectURL(f))};
$("addGraphicBtn").onclick=addGraphic;$("tickerBtn").onclick=addTicker;
$("formatSelect").onchange=e=>{state.format=e.target.value;setFormatCanvas();persist()};
$("playPauseBtn").onclick=()=>{const v=currentPreviewMedia();if(!v)return toast("Select a media layer first");if(v.paused)v.play().catch(()=>toast("Playback blocked or URL invalid"));else v.pause()};
$("stopMediaBtn").onclick=()=>{const v=currentPreviewMedia();if(v){v.pause();v.currentTime=0}};$("restartMediaBtn").onclick=()=>{const v=currentPreviewMedia();if(v){v.currentTime=0;v.play().catch(()=>{})}};$("mediaVolume").oninput=e=>{const v=currentPreviewMedia();if(v)v.volume=Number(e.target.value)/100};
document.querySelectorAll("[data-mute]").forEach(b=>b.onclick=()=>{b.classList.toggle("muted");b.textContent=b.classList.contains("muted")?"U":"M"});
setInterval(()=>{renderCanvas("program",state.programScene);renderCanvas("preview",state.previewScene)},1000/30);
setInterval(()=>{const n=new Date();$("programClock").textContent=[n.getHours(),n.getMinutes(),n.getSeconds()].map(x=>String(x).padStart(2,"0")).join(":")},1000);
restore();$("formatSelect").value=state.format;setFormatCanvas();renderMediaList();render();
