const $=id=>document.getElementById(id);
const state={program:'camera1',preview:'camera2',programStream:null,previewStream:null,live:false,recording:false,recorder:null,chunks:[],transition:'CUT'};
const scenes=[{id:'camera1',name:'Camera 1',type:'Rear camera'},{id:'camera2',name:'Camera 2',type:'Front camera'},{id:'screen',name:'Screen',type:'Screen share'},{id:'graphic',name:'Graphics',type:'Title card'},{id:'ending',name:'Ending',type:'Graphic'}];
function toast(m){const e=$('toast');e.textContent=m;e.classList.add('show');clearTimeout(window.t);window.t=setTimeout(()=>e.classList.remove('show'),1800)}
function name(id){return scenes.find(s=>s.id===id)?.name||id}
function camera(id){return id==='camera1'||id==='camera2'}
function render(){
 $('programLabel').textContent=name(state.program);$('programSource').textContent=name(state.program);
 $('previewLabel').textContent=name(state.preview);$('previewSource').textContent=name(state.preview);
 $('transitionStatus').textContent=state.transition;$('sceneGrid').innerHTML='';
 scenes.forEach(s=>{const b=document.createElement('button');b.className='scene'+(state.program===s.id?' program':'')+(state.preview===s.id?' preview':'');
 b.innerHTML='<b>'+s.name+'</b><small>'+s.type+'</small>';b.onclick=()=>{state.preview=s.id;render();preparePreview()};$('sceneGrid').appendChild(b)})
}
function attach(v,stream,placeholder){v.srcObject=stream||null;v.style.display=stream?'block':'none';placeholder.style.display=stream?'none':'flex'}
async function getSource(id){
 if(id==='graphic'||id==='ending')return null;if(!navigator.mediaDevices)return null;
 try{return camera(id)?await navigator.mediaDevices.getUserMedia({video:{facingMode:id==='camera1'?'environment':'user'},audio:true}):await navigator.mediaDevices.getDisplayMedia({video:true,audio:true})}catch{return null}
}
async function preparePreview(){
 if(state.previewStream)state.previewStream.getTracks().forEach(t=>t.stop());
 if(camera(state.preview)||state.preview==='screen'){state.previewStream=await getSource(state.preview);attach($('previewVideo'),state.previewStream,$('previewPlaceholder'))}
 else{state.previewStream=null;attach($('previewVideo'),null,$('previewPlaceholder'));$('previewPlaceholder').innerHTML='<b>'+state.preview.toUpperCase()+'</b><span>Live graphic source</span>'}
}
async function take(fade){
 if(state.preview===state.program){toast('Preview is already on program');return}
 if(state.programStream)state.programStream.getTracks().forEach(t=>t.stop());
 state.program=state.preview;state.programStream=state.previewStream;state.previewStream=null;state.transition=fade?'FADE':'CUT';
 if(fade)$('programFrame').animate([{opacity:1},{opacity:.2},{opacity:1}],{duration:500});
 attach($('programVideo'),state.programStream,$('programPlaceholder'));
 if(!state.programStream)$('programPlaceholder').innerHTML='<b>'+state.program.toUpperCase()+'</b><span>Live graphic source</span>';
 render();preparePreview()
}
async function ensureProgram(){if(!state.programStream&&(camera(state.program)||state.program==='screen')){state.programStream=await getSource(state.program);attach($('programVideo'),state.programStream,$('programPlaceholder'))}}
async function record(){
 if(state.recording){state.recorder.stop();return}await ensureProgram();
 if(!state.programStream){toast('Start a camera or screen source first');return}
 const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));
 try{
  state.chunks=[];state.recorder=new MediaRecorder(state.programStream,mime?{mimeType:mime}:undefined);
  state.recorder.ondataavailable=e=>e.data.size&&state.chunks.push(e.data);
  state.recorder.onstop=()=>{const blob=new Blob(state.chunks,{type:state.recorder.mimeType||'video/webm'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='our-production-studio-recording.webm';a.click();state.recording=false;$('recordBtn').textContent='● Record';toast('Recording saved')};
  state.recorder.start(1000);state.recording=true;$('recordBtn').textContent='■ Stop';toast('Recording started')
 }catch{toast('Recording is not supported here')}
}
$('takeBtn').onclick=()=>take(false);$('fadeBtn').onclick=()=>take(true);
$('swapBtn').onclick=()=>{const p=state.program;state.program=state.preview;state.preview=p;const s=state.programStream;state.programStream=state.previewStream;state.previewStream=s;attach($('programVideo'),state.programStream,$('programPlaceholder'));attach($('previewVideo'),state.previewStream,$('previewPlaceholder'));render();toast('Program and preview swapped')};
$('recordBtn').onclick=record;
$('goLiveBtn').onclick=()=>{state.live=!state.live;$('goLiveBtn').textContent=state.live?'END LIVE':'GO LIVE';$('streamState').textContent=state.live?'Program ready':'Offline';$('connectionDot').classList.toggle('good',state.live);$('connectionText').textContent=state.live?'Live session':'Local studio';toast(state.live?'Live session started':'Live session ended')};
$('addSceneBtn').onclick=()=>toast('Scene editor is next');
document.querySelectorAll('.source-card').forEach(b=>b.onclick=()=>{state.preview=b.dataset.source;render();preparePreview()});
document.querySelectorAll('[data-mute]').forEach(b=>b.onclick=()=>{b.classList.toggle('muted');b.textContent=b.classList.contains('muted')?'U':'M';toast(b.dataset.mute.toUpperCase()+(b.classList.contains('muted')?' muted':' unmuted'))});
setInterval(()=>['micMeter','programMeter','mediaMeter','masterMeter'].forEach(id=>$(id).style.width=(35+Math.random()*55)+'%'),500);
render();preparePreview();