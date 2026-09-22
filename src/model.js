'use strict';
(() => {
const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
const validColor = (v,fallback) => typeof v==='string'&&/^#[\da-f]{6}$/i.test(v)?v:fallback;
function validNumber(v,min,max,fallback){return typeof v==='number'&&Number.isFinite(v)?clamp(v,min,max):fallback;}
function validateGroups(groups){
 if(!Array.isArray(groups)||groups.length<1||groups.length>24)throw new Error('配置需要包含 1–24 个引脚分组。');
 let total=0;
 return groups.map((g,i)=>{
  if(!g||!Array.isArray(g.pins)||g.pins.length>300)throw new Error('每组最多支持 300 个引脚。');
  total+=g.pins.length;if(total>1000)throw new Error('最多支持 1000 个引脚。');
  if(!Array.isArray(g.start)||g.start.length!==2||g.start.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw new Error('分组 start 必须是两个数字坐标。');
  if(typeof g.gap!=='number'||!Number.isFinite(g.gap)||g.gap<1||g.gap>2000)throw new Error('针脚间距必须在 1–2000 px 之间。');
  return {connector:String(g.connector||`H${i+1}`).slice(0,32),start:g.start.map(v=>clamp(v,-16000,16000)),gap:g.gap,pins:g.pins.map(p=>{
   if(!p||typeof p.name!=='string'||p.name.length>80)throw new Error('引脚名称必须是 80 字符以内的文本。');
   if(typeof p.color!=='string'||!/^#[\da-f]{6}$/i.test(p.color))throw new Error('颜色需使用 #RRGGBB 格式。');
   return {...p,name:p.name,color:p.color};
  }),...(g.font&&Number.isFinite(g.font.size)?{font:{file:String(g.font.file||'Arial'),size:clamp(g.font.size,12,180)}}:{})};
 });
}
function validateProject(raw){
 if(!raw||!['openpinmap','pins-studio'].includes(raw.format)||raw.version!==1||!raw.state)throw new Error('这不是 OpenPinMap 项目文件，请使用“导入 pins_pic_gen JSON”导入生成器配置。');
 const s=raw.state;
 if(typeof s.imageData!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(s.imageData))throw new Error('项目缺少有效的内嵌图片。');
 const groups=validateGroups(s.groups),width=validNumber(s.width,200,8000,3376),height=validNumber(s.height,200,8000,5000);
 if(width*height>32000000)throw new Error('画布上限为 3200 万像素，请减小尺寸。');
 return {name:String(s.name||'pinout').slice(0,100),width:Math.round(width),height:Math.round(height),background:['transparent','white','dark'].includes(s.background)?s.background:'transparent',fontSize:validNumber(s.fontSize,12,180,70),fontFamily:['Arial','sans-serif','monospace'].includes(s.fontFamily)?s.fontFamily:'Arial',radius:validNumber(s.radius,0,100,100),guides:!!s.guides,imageX:validNumber(s.imageX,-16000,16000,0),imageY:validNumber(s.imageY,-16000,16000,0),imageScale:validNumber(s.imageScale,5,250,100),imageName:String(s.imageName||'product.png').slice(0,180),imageData:s.imageData,palette:{gpio:validColor(s.palette?.gpio,'#3498db'),power:validColor(s.palette?.power,'#e74c3c'),ground:validColor(s.palette?.ground,'#2ecc71')},groups};
}
globalThis.OpenPinMapModel = Object.freeze({clamp,validNumber,validColor,validateGroups,validateProject});
})();
