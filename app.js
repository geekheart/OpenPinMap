'use strict';
(() => {
const $ = id => document.getElementById(id);
const i18n = window.OpenPinMapI18n, t = i18n.t;
let saveStateKey='status.example', lastToast=null, hasTransparency=false, exportError=null;
function setSaveState(key){saveStateKey=key;$('save-state').textContent=t(key);}
const clone = value => JSON.parse(JSON.stringify(value));
const clamp = (v,min,max) => Math.max(min, Math.min(max,v));
const metricCanvas = document.createElement('canvas'), metric = metricCanvas.getContext('2d');
let state, sourceImage, zoom = .12, fitMode = true, selectedGroup = 0, tab = 'material';
let history = [], historyIndex = -1, frame, recordTimer, db, importTicket = 0;
let hits = [], dragging = null, toastTimer, selection=null, snapLines=[], spaceDown=false;
const initial = () => validateProject({format:'openpinmap',version:2,state:{...clone(window.PIN_DEFAULTS),imageData:window.PIN_DEFAULT_IMAGE}});
function snapshot(){const {imageData,...rest}=state;return {...clone(rest),imageData};}
function toast(message,values={}){lastToast={message,values};$('toast').textContent=typeof message==='string'?t(message,values):i18n.errorMessage(message);$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4000);}
function colorFor(name){if(/^(GND|GROUND|VSS)$/i.test(name.trim()))return $('color-ground').value;if(/^(\+?(\d+(\.\d+)?V\d*|V\d+)|VCC|VIN|VBUS|BAT|VOUT|VO\d+)$/i.test(name.trim()))return $('color-power').value;return $('color-gpio').value;}
function cleanName(){return (state.name||'pinout').replace(/[\\/:*?"<>|\x00-\x1F]/g,'_');}
function loadImage(data){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(i18n.error('error.imageRead'));img.src=data;});}
const {validateGroups,validateProject} = window.OpenPinMapModel;
async function replaceState(next,resetHistory=false){
 const ticket=++importTicket, img=state?.imageData===next.imageData?sourceImage:await loadImage(next.imageData);
 if(ticket!==importTicket)return;
 if(img.width*img.height>50000000)throw i18n.error('error.imagePixels');
 state=next;sourceImage=img;selection=null;selectedGroup=clamp(selectedGroup,0,state.groups.length-1);syncUI();if(resetHistory){history=[];historyIndex=-1;}record();fit();
}
function groupMetrics(g){
 const fs=g.font?.size||state.fontSize;metric.font=`${fs}px ${state.fontFamily}`;
 let maxWidth=0,maxHeight=0;
 for(const p of g.pins){const m=metric.measureText(p.name||' ');maxWidth=Math.max(maxWidth,m.width);maxHeight=Math.max(maxHeight,(m.actualBoundingBoxAscent||fs*.75)+(m.actualBoundingBoxDescent||0));}
 return {width:Math.ceil(maxWidth)+state.fontSize*2,height:Math.ceil(maxHeight||fs*.75)+Math.floor(state.fontSize*.4)*2,fontSize:fs};
}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function drawContent(ctx,{labels=true}={}){
 if(state.background!=='transparent'){ctx.fillStyle=state.background==='dark'?'#202c25':'#ffffff';ctx.fillRect(0,0,state.width,state.height);}
 const ib=imageBounds();drawBoard(ctx);const nextHits=[];
 if(labels)state.groups.forEach((g,gi)=>{
  const m=groupMetrics(g),s=g.scale||1;ctx.save();ctx.translate(...g.start);ctx.scale(s,s);ctx.font=`${m.fontSize}px ${state.fontFamily}`;
  g.pins.forEach((pin,i)=>{
   const y=i*g.gap;
   if(state.guides){const left=g.start[0]+m.width*s<=ib.x+ib.w/2,edge=left?ib.x:ib.x+ib.w;ctx.strokeStyle=pin.color;ctx.lineWidth=Math.max(2,state.fontSize*.04);ctx.beginPath();ctx.moveTo(left?m.width:0,y+m.height/2);ctx.lineTo((edge-g.start[0])/s,y+m.height/2);ctx.stroke();}
   ctx.fillStyle=pin.color;roundRect(ctx,0,y,m.width,m.height,m.height/2*state.radius/100);
   const tm=ctx.measureText(pin.name),asc=tm.actualBoundingBoxAscent||m.fontSize*.75,des=tm.actualBoundingBoxDescent||0;
   ctx.fillStyle='#ffffff';ctx.textAlign='left';ctx.fillText(pin.name,(m.width-tm.width)/2,y+(m.height+asc-des)/2);
  });ctx.restore();if(g.pins.length)nextHits.push({...groupBounds(g),group:gi});
 });return nextHits;
}
function render(){
 frame=null;if(!sourceImage)return;
 const cvs=$('preview'),ratio=Math.min(1,zoom*(window.devicePixelRatio||1),2400/Math.max(state.width,state.height));
 cvs.width=Math.max(1,Math.round(state.width*ratio));cvs.height=Math.max(1,Math.round(state.height*ratio));
 cvs.style.width=`${state.width*zoom}px`;cvs.style.height=`${state.height*zoom}px`;
 $('canvas-wrap').style.width=cvs.style.width;$('canvas-wrap').style.height=cvs.style.height;
 const ctx=cvs.getContext('2d');ctx.scale(ratio,ratio);hits=drawContent(ctx);ctx.strokeStyle='#d37642';ctx.lineWidth=1/zoom;ctx.setLineDash([4/zoom,4/zoom]);for(const line of snapLines){ctx.beginPath();if(line.axis==='x'){ctx.moveTo(line.value,0);ctx.lineTo(line.value,state.height);}else{ctx.moveTo(0,line.value);ctx.lineTo(state.width,line.value);}ctx.stroke();}syncSelection();
 $('canvas-wrap').classList.toggle('checker',state.background==='transparent');
 $('pin-total').textContent=t('status.pinCount',{count:state.groups.reduce((n,g)=>n+g.pins.length,0)});$('output-size').textContent=`${state.paper?.format==='a4'?'A4 · ':''}${state.width} × ${state.height} px`;
 $('preview-background').textContent=t('status.canvas.'+state.background);
 $('zoom-value').textContent=`${Math.round(zoom*100)}%`;
}
function schedule(){if(!frame)frame=requestAnimationFrame(render);}
function fit(){if(!state)return;fitMode=true;const vp=$('viewport');zoom=clamp(Math.min((vp.clientWidth-76)/state.width,(vp.clientHeight-76)/state.height),.025,2);schedule();}
function setZoom(value,cx,cy){
 const vp=$('viewport'),vr=vp.getBoundingClientRect(),before=$('preview').getBoundingClientRect();cx??=vr.left+vr.width/2;cy??=vr.top+vr.height/2;const x=(cx-before.left)/zoom,y=(cy-before.top)/zoom;
 fitMode=false;zoom=clamp(value,.025,4);if(frame)cancelAnimationFrame(frame);render();const after=$('preview').getBoundingClientRect();vp.scrollLeft+=after.left+x*zoom-cx;vp.scrollTop+=after.top+y*zoom-cy;
}
function record(){
 clearTimeout(recordTimer);
 if(historyIndex>=0){const before=history[historyIndex],current=snapshot();if(before.imageData===current.imageData&&JSON.stringify({...before,imageData:null})===JSON.stringify({...current,imageData:null})){persist();return;}}
 history=history.slice(0,historyIndex+1);history.push(snapshot());if(history.length>30)history.shift();historyIndex=history.length-1;updateHistory();persist();
}
function updateHistory(){$('undo').disabled=historyIndex<=0;$('redo').disabled=historyIndex>=history.length-1;}
async function travel(delta){
 record();
 const ix=historyIndex+delta;if(ix<0||ix>=history.length)return;
 const next=history[ix];try{const img=state.imageData===next.imageData?sourceImage:await loadImage(next.imageData);historyIndex=ix;state={...clone({...next,imageData:undefined}),imageData:next.imageData};sourceImage=img;selectedGroup=clamp(selectedGroup,0,state.groups.length-1);syncUI();updateHistory();if(fitMode)fit();else schedule();persist();}catch(e){toast(e);}
}
function openDb(){return new Promise(resolve=>{try{const req=indexedDB.open('openpinmap',1);req.onupgradeneeded=()=>req.result.createObjectStore('projects');req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);}catch{resolve(null);}});}
function readSaved(){return new Promise(resolve=>{if(!db)return resolve(null);try{const req=db.transaction('projects').objectStore('projects').get('latest');req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);}catch{resolve(null);}});}
function persist(){
 if(!state)return;if(!db){setSaveState('status.saveManual');return;}
 try{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put({format:'openpinmap',version:2,state:snapshot()},'latest');tx.oncomplete=()=>setSaveState('status.saved');tx.onerror=()=>setSaveState('status.saveFailed');}catch{setSaveState('status.saveManual');}
}
function syncUI(){
 document.querySelectorAll('[data-rotation]').forEach(el=>{el.classList.toggle('selected',Number(el.dataset.rotation)===(state.imageRotation||0));el.setAttribute('aria-pressed',String(Number(el.dataset.rotation)===(state.imageRotation||0)));});
 $('paper-size').value=state.paper?.format==='a4'?state.paper.orientation:'custom';$('canvas-width').disabled=$('canvas-height').disabled=state.paper?.format==='a4';
 for(const kind of ['gpio','power','ground'])$('color-'+kind).value=state.palette[kind];
 $('project-name').value=state.name;
 document.querySelectorAll('[data-state]').forEach(el=>{const value=state[el.dataset.state];if(el.type==='checkbox')el.checked=value;else el.value=value;});
 $('image-scale-value').textContent=`${state.imageScale}%`;$('font-size-value').textContent=`${state.fontSize} px`;$('radius-value').textContent=`${state.radius}%`;
 document.querySelectorAll('[data-bg]').forEach(el=>el.classList.toggle('selected',el.dataset.bg===state.background));
 $('source-thumbnail').src=state.imageData;$('source-name').textContent=state.imageName;
 const a=document.createElement('canvas');a.width=64;a.height=64;const ctx=a.getContext('2d',{willReadFrequently:true});ctx.drawImage(sourceImage,0,0,64,64);const bytes=ctx.getImageData(0,0,64,64).data;let transparent=false;for(let i=3;i<bytes.length;i+=4)if(bytes[i]<250){transparent=true;break;}
 hasTransparency=transparent;$('alpha-tag').textContent=t(transparent?'status.alpha':'status.opaque');
 syncGroups();
}
function syncGroups(){
 const tabs=$('group-tabs');tabs.replaceChildren();state.groups.forEach((g,i)=>{const b=document.createElement('button');b.textContent=g.connector||`H${i+1}`;b.className=i===selectedGroup?'active':'';b.onclick=()=>{selectedGroup=i;selection='group';syncGroups();schedule();};tabs.append(b);});
 syncTransformFields();const g=state.groups[selectedGroup];$('group-name').value=g.connector;$('group-x').value=Math.round(g.start[0]*10)/10;$('group-y').value=Math.round(g.start[1]*10)/10;$('group-gap').value=Math.round(g.gap*100)/100;$('delete-group').disabled=state.groups.length<=1;
 const list=$('pin-list');list.replaceChildren();g.pins.forEach((pin,i)=>{
  const row=document.createElement('div');row.className='pin-row';const n=document.createElement('span');n.className='pin-number';n.textContent=String(i+1).padStart(2,'0');
  const color=document.createElement('input');color.type='color';color.value=pin.color;color.setAttribute('aria-label',t('pin.colorAria',{number:i+1}));color.oninput=()=>{pin.color=color.value;schedule();};color.onchange=record;
  const name=document.createElement('input');name.type='text';name.value=pin.name;name.maxLength=80;name.setAttribute('aria-label',t('pin.nameAria',{number:i+1}));name.oninput=()=>{pin.name=name.value;schedule();};name.onchange=()=>{record();$('batch-pins').value=g.pins.map(p=>p.name).join('\n');};
  const remove=document.createElement('button');remove.className='remove-pin';remove.textContent='×';remove.setAttribute('aria-label',t('pin.deleteAria',{number:i+1}));remove.onclick=()=>{g.pins.splice(i,1);syncGroups();schedule();record();};row.append(n,color,name,remove);list.append(row);
 });$('batch-pins').value=g.pins.map(p=>p.name).join('\n');
}
function selectTab(value){tab=value;if(value==='pins')selection='group';document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('active',el.dataset.tab===value));document.querySelectorAll('.panel').forEach(el=>el.classList.toggle('active',el.id===`panel-${value}`));schedule();}
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function exportCanvas(labels){const canvas=document.createElement('canvas');canvas.width=state.width;canvas.height=state.height;drawContent(canvas.getContext('2d'),{labels});return canvas;}
async function readJson(file){if(file.size>40000000)throw i18n.error('error.projectSize');try{return JSON.parse(await file.text());}catch{throw i18n.error('error.json');}}
async function loadUploaded(file){
 if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type)){toast('error.imageType');return;}
 if(file.size>25000000){toast('error.imageSize');return;}
 try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(i18n.error('error.fileRead'));reader.readAsDataURL(file);});const img=await loadImage(data);if(img.width*img.height>50000000)throw i18n.error('error.uploadPixels');selection='image';state.imageRotation=0;state.imageData=data;state.imageName=file.name;sourceImage=img;state.imageScale=clamp(Math.min(state.width*.54/img.width,state.height*.72/img.height)*100,1,500);state.imageX=Math.round((state.width-img.width*state.imageScale/100)/2);state.imageY=Math.round((state.height-img.height*state.imageScale/100)/2);syncUI();schedule();record();toast('notice.replaced');}catch(e){toast(e);}
}
async function crop(){
 const c=document.createElement('canvas');c.width=sourceImage.width;c.height=sourceImage.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(sourceImage,0,0);const a=ctx.getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=-1,y1=-1;
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){if(a[(y*c.width+x)*4+3]>8){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}}
 if(x1<0){toast('notice.emptyImage');return;}if(x0===0&&y0===0&&x1===c.width-1&&y1===c.height-1){toast('notice.noMargin');return;}
 const out=document.createElement('canvas');out.width=x1-x0+1;out.height=y1-y0+1;out.getContext('2d').drawImage(c,x0,y0,out.width,out.height,0,0,out.width,out.height);const offset=state.imageRotation===90?[c.height-y1-1,x0]:state.imageRotation===180?[c.width-x1-1,c.height-y1-1]:state.imageRotation===270?[y0,c.width-x1-1]:[x0,y0];state.imageX+=offset[0]*state.imageScale/100;state.imageY+=offset[1]*state.imageScale/100;state.imageData=out.toDataURL('image/png');sourceImage=await loadImage(state.imageData);syncUI();schedule();record();toast('notice.cropped');
}
function imageBounds(){const swap=state.imageRotation===90||state.imageRotation===270;return{x:state.imageX,y:state.imageY,w:(swap?sourceImage.height:sourceImage.width)*state.imageScale/100,h:(swap?sourceImage.width:sourceImage.height)*state.imageScale/100};}
function drawBoard(ctx){const b=imageBounds(),w=sourceImage.width*state.imageScale/100,h=sourceImage.height*state.imageScale/100;ctx.save();ctx.translate(b.x+b.w/2,b.y+b.h/2);ctx.rotate((state.imageRotation||0)*Math.PI/180);ctx.drawImage(sourceImage,-w/2,-h/2,w,h);ctx.restore();}
function groupBounds(g){const m=groupMetrics(g),s=g.scale||1;return{x:g.start[0],y:g.start[1],w:m.width*s,h:((Math.max(1,g.pins.length)-1)*g.gap+m.height)*s};}
function selectedBounds(){return selection==='image'?imageBounds():selection==='group'?groupBounds(state.groups[selectedGroup]):null;}
function syncSelection(){
 const box=$('selection-box'),b=selectedBounds();box.hidden=!b;if(!b)return;
 Object.assign(box.style,{left:`${b.x*zoom}px`,top:`${b.y*zoom}px`,width:`${b.w*zoom}px`,height:`${b.h*zoom}px`});
 $('selection-name').textContent=selection==='image'?t('image.title'):state.groups[selectedGroup].connector;
 box.querySelectorAll('[data-handle="n"],[data-handle="s"]').forEach(el=>el.hidden=selection!=='group'||state.groups[selectedGroup].pins.length<2);
}
function syncTransformFields(){
 $('image-x').value=Math.round(state.imageX*10)/10;$('image-y').value=Math.round(state.imageY*10)/10;$('image-scale').value=state.imageScale;$('image-scale-value').textContent=`${Math.round(state.imageScale*10)/10}%`;
 const g=state.groups[selectedGroup];$('group-x').value=Math.round(g.start[0]*10)/10;$('group-y').value=Math.round(g.start[1]*10)/10;$('group-gap').value=Math.round(g.gap*100)/100;$('group-scale').value=(g.scale||1)*100;$('group-scale-value').textContent=`${Math.round((g.scale||1)*1000)/10}%`;
}
function snapPosition(x,y,b){
 snapLines=[];if(!$('snap').checked)return[x,y];
 const targets=[{x:0,y:0,w:state.width,h:state.height},...(selection==='image'?[]:[imageBounds()]),...state.groups.filter((_,i)=>selection!=='group'||i!==selectedGroup).map(groupBounds)];
 for(const [axis,size,start] of [['x','w',x],['y','h',y]]){
  let delta=6/zoom,best=0,line=null;
  for(const t of targets)for(const edge of [t[axis],t[axis]+t[size]/2,t[axis]+t[size]])for(const offset of [0,b[size]/2,b[size]]){const d=edge-(start+offset);if(Math.abs(d)<delta){delta=Math.abs(d);best=d;line=edge;}}
  if(line!==null){if(axis==='x')x+=best;else y+=best;snapLines.push({axis,value:line});}
 }
 return[x,y];
}
function bindCanvas(){
 const cvs=$('preview'),vp=$('viewport'),box=$('selection-box'),pointers=new Map();let pinch=null;
 const point=e=>{const r=cvs.getBoundingClientRect();return{x:(e.clientX-r.left)/zoom,y:(e.clientY-r.top)/zoom};};
 const contains=(p,b)=>p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;
 function begin(e,handle){
  if(pointers.size>1)return;if(e.button!==0&&e.button!==1)return;e.preventDefault();
  const p=point(e);
  if(handle){const b=selectedBounds();if(!b)return;dragging={type:'resize',handle,b,...p,scale:selection==='image'?state.imageScale:(state.groups[selectedGroup].scale||1)};}
  else{
   const hit=[...hits].reverse().find(b=>contains(p,b));
   if(e.button===1||spaceDown)dragging={type:'pan',x:e.clientX,y:e.clientY,sx:vp.scrollLeft,sy:vp.scrollTop};
   else if(hit){selection='group';selectedGroup=hit.group;syncGroups();selectTab('pins');dragging={type:'move',...p,b:selectedBounds()};}
   else if(contains(p,imageBounds())){selection='image';selectTab('material');dragging={type:'move',...p,b:selectedBounds()};}
   else{selection=null;dragging={type:'pan',x:e.clientX,y:e.clientY,sx:vp.scrollLeft,sy:vp.scrollTop};}
  }
  e.currentTarget.setPointerCapture(e.pointerId);schedule();
 }
 function move(e){
  if(!dragging||pointers.size>1)return;
  const d=dragging;if(d.type==='pan'){vp.scrollLeft=d.sx+d.x-e.clientX;vp.scrollTop=d.sy+d.y-e.clientY;return;}
  const p=point(e),b=d.b;let x=b.x,y=b.y;
  if(d.type==='move'){
   [x,y]=snapPosition(b.x+p.x-d.x,b.y+p.y-d.y,b);
   if(selection==='image'){state.imageX=x;state.imageY=y;}else state.groups[selectedGroup].start=[x,y];
  }else{
   const h=d.handle,west=h.includes('w'),north=h.includes('n');
   if(h==='n'||h==='s'){
    const g=state.groups[selectedGroup],m=groupMetrics(g),s=g.scale||1;
    const wanted=h==='n'?b.h-(p.y-d.y):b.h+(p.y-d.y);
    g.gap=clamp((wanted/s-m.height)/(g.pins.length-1),1,2000);
    if(h==='n')g.start[1]=b.y+b.h-groupBounds(g).h;
   }else{
    const dx=(p.x-d.x)*(west?-1:1),dy=(p.y-d.y)*(north?-1:1);
    const factor=1+(dx*b.w+dy*b.h)/(b.w*b.w+b.h*b.h);
    const newScale=clamp(d.scale*factor,selection==='image'?1:.1,selection==='image'?500:5),f=newScale/d.scale;
    if(west)x=b.x+b.w*(1-f);if(north)y=b.y+b.h*(1-f);
    if(selection==='image'){state.imageScale=newScale;state.imageX=x;state.imageY=y;}else{const g=state.groups[selectedGroup];g.scale=newScale;g.start=[x,y];}
   }
  }
  syncTransformFields();schedule();
 }
 function end(){if(dragging){dragging=null;snapLines=[];record();schedule();}}
 cvs.onpointerdown=e=>begin(e);cvs.onpointermove=move;cvs.onpointerup=end;cvs.onpointercancel=end;
 box.querySelectorAll('[data-handle]').forEach(el=>{el.onpointerdown=e=>begin(e,el.dataset.handle);el.onpointermove=move;el.onpointerup=end;el.onpointercancel=end;});
 vp.addEventListener('wheel',e=>{e.preventDefault();if(dragging)return;const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?vp.clientHeight:1);setZoom(zoom*Math.exp(-clamp(delta,-300,300)*(e.ctrlKey?.008:.002)),e.clientX,e.clientY);},{passive:false});
 // Safari emits gesture events; Chromium trackpads use Ctrl + wheel.
 let gestureZoom;vp.addEventListener('gesturestart',e=>{e.preventDefault();gestureZoom=zoom;},{passive:false});vp.addEventListener('gesturechange',e=>{e.preventDefault();setZoom(gestureZoom*e.scale,e.clientX,e.clientY);},{passive:false});vp.addEventListener('gestureend',e=>e.preventDefault(),{passive:false});
 vp.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){end();const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom};vp.setPointerCapture(e.pointerId);}},{capture:true});
 vp.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2&&pinch){const[a,b]=[...pointers.values()];setZoom(pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance),(a.x+b.x)/2,(a.y+b.y)/2);}},{capture:true});
 for(const type of ['pointerup','pointercancel'])vp.addEventListener(type,e=>{pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;},{capture:true});
 window.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select')||$('export-dialog').open)return;if(e.code==='Space'){e.preventDefault();spaceDown=true;}if(e.key==='Escape'){selection=null;schedule();}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&selection){e.preventDefault();const step=e.shiftKey?10:1,b=selectedBounds(),x=b.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),y=b.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0);if(selection==='image'){state.imageX=x;state.imageY=y;}else state.groups[selectedGroup].start=[x,y];syncTransformFields();schedule();record();}});
 window.addEventListener('keyup',e=>{if(e.code==='Space')spaceDown=false;});window.addEventListener('blur',()=>{spaceDown=false;end();});
}

