'use strict';
(() => {
function localizedError(key,fallback){const value=new Error(globalThis.OpenPinMapI18n?globalThis.OpenPinMapI18n.t(key):fallback);value.i18nKey=key;return value;}
const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
const validColor = (v,fallback) => typeof v==='string'&&/^#[\da-f]{6}$/i.test(v)?v:fallback;
function validNumber(v,min,max,fallback){return typeof v==='number'&&Number.isFinite(v)?clamp(v,min,max):fallback;}
function validateGroups(groups){
 if(!Array.isArray(groups)||groups.length<1||groups.length>24)throw localizedError('error.groups','配置需要包含 1–24 个引脚分组。');
 let total=0;
 return groups.map((g,i)=>{
  if(!g||!Array.isArray(g.pins)||g.pins.length>300)throw localizedError('error.groupPinLimit','每组最多支持 300 个引脚。');
  total+=g.pins.length;if(total>1000)throw localizedError('error.pinLimit','最多支持 1000 个引脚。');
  if(!Array.isArray(g.start)||g.start.length!==2||g.start.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw localizedError('error.groupStart','分组 start 必须是两个数字坐标。');
  if(typeof g.gap!=='number'||!Number.isFinite(g.gap)||g.gap<1||g.gap>2000)throw localizedError('error.pinGap','针脚间距必须在 1–2000 px 之间。');
  return {connector:String(g.connector||`H${i+1}`).slice(0,32),start:g.start.map(v=>clamp(v,-16000,16000)),gap:g.gap,scale:validNumber(g.scale,.1,5,1),pins:g.pins.map(p=>{
   if(!p||typeof p.name!=='string'||p.name.length>80)throw localizedError('error.pinName','引脚名称必须是 80 字符以内的文本。');
   if(typeof p.color!=='string'||!/^#[\da-f]{6}$/i.test(p.color))throw localizedError('error.color','颜色需使用 #RRGGBB 格式。');
   return {...p,name:p.name,color:p.color};
  }),...(g.font&&Number.isFinite(g.font.size)?{font:{file:String(g.font.file||'Arial'),size:clamp(g.font.size,12,180)}}:{})};
 });
}
function validateProject(raw){
 if(!raw||!['openpinmap','pins-studio'].includes(raw.format)||![1,2].includes(raw.version)||!raw.state)throw localizedError('error.projectFormat','这不是 OpenPinMap 项目文件，请使用“导入 pins_pic_gen JSON”导入生成器配置。');
 const s=raw.state;
 if(typeof s.imageData!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(s.imageData))throw localizedError('error.projectImage','项目缺少有效的内嵌图片。');
 const groups=validateGroups(s.groups),paper={format:s.paper?.format==='a4'?'a4':'custom',orientation:s.paper?.orientation==='landscape'?'landscape':'portrait',dpi:300};
 const width=paper.format==='a4'?(paper.orientation==='portrait'?2480:3508):validNumber(s.width,200,8000,2480),height=paper.format==='a4'?(paper.orientation==='portrait'?3508:2480):validNumber(s.height,200,8000,3508);
 if(width*height>32000000)throw localizedError('error.canvasPixels','画布上限为 3200 万像素，请减小尺寸。');
 return {paper,exportSettings:{format:['png','jpg','svg'].includes(s.exportSettings?.format)?s.exportSettings.format:'png',scale:validNumber(s.exportSettings?.scale,.1,2,1),quality:validNumber(s.exportSettings?.quality,10,100,90),optimizeSvg:s.exportSettings?.optimizeSvg!==false,smoothing:s.exportSettings?.smoothing!==false},name:String(s.name||'pinout').slice(0,100),width:Math.round(width),height:Math.round(height),background:['transparent','white','dark'].includes(s.background)?s.background:'transparent',fontSize:validNumber(s.fontSize,12,180,70),fontFamily:['Arial','sans-serif','monospace'].includes(s.fontFamily)?s.fontFamily:'Arial',radius:validNumber(s.radius,0,100,100),guides:!!s.guides,imageX:validNumber(s.imageX,-16000,16000,0),imageY:validNumber(s.imageY,-16000,16000,0),imageScale:validNumber(s.imageScale,1,500,100),imageRotation:[0,90,180,270].includes(s.imageRotation)?s.imageRotation:0,imageName:String(s.imageName||'product.png').slice(0,180),imageData:s.imageData,palette:{gpio:validColor(s.palette?.gpio,'#3498db'),power:validColor(s.palette?.power,'#e74c3c'),ground:validColor(s.palette?.ground,'#2ecc71')},groups};
}
globalThis.OpenPinMapModel = Object.freeze({clamp,validNumber,validColor,validateGroups,validateProject});
})();
