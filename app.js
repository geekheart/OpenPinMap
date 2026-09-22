'use strict';
(() => {
const $ = id => document.getElementById(id);
const clone = value => JSON.parse(JSON.stringify(value));
const clamp = (v,min,max) => Math.max(min, Math.min(max,v));
const metricCanvas = document.createElement('canvas'), metric = metricCanvas.getContext('2d');
let state, sourceImage, zoom = .12, fitMode = true, selectedGroup = 0, tab = 'material';
let history = [], historyIndex = -1, frame, saveTimer, recordTimer, db, importTicket = 0;
let hits = [], dragging = null, toastTimer;
const initial = () => ({...clone(window.PIN_DEFAULTS), imageData:window.PIN_DEFAULT_IMAGE});
function snapshot(){const {imageData,...rest}=state;return {...clone(rest),imageData};}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4000);}
function colorFor(name){if(/^(GND|GROUND|VSS)$/i.test(name.trim()))return $('color-ground').value;if(/^(\+?(\d+(\.\d+)?V\d*|V\d+)|VCC|VIN|VBUS|BAT|VOUT|VO\d+)$/i.test(name.trim()))return $('color-power').value;return $('color-gpio').value;}
function cleanName(){return (state.name||'pinout').replace(/[\\/:*?"<>|\x00-\x1F]/g,'_');}
function loadImage(data){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('图片无法读取，请选择 PNG、JPEG 或 WebP。'));img.src=data;});}
const {validateGroups,validateProject} = window.OpenPinMapModel;
async function replaceState(next,resetHistory=false){
 const ticket=++importTicket, img=state?.imageData===next.imageData?sourceImage:await loadImage(next.imageData);
 if(ticket!==importTicket)return;
 if(img.width*img.height>50000000)throw new Error('素材超过 5000 万像素，请先缩小图片。');
 state=next;sourceImage=img;selectedGroup=clamp(selectedGroup,0,state.groups.length-1);syncUI();if(resetHistory){history=[];historyIndex=-1;}record();fit();
}
function groupMetrics(g){
 const fs=g.font?.size||state.fontSize;metric.font=`${fs}px ${state.fontFamily}`;
 let maxWidth=0,maxHeight=0;
 for(const p of g.pins){const m=metric.measureText(p.name||' ');maxWidth=Math.max(maxWidth,m.width);maxHeight=Math.max(maxHeight,(m.actualBoundingBoxAscent||fs*.75)+(m.actualBoundingBoxDescent||0));}
 return {width:Math.ceil(maxWidth)+state.fontSize*2,height:Math.ceil(maxHeight||fs*.75)+Math.floor(state.fontSize*.4)*2,fontSize:fs};
}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function drawContent(ctx,{labels=true,selection=false}={}){
 if(state.background!=='transparent'){ctx.fillStyle=state.background==='dark'?'#202c25':'#ffffff';ctx.fillRect(0,0,state.width,state.height);}
 const iw=sourceImage.width*state.imageScale/100,ih=sourceImage.height*state.imageScale/100;
 ctx.drawImage(sourceImage,state.imageX,state.imageY,iw,ih);
 const nextHits=[];
 if(labels)state.groups.forEach((g,gi)=>{
  const m=groupMetrics(g);ctx.font=`${m.fontSize}px ${state.fontFamily}`;
  g.pins.forEach((pin,i)=>{
   const x=g.start[0],y=g.start[1]+i*g.gap;
   if(state.guides){const left=x+m.width<=state.imageX+iw/2,edge=left?state.imageX:state.imageX+iw;ctx.strokeStyle=pin.color;ctx.lineWidth=Math.max(2,state.fontSize*.04);ctx.beginPath();ctx.moveTo(left?x+m.width:x,y+m.height/2);ctx.lineTo(edge,y+m.height/2);ctx.stroke();}
   ctx.fillStyle=pin.color;roundRect(ctx,x,y,m.width,m.height,m.height/2*state.radius/100);
   const tm=ctx.measureText(pin.name);const asc=tm.actualBoundingBoxAscent||m.fontSize*.75,des=tm.actualBoundingBoxDescent||0;
   ctx.fillStyle='#ffffff';ctx.textAlign='left';ctx.fillText(pin.name,x+(m.width-tm.width)/2,y+(m.height+asc-des)/2);
   nextHits.push({x,y,w:m.width,h:m.height,group:gi});
  });
  if(selection&&tab==='pins'&&gi===selectedGroup&&g.pins.length){ctx.strokeStyle='#168155';ctx.lineWidth=2/zoom;ctx.setLineDash([5/zoom,4/zoom]);ctx.strokeRect(g.start[0]-7/zoom,g.start[1]-7/zoom,m.width+14/zoom,(g.pins.length-1)*g.gap+m.height+14/zoom);ctx.setLineDash([]);}
 });
 return nextHits;
}
function render(){
 frame=null;if(!sourceImage)return;
 const cvs=$('preview'),ratio=Math.min(1,zoom*(window.devicePixelRatio||1),2400/Math.max(state.width,state.height));
 cvs.width=Math.max(1,Math.round(state.width*ratio));cvs.height=Math.max(1,Math.round(state.height*ratio));
 cvs.style.width=`${state.width*zoom}px`;cvs.style.height=`${state.height*zoom}px`;
 $('canvas-wrap').style.width=cvs.style.width;$('canvas-wrap').style.height=cvs.style.height;
 const ctx=cvs.getContext('2d');ctx.scale(ratio,ratio);hits=drawContent(ctx,{selection:true});
 $('canvas-wrap').classList.toggle('checker',state.background==='transparent');
 $('pin-total').textContent=`${state.groups.reduce((n,g)=>n+g.pins.length,0)} 个引脚`;$('output-size').textContent=`${state.width} × ${state.height} px`;
 $('preview-background').textContent={transparent:'透明画布',white:'白色画布',dark:'深色画布'}[state.background];
 $('zoom-value').textContent=`${Math.round(zoom*100)}%`;
}
function schedule(){if(!frame)frame=requestAnimationFrame(render);}
function fit(){if(!state)return;fitMode=true;const vp=$('viewport');zoom=clamp(Math.min((vp.clientWidth-76)/state.width,(vp.clientHeight-76)/state.height),.025,2);schedule();}
function setZoom(value){fitMode=false;zoom=clamp(value,.025,2);schedule();}
function record(){
 clearTimeout(recordTimer);
 if(historyIndex>=0){const before=history[historyIndex],current=snapshot();if(before.imageData===current.imageData&&JSON.stringify({...before,imageData:null})===JSON.stringify({...current,imageData:null})){persist();return;}}
 history=history.slice(0,historyIndex+1);history.push(snapshot());if(history.length>30)history.shift();historyIndex=history.length-1;updateHistory();persist();
}
function updateHistory(){$('undo').disabled=historyIndex<=0;$('redo').disabled=historyIndex>=history.length-1;}
async function travel(delta){
 record();
 const ix=historyIndex+delta;if(ix<0||ix>=history.length)return;
 const next=history[ix];try{const img=state.imageData===next.imageData?sourceImage:await loadImage(next.imageData);historyIndex=ix;state={...clone({...next,imageData:undefined}),imageData:next.imageData};sourceImage=img;selectedGroup=clamp(selectedGroup,0,state.groups.length-1);syncUI();updateHistory();if(fitMode)fit();else schedule();persist();}catch(e){toast(e.message);}
}
function openDb(){return new Promise(resolve=>{try{const req=indexedDB.open('openpinmap',1);req.onupgradeneeded=()=>req.result.createObjectStore('projects');req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);}catch{resolve(null);}});}
function readSaved(){return new Promise(resolve=>{if(!db)return resolve(null);try{const req=db.transaction('projects').objectStore('projects').get('latest');req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);}catch{resolve(null);}});}
function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(!db){$('save-state').textContent='请保存项目以保留修改';return;}try{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put({format:'openpinmap',version:1,state:snapshot()},'latest');tx.oncomplete=()=>$('save-state').textContent='已在本机自动保存';tx.onerror=()=>$('save-state').textContent='自动保存失败，请保存项目';}catch{$('save-state').textContent='请保存项目以保留修改';}},700);}
function syncUI(){
 for(const kind of ['gpio','power','ground'])$('color-'+kind).value=state.palette[kind];
 $('project-name').value=state.name;
 document.querySelectorAll('[data-state]').forEach(el=>{const value=state[el.dataset.state];if(el.type==='checkbox')el.checked=value;else el.value=value;});
 $('image-scale-value').textContent=`${state.imageScale}%`;$('font-size-value').textContent=`${state.fontSize} px`;$('radius-value').textContent=`${state.radius}%`;
 document.querySelectorAll('[data-bg]').forEach(el=>el.classList.toggle('selected',el.dataset.bg===state.background));
 $('source-thumbnail').src=state.imageData;$('source-name').textContent=state.imageName;
 const a=document.createElement('canvas');a.width=64;a.height=64;const ctx=a.getContext('2d',{willReadFrequently:true});ctx.drawImage(sourceImage,0,0,64,64);const bytes=ctx.getImageData(0,0,64,64).data;let transparent=false;for(let i=3;i<bytes.length;i+=4)if(bytes[i]<250){transparent=true;break;}
 $('alpha-tag').textContent=transparent?'透明通道已保留':'不透明图片';
 syncGroups();
}
function syncGroups(){
 const tabs=$('group-tabs');tabs.replaceChildren();state.groups.forEach((g,i)=>{const b=document.createElement('button');b.textContent=g.connector||`H${i+1}`;b.className=i===selectedGroup?'active':'';b.onclick=()=>{selectedGroup=i;syncGroups();schedule();};tabs.append(b);});
 const g=state.groups[selectedGroup];$('group-name').value=g.connector;$('group-x').value=Math.round(g.start[0]*10)/10;$('group-y').value=Math.round(g.start[1]*10)/10;$('group-gap').value=Math.round(g.gap*100)/100;$('delete-group').disabled=state.groups.length<=1;
 const list=$('pin-list');list.replaceChildren();g.pins.forEach((pin,i)=>{
  const row=document.createElement('div');row.className='pin-row';const n=document.createElement('span');n.className='pin-number';n.textContent=String(i+1).padStart(2,'0');
  const color=document.createElement('input');color.type='color';color.value=pin.color;color.setAttribute('aria-label',`第 ${i+1} 针颜色`);color.oninput=()=>{pin.color=color.value;schedule();};color.onchange=record;
  const name=document.createElement('input');name.type='text';name.value=pin.name;name.maxLength=80;name.setAttribute('aria-label',`第 ${i+1} 针名称`);name.oninput=()=>{pin.name=name.value;schedule();};name.onchange=()=>{record();$('batch-pins').value=g.pins.map(p=>p.name).join('\n');};
  const remove=document.createElement('button');remove.className='remove-pin';remove.textContent='×';remove.setAttribute('aria-label',`删除第 ${i+1} 针`);remove.onclick=()=>{g.pins.splice(i,1);syncGroups();schedule();record();};row.append(n,color,name,remove);list.append(row);
 });$('batch-pins').value=g.pins.map(p=>p.name).join('\n');
}
function selectTab(value){tab=value;document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('active',el.dataset.tab===value));document.querySelectorAll('.panel').forEach(el=>el.classList.toggle('active',el.id===`panel-${value}`));schedule();}
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function exportCanvas(labels){const canvas=document.createElement('canvas');canvas.width=state.width;canvas.height=state.height;drawContent(canvas.getContext('2d'),{labels});return canvas;}
function exportPng(labels=true){
 const outside=state.groups.some(g=>{const m=groupMetrics(g);return g.pins.length&&(g.start[0]<0||g.start[0]+m.width>state.width||g.start[1]<0||g.start[1]+(g.pins.length-1)*g.gap+m.height>state.height);});
 if(labels&&outside){toast('部分标签超出画布，请先调整坐标或扩大画布再导出。');return;}
 try{const canvas=exportCanvas(labels);canvas.toBlob(blob=>{if(!blob){toast('图片导出失败，请减小画布尺寸。');return;}download(blob,`${cleanName()}${labels?'_PIN':''}.png`);toast(labels?'PNG 已导出。':'底图已导出。');canvas.width=1;canvas.height=1;},'image/png');}catch(e){toast(e.message);}
}
async function readJson(file){if(file.size>40000000)throw new Error('项目文件过大，上限为 40 MB。');try{return JSON.parse(await file.text());}catch{throw new Error('JSON 格式无效，请检查文件内容。');}}
async function loadUploaded(file){
 if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type)){toast('请选择 PNG、JPEG 或 WebP 图片。');return;}
 if(file.size>25000000){toast('图片上限为 25 MB，请先缩小文件。');return;}
 try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('文件读取失败。'));reader.readAsDataURL(file);});const img=await loadImage(data);if(img.width*img.height>50000000)throw new Error('图片超过 5000 万像素，请先缩小文件。');state.imageData=data;state.imageName=file.name;sourceImage=img;state.imageScale=clamp(Math.min(state.width*.54/img.width,state.height*.72/img.height)*100,5,250);state.imageX=Math.round((state.width-img.width*state.imageScale/100)/2);state.imageY=Math.round((state.height-img.height*state.imageScale/100)/2);syncUI();schedule();record();toast('素材已替换。');}catch(e){toast(e.message);}
}
async function crop(){
 const c=document.createElement('canvas');c.width=sourceImage.width;c.height=sourceImage.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(sourceImage,0,0);const a=ctx.getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=-1,y1=-1;
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){if(a[(y*c.width+x)*4+3]>8){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}}
 if(x1<0){toast('图片完全透明，没有可裁剪的内容。');return;}if(x0===0&&y0===0&&x1===c.width-1&&y1===c.height-1){toast('素材已经没有透明外边距。');return;}
 const out=document.createElement('canvas');out.width=x1-x0+1;out.height=y1-y0+1;out.getContext('2d').drawImage(c,x0,y0,out.width,out.height,0,0,out.width,out.height);state.imageX+=x0*state.imageScale/100;state.imageY+=y0*state.imageScale/100;state.imageData=out.toDataURL('image/png');sourceImage=await loadImage(state.imageData);syncUI();schedule();record();toast('已裁去透明边缘。');
}
function bind(){
 document.addEventListener('input',e=>{if(e.target.matches('[data-state],#project-name,#group-name,#group-x,#group-y,#group-gap,.pin-row input')){clearTimeout(recordTimer);$('save-state').textContent='编辑中…';recordTimer=setTimeout(record,350);}});
 for(const kind of ['gpio','power','ground'])$('color-'+kind).onchange=()=>{state.palette[kind]=$('color-'+kind).value;record();};
 document.querySelectorAll('.tab').forEach(el=>el.onclick=()=>selectTab(el.dataset.tab));
 document.querySelectorAll('[data-state]').forEach(el=>{
  el.addEventListener('input',()=>{
   const key=el.dataset.state;let value=el.type==='checkbox'?el.checked:el.tagName==='SELECT'?el.value:el.valueAsNumber;if(typeof value==='number'&&!Number.isFinite(value))return;
   if(key==='width'||key==='height'){value=Math.round(clamp(value,200,8000));const other=key==='width'?state.height:state.width;if(value*other>32000000){toast('画布上限为 3200 万像素。');el.value=state[key];return;}}
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
 $('crop-image').onclick=()=>crop().catch(e=>toast(e.message));$('center-image').onclick=()=>{state.imageX=Math.round((state.width-sourceImage.width*state.imageScale/100)/2);state.imageY=Math.round((state.height-sourceImage.height*state.imageScale/100)/2);syncUI();schedule();record();};
 $('load-example').onclick=()=>replaceState(initial()).then(()=>toast('已载入 S31 示例。')).catch(e=>toast(e.message));
 $('fit').onclick=fit;$('actual').onclick=()=>setZoom(1);$('zoom-in').onclick=()=>setZoom(zoom*1.25);$('zoom-out').onclick=()=>setZoom(zoom/1.25);
 $('undo').onclick=()=>travel(-1);$('redo').onclick=()=>travel(1);
 $('group-name').oninput=()=>{state.groups[selectedGroup].connector=$('group-name').value;};$('group-name').onchange=()=>{syncGroups();record();};
 for(const [id,index] of [['group-x',0],['group-y',1]]){$(id).oninput=()=>{if(Number.isFinite($(id).valueAsNumber)){state.groups[selectedGroup].start[index]=clamp($(id).valueAsNumber,-16000,16000);schedule();}};$(id).onchange=record;}
 $('group-gap').oninput=()=>{if(Number.isFinite($('group-gap').valueAsNumber)){state.groups[selectedGroup].gap=clamp($('group-gap').valueAsNumber,1,2000);schedule();}};$('group-gap').onchange=record;
 $('add-group').onclick=()=>{if(state.groups.reduce((n,g)=>n+g.pins.length,0)>=1000)return toast('最多支持 1000 个引脚。');if(state.groups.length>=24){toast('最多支持 24 个分组。');return;}state.groups.push({connector:`H${state.groups.length+1}`,start:[100,100],gap:state.fontSize*2,pins:[{name:'IO1',color:colorFor('IO1')}]});selectedGroup=state.groups.length-1;syncGroups();schedule();record();};
 $('delete-group').onclick=()=>{if(state.groups.length===1)return;state.groups.splice(selectedGroup,1);selectedGroup=0;syncGroups();schedule();record();};
 $('add-pin').onclick=()=>{const g=state.groups[selectedGroup];if(state.groups.reduce((n,g)=>n+g.pins.length,0)>=1000)return toast('最多支持 1000 个引脚。');if(g.pins.length>=300)return toast('每组最多 300 个引脚。');g.pins.push({name:'IO',color:colorFor('IO')});syncGroups();schedule();record();};
 $('reverse-pins').onclick=()=>{state.groups[selectedGroup].pins.reverse();syncGroups();schedule();record();};
 $('apply-batch').onclick=()=>{const names=$('batch-pins').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(names.length>300||names.some(n=>n.length>80))return toast('最多 300 行，每个名称不超过 80 字符。');if(names.length+state.groups.filter((_,i)=>i!==selectedGroup).reduce((n,g)=>n+g.pins.length,0)>1000)return toast('最多支持 1000 个引脚。');const g=state.groups[selectedGroup],byName=new Map(g.pins.map(p=>[p.name,p]));g.pins=names.map(name=>byName.has(name)?{...byName.get(name)}:{name,color:colorFor(name)});syncGroups();schedule();record();toast('已应用批量名称。');};
 $('auto-colors').onclick=()=>{state.groups.forEach(g=>g.pins.forEach(p=>p.color=colorFor(p.name)));syncGroups();schedule();record();};
 $('export-png').onclick=()=>exportPng();$('export-base').onclick=()=>exportPng(false);
 $('save-project').onclick=()=>{download(new Blob([JSON.stringify({format:'openpinmap',version:1,state:snapshot()})],{type:'application/json'}),`${cleanName()}.openpinmap.json`);toast('项目已保存。');};
 $('import-project').onclick=()=>$('project-file').click();$('project-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{await replaceState(validateProject(await readJson(file)));toast('项目已恢复。');}catch(error){toast(error.message);}e.target.value='';};
 $('export-config').onclick=()=>{const config={board_image:`${cleanName()}.png`,output:`${cleanName()}_PIN.png`,font:{file:'arial.ttf',size:state.fontSize},groups:clone(state.groups)};download(new Blob([JSON.stringify(config,null,2)],{type:'application/json'}),`${cleanName()}_pins.json`);toast('配置已导出。');};
 $('import-config').onclick=()=>$('config-file').click();$('config-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const cfg=await readJson(file),groups=validateGroups(cfg.groups);if(!cfg.font||!Number.isFinite(cfg.font.size))throw new Error('配置缺少 font.size。');const next=snapshot();next.imageData=exportCanvas(false).toDataURL('image/png');next.imageX=0;next.imageY=0;next.imageScale=100;next.imageName=String(cfg.board_image||'product.png');next.fontSize=clamp(cfg.font.size,12,180);next.groups=groups;await replaceState(next);toast(`已导入 ${groups.length} 组。当前素材保留为底图，请核对图片与坐标。`);}catch(error){toast(error.message);}e.target.value='';};
 const vp=$('viewport');let dragDepth=0;vp.addEventListener('dragenter',e=>{e.preventDefault();dragDepth++;$('drop-overlay').classList.add('visible');});vp.addEventListener('dragover',e=>e.preventDefault());vp.addEventListener('dragleave',()=>{if(--dragDepth<=0)$('drop-overlay').classList.remove('visible');});vp.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('drop-overlay').classList.remove('visible');loadUploaded(e.dataTransfer.files[0]);});
 document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>e.preventDefault());
 const cvs=$('preview');const point=e=>{const r=cvs.getBoundingClientRect();return{x:(e.clientX-r.left)/zoom,y:(e.clientY-r.top)/zoom};};
 cvs.onpointerdown=e=>{if(e.button!==0)return;const p=point(e);const h=[...hits].reverse().find(h=>p.x>=h.x&&p.x<=h.x+h.w&&p.y>=h.y&&p.y<=h.y+h.h);if(h){selectedGroup=h.group;syncGroups();selectTab('pins');dragging={type:'group',x:p.x,y:p.y,ox:state.groups[h.group].start[0],oy:state.groups[h.group].start[1]};}else{const w=sourceImage.width*state.imageScale/100,h=sourceImage.height*state.imageScale/100;if(p.x<state.imageX||p.x>state.imageX+w||p.y<state.imageY||p.y>state.imageY+h)return;dragging={type:'image',x:p.x,y:p.y,ox:state.imageX,oy:state.imageY};}cvs.setPointerCapture(e.pointerId);cvs.style.cursor='grabbing';};
 cvs.onpointermove=e=>{if(!dragging)return;const p=point(e),x=Math.round(dragging.ox+p.x-dragging.x),y=Math.round(dragging.oy+p.y-dragging.y);if(dragging.type==='group'){state.groups[selectedGroup].start=[x,y];$('group-x').value=x;$('group-y').value=y;}else{state.imageX=x;state.imageY=y;$('image-x').value=x;$('image-y').value=y;}schedule();};
 const endDrag=()=>{if(dragging){dragging=null;cvs.style.cursor='default';record();}};cvs.onpointerup=endDrag;cvs.onpointercancel=endDrag;
 window.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();travel(e.shiftKey?1:-1);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('save-project').click();}});
 new ResizeObserver(()=>{if(fitMode)fit();}).observe(vp);
}
async function start(){
 try{db=await openDb();const saved=await readSaved();let next=initial();if(saved){try{next=validateProject(saved);}catch{toast('上次的本机草稿无法读取，已载入示例。');}}
 await replaceState(next,true);bind();fit();$('save-state').textContent=saved?'已恢复本机草稿':'已载入 S31 示例';
 }catch(e){toast(e.message);}
}
start();
})();