let exportBlob=null,exportUrl=null,exportTicket=0,exportTimer,exportLabels=true;
function outputDimensions(){const scale=state.exportSettings.scale;const w=Math.round(state.width*scale),h=Math.round(state.height*scale);if(w*h>64000000||w>8000||h>8000)throw i18n.error('error.outputSize');return{w,h,scale};}
function outputFilename(){return `${cleanName()}${exportLabels?'_PIN':''}.${state.exportSettings.format}`;}
function exportSvg(){
 const {escapeXml:esc}=window.OpenPinMapExport,{w,h,scale}=outputDimensions(),o=state.exportSettings,ib=imageBounds();let imageData=state.imageData;
 if(o.optimizeSvg){const c=document.createElement('canvas'),factor=Math.min(1,state.imageScale/100*scale);c.width=Math.max(1,Math.round(sourceImage.width*factor));c.height=Math.max(1,Math.round(sourceImage.height*factor));const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=o.smoothing;ctx.imageSmoothingQuality='high';ctx.drawImage(sourceImage,0,0,c.width,c.height);imageData=c.toDataURL('image/webp',o.quality/100);c.width=1;c.height=1;}
 const a4=state.paper?.format==='a4',landscape=state.paper?.orientation==='landscape';
 const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="${a4?(landscape?'297mm':'210mm'):w}" height="${a4?(landscape?'210mm':'297mm'):h}" viewBox="0 0 ${state.width} ${state.height}">`,`<title>${esc(state.name)}</title>`];
 if(state.background!=='transparent')parts.push(`<rect width="100%" height="100%" fill="${state.background==='dark'?'#202c25':'#ffffff'}"/>`);
 const iw=sourceImage.width*state.imageScale/100,ih=sourceImage.height*state.imageScale/100,cx=ib.x+ib.w/2,cy=ib.y+ib.h/2;parts.push(`<image x="${cx-iw/2}" y="${cy-ih/2}" width="${iw}" height="${ih}" transform="rotate(${state.imageRotation||0} ${cx} ${cy})" href="${esc(imageData)}"/>`);
 if(exportLabels)for(const g of state.groups){const m=groupMetrics(g),s=g.scale||1;parts.push(`<g transform="translate(${g.start.join(' ')}) scale(${s})" font-family="${esc(state.fontFamily)}" font-size="${m.fontSize}">`);metric.font=`${m.fontSize}px ${state.fontFamily}`;
  g.pins.forEach((p,i)=>{const y=i*g.gap;if(state.guides){const left=g.start[0]+m.width*s<=ib.x+ib.w/2,edge=left?ib.x:ib.x+ib.w;parts.push(`<path d="M ${left?m.width:0} ${y+m.height/2} H ${(edge-g.start[0])/s}" stroke="${p.color}" stroke-width="${Math.max(2,state.fontSize*.04)}"/>`);}
   const tm=metric.measureText(p.name),asc=tm.actualBoundingBoxAscent||m.fontSize*.75,des=tm.actualBoundingBoxDescent||0;
   parts.push(`<rect x="0" y="${y}" width="${m.width}" height="${m.height}" rx="${m.height/2*state.radius/100}" fill="${p.color}"/>`,`<text x="${(m.width-tm.width)/2}" y="${y+(m.height+asc-des)/2}" fill="#ffffff" xml:space="preserve">${esc(p.name)}</text>`);
  });parts.push('</g>');
 }parts.push('</svg>');return new Blob(parts,{type:'image/svg+xml'});
}
async function createExport(){
 const {w,h,scale}=outputDimensions(),o=state.exportSettings;
 if(o.format==='svg')return exportSvg();
 const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=o.smoothing;ctx.imageSmoothingQuality='high';
 if(o.format==='jpg'){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);}ctx.scale(w/state.width,h/state.height);drawContent(ctx,{labels:exportLabels});
 const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(i18n.error('error.export')),o.format==='jpg'?'image/jpeg':'image/png',o.quality/100));c.width=1;c.height=1;
 return window.OpenPinMapExport.withDpi(blob,300*scale);
}
function exportOptionsUI(){
 const o=state.exportSettings;$('export-scale-label').textContent=t(o.format==='svg'?'export.resolution':'export.dimensions');$('export-format').value=o.format;$('export-scale').value=o.scale;$('export-quality').value=o.quality;$('export-quality-value').textContent=`${o.quality}%`;$('export-optimize').checked=o.optimizeSvg;$('export-smoothing').checked=o.smoothing;
 $('svg-optimize-row').hidden=o.format!=='svg';$('quality-row').hidden=o.format==='png'||(o.format==='svg'&&!o.optimizeSvg);$('quality-label').textContent=t(o.format==='svg'?'export.assetQuality':'export.quality');$('export-filename').textContent=outputFilename();
}
function queueExport(){
 clearTimeout(exportTimer);const ticket=++exportTicket;exportBlob=null;$('download-export').disabled=$('save-as').disabled=true;exportError=null;$('export-error').textContent='';$('export-info').textContent=t('export.generating');exportOptionsUI();
 exportTimer=setTimeout(async()=>{try{const blob=await createExport();if(ticket!==exportTicket||!$('export-dialog').open)return;exportBlob=blob;if(exportUrl)URL.revokeObjectURL(exportUrl);exportUrl=URL.createObjectURL(blob);$('export-preview').src=exportUrl;
  const {w,h}=outputDimensions(),o=state.exportSettings;const dimensions=o.format==='svg'&&state.paper?.format==='a4'?(state.paper.orientation==='landscape'?'297 × 210 mm':'210 × 297 mm'):`${w} × ${h} px`;const kind=o.format==='png'?t('export.lossless'):o.format==='jpg'?(state.background==='transparent'?t('export.whiteBackground'):'JPG'):t('export.vector');
  $('export-info').textContent=`${dimensions} · ${blob.size>=1048576?(blob.size/1048576).toFixed(2)+' MB':(blob.size/1024).toFixed(1)+' KB'} · ${kind}`;$('download-export').disabled=$('save-as').disabled=false;
 }catch(e){if(ticket!==exportTicket)return;$('export-info').textContent='';exportError=e;$('export-error').textContent=i18n.errorMessage(e);}},160);
}
function openExport(labels=true){record();exportLabels=labels;$('export-title').textContent=t(labels?'export.image':'export.base');$('save-as').hidden=typeof window.showSaveFilePicker!=='function';$('export-dialog').showModal();queueExport();}
function bindExport(){
 $('close-export').onclick=()=>$('export-dialog').close();$('export-dialog').addEventListener('close',()=>{++exportTicket;clearTimeout(exportTimer);exportBlob=null;if(exportUrl){URL.revokeObjectURL(exportUrl);exportUrl=null;}$('export-preview').removeAttribute('src');});
 for(const [id,key] of [['export-format','format'],['export-scale','scale'],['export-quality','quality'],['export-optimize','optimizeSvg'],['export-smoothing','smoothing']])$(id).oninput=()=>{const el=$(id);state.exportSettings[key]=el.type==='checkbox'?el.checked:key==='format'?el.value:Number(el.value);queueExport();clearTimeout(recordTimer);recordTimer=setTimeout(record,350);};
 $('download-export').onclick=()=>{if(!exportBlob)return;download(exportBlob,outputFilename());toast('notice.download');};
 $('save-as').onclick=async()=>{if(!exportBlob)return;const blob=exportBlob,name=outputFilename();try{const format=state.exportSettings.format,mime={png:'image/png',jpg:'image/jpeg',svg:'image/svg+xml'}[format];const handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:t('export.typeDescription',{format:format.toUpperCase()}),accept:{[mime]:['.'+format]}}]});const stream=await handle.createWritable();await stream.write(blob);await stream.close();toast('notice.fileSaved');}catch(e){if(e.name!=='AbortError'){exportError=i18n.error('error.saveAs');$('export-error').textContent=i18n.errorMessage(exportError);}}};
}

function bind(){
 document.addEventListener('input',e=>{if(e.target.matches('[data-state],#project-name,#group-name,#group-x,#group-y,#group-gap,.pin-row input')){clearTimeout(recordTimer);setSaveState('status.editing');recordTimer=setTimeout(record,350);}});
 for(const kind of ['gpio','power','ground'])$('color-'+kind).onchange=()=>{state.palette[kind]=$('color-'+kind).value;record();};
 document.querySelectorAll('.tab').forEach(el=>el.onclick=()=>selectTab(el.dataset.tab));
 document.querySelectorAll('[data-state]').forEach(el=>{
  el.addEventListener('input',()=>{
   const key=el.dataset.state;let value=el.type==='checkbox'?el.checked:el.tagName==='SELECT'?el.value:el.valueAsNumber;if(typeof value==='number'&&!Number.isFinite(value))return;
   if(key==='width'||key==='height'){value=Math.round(clamp(value,200,8000));const other=key==='width'?state.height:state.width;if(value*other>32000000){toast('error.canvasPixelsShort');el.value=state[key];return;}}
   if(key==='imageX'||key==='imageY')value=clamp(value,-16000,16000);
   state[key]=value;
   $('image-scale-value').textContent=`${state.imageScale}%`;$('font-size-value').textContent=`${state.fontSize} px`;$('radius-value').textContent=`${state.radius}%`;
   if(key==='fontSize')state.groups.forEach(g=>delete g.font);
   if((key==='width'||key==='height')&&fitMode)fit();else schedule();
  });el.addEventListener('change',()=>{el.value=state[el.dataset.state];record();});
 });
 $('project-name').oninput=()=>{state.name=$('project-name').value.slice(0,100);};$('project-name').onchange=record;
 document.querySelectorAll('[data-bg]').forEach(el=>el.onclick=()=>{state.background=el.dataset.bg;syncUI();schedule();record();});
 $('upload-image').onclick=()=>$('image-file').click();$('image-file').onchange=async e=>{await loadUploaded(e.target.files[0]);e.target.value='';};
 $('crop-image').onclick=()=>crop().catch(e=>toast(e));$('center-image').onclick=()=>{const b=imageBounds();state.imageX=Math.round((state.width-b.w)/2);state.imageY=Math.round((state.height-b.h)/2);syncUI();schedule();record();};
 document.querySelectorAll('[data-rotation]').forEach(el=>el.onclick=()=>{const before=imageBounds();state.imageRotation=Number(el.dataset.rotation);const after=imageBounds();state.imageX=Math.round((before.x+(before.w-after.w)/2)*1e6)/1e6;state.imageY=Math.round((before.y+(before.h-after.h)/2)*1e6)/1e6;selection='image';syncUI();schedule();record();});
 $('load-example').onclick=()=>replaceState(initial()).then(()=>toast('notice.example')).catch(e=>toast(e));
 $('fit').onclick=fit;$('actual').onclick=()=>setZoom(1);$('zoom-in').onclick=()=>setZoom(zoom*1.25);$('zoom-out').onclick=()=>setZoom(zoom/1.25);
 $('paper-size').onchange=()=>{const v=$('paper-size').value;state.paper={format:v==='custom'?'custom':'a4',orientation:v==='landscape'?'landscape':'portrait',dpi:300};if(v!=='custom'){state.width=v==='portrait'?2480:3508;state.height=v==='portrait'?3508:2480;}syncUI();fit();record();};
 $('group-scale').oninput=()=>{state.groups[selectedGroup].scale=clamp($('group-scale').valueAsNumber/100,.1,5);syncTransformFields();schedule();};$('group-scale').onchange=record;
 for(const [id,fraction] of [['align-top',0],['align-center',.5],['align-bottom',1]])$(id).onclick=()=>{const target=$('align-target').value,b=target==='image'?imageBounds():target==='canvas'?{x:0,y:0,w:state.width,h:state.height}:groupBounds(state.groups[(selectedGroup+1)%state.groups.length]),g=state.groups[selectedGroup];g.start[1]=b.y+(b.h-groupBounds(g).h)*fraction;selection='group';syncTransformFields();schedule();record();};
 $('undo').onclick=()=>travel(-1);$('redo').onclick=()=>travel(1);
 $('group-name').oninput=()=>{state.groups[selectedGroup].connector=$('group-name').value;};$('group-name').onchange=()=>{syncGroups();record();};
 for(const [id,index] of [['group-x',0],['group-y',1]]){$(id).oninput=()=>{if(Number.isFinite($(id).valueAsNumber)){state.groups[selectedGroup].start[index]=clamp($(id).valueAsNumber,-16000,16000);schedule();}};$(id).onchange=record;}
 $('group-gap').oninput=()=>{if(Number.isFinite($('group-gap').valueAsNumber)){state.groups[selectedGroup].gap=clamp($('group-gap').valueAsNumber,1,2000);schedule();}};$('group-gap').onchange=record;
 $('add-group').onclick=()=>{if(state.groups.reduce((n,g)=>n+g.pins.length,0)>=1000)return toast('error.pinLimit');if(state.groups.length>=24){toast('error.groupLimit');return;}state.groups.push({connector:`H${state.groups.length+1}`,start:[100,100],gap:state.fontSize*2,pins:[{name:'IO1',color:colorFor('IO1')}]});selectedGroup=state.groups.length-1;syncGroups();schedule();record();};
 $('delete-group').onclick=()=>{if(state.groups.length===1)return;state.groups.splice(selectedGroup,1);selectedGroup=0;syncGroups();schedule();record();};
 $('add-pin').onclick=()=>{const g=state.groups[selectedGroup];if(state.groups.reduce((n,g)=>n+g.pins.length,0)>=1000)return toast('error.pinLimit');if(g.pins.length>=300)return toast('error.groupPinLimitShort');g.pins.push({name:'IO',color:colorFor('IO')});syncGroups();schedule();record();};
 $('reverse-pins').onclick=()=>{state.groups[selectedGroup].pins.reverse();syncGroups();schedule();record();};
 $('apply-batch').onclick=()=>{const names=$('batch-pins').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(names.length>300||names.some(n=>n.length>80))return toast('error.batchLimit');if(names.length+state.groups.filter((_,i)=>i!==selectedGroup).reduce((n,g)=>n+g.pins.length,0)>1000)return toast('error.pinLimit');const g=state.groups[selectedGroup],byName=new Map(g.pins.map(p=>[p.name,p]));g.pins=names.map(name=>byName.has(name)?{...byName.get(name)}:{name,color:colorFor(name)});syncGroups();schedule();record();toast('notice.batch');};
 $('auto-colors').onclick=()=>{state.groups.forEach(g=>g.pins.forEach(p=>p.color=colorFor(p.name)));syncGroups();schedule();record();};
 $('export-png').onclick=()=>openExport();$('export-base').onclick=()=>openExport(false);bindExport();
 $('save-project').onclick=()=>{download(new Blob([JSON.stringify({format:'openpinmap',version:2,state:snapshot()})],{type:'application/json'}),`${cleanName()}.openpinmap.json`);toast('notice.projectSaved');};
 $('import-project').onclick=()=>$('project-file').click();$('project-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{await replaceState(validateProject(await readJson(file)));toast('notice.projectRestored');}catch(error){toast(error);}e.target.value='';};
 $('export-config').onclick=()=>{const config={board_image:`${cleanName()}.png`,output:`${cleanName()}_PIN.png`,font:{file:'arial.ttf',size:state.fontSize},groups:state.groups.map(g=>({...clone(g),scale:undefined,gap:g.gap*(g.scale||1),font:{file:'arial.ttf',size:Math.round((g.font?.size||state.fontSize)*(g.scale||1))}})),openpinmap:{format:'openpinmap',version:2,state:snapshot()}};download(new Blob([JSON.stringify(config,null,2)],{type:'application/json'}),`${cleanName()}_pins.json`);toast('notice.configExported');};
 $('import-config').onclick=()=>$('config-file').click();$('config-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const cfg=await readJson(file);if(cfg.openpinmap){await replaceState(validateProject(cfg.openpinmap));toast('notice.configImported');return;}const groups=validateGroups(cfg.groups);if(!cfg.font||!Number.isFinite(cfg.font.size))throw i18n.error('error.fontSize');const next=snapshot();next.imageData=exportCanvas(false).toDataURL('image/png');next.imageX=0;next.imageY=0;next.imageScale=100;next.imageRotation=0;next.imageName=String(cfg.board_image||'product.png');next.fontSize=clamp(cfg.font.size,12,180);next.groups=groups;await replaceState(next);toast('notice.groupsImported',{count:groups.length});}catch(error){toast(error);}finally{e.target.value='';}};
 const vp=$('viewport');let dragDepth=0;vp.addEventListener('dragenter',e=>{e.preventDefault();dragDepth++;$('drop-overlay').classList.add('visible');});vp.addEventListener('dragover',e=>e.preventDefault());vp.addEventListener('dragleave',()=>{if(--dragDepth<=0)$('drop-overlay').classList.remove('visible');});vp.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('drop-overlay').classList.remove('visible');loadUploaded(e.dataTransfer.files[0]);});
 document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>e.preventDefault());
 bindCanvas();
 window.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select')||$('export-dialog').open)return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();travel(e.shiftKey?1:-1);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('save-project').click();}});
 window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persist();});
 new ResizeObserver(()=>{if(fitMode)fit();}).observe(vp);
}
async function start(){
 try{db=await openDb();const saved=await readSaved();let next=initial();if(saved){try{next=validateProject(saved);}catch{toast('notice.draftFailed');}}
 await replaceState(next,true);bind();fit();setSaveState(saved?'status.restored':'status.example');
 }catch(e){toast(e);}
}

function refreshLanguage(){
 i18n.apply();
 if(lastToast){const {message,values}=lastToast;$('toast').textContent=typeof message==='string'?t(message,values):i18n.errorMessage(message);}
 setSaveState(saveStateKey);
 if(!state)return;
 $('alpha-tag').textContent=t(hasTransparency?'status.alpha':'status.opaque');
 $('pin-list').querySelectorAll('.pin-row').forEach((row,i)=>{
  row.querySelector('input[type=color]').setAttribute('aria-label',t('pin.colorAria',{number:i+1}));
  row.querySelector('input[type=text]').setAttribute('aria-label',t('pin.nameAria',{number:i+1}));
  row.querySelector('button').setAttribute('aria-label',t('pin.deleteAria',{number:i+1}));
 });
 schedule();
 if($('export-dialog').open){$('export-title').textContent=t(exportLabels?'export.image':'export.base');queueExport();}
}
refreshLanguage();
$('language-select').onchange=event=>{i18n.setLanguage(event.target.value);refreshLanguage();};
start();
})();
