'use strict';
(() => {
// Quarter turns keep bounds, hit testing and SVG matrices exact.
const clean=v=>v===0?0:v;
function turn(angle){return({0:[1,0,0,1],90:[0,1,-1,0],180:[-1,0,0,-1],270:[0,-1,1,0]})[angle]||[1,0,0,1];}
function point(matrix,x,y){const[a,b,c,d,e,f]=matrix;return{x:clean(a*x+c*y+e),y:clean(b*x+d*y+f)};}
function bounds(matrix,w,h){const corners=[[0,0],[w,0],[0,h],[w,h]].map(([x,y])=>point(matrix,x,y)),xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);const x=Math.min(...xs),y=Math.min(...ys);return{x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};}
function labelSize(g,m){return g.labelRotation===90||g.labelRotation===270?{w:m.height,h:m.width}:{w:m.width,h:m.height};}
function labelMatrix(g,m,x,y){const[a,b,c,d]=turn(g.labelRotation),size=labelSize(g,m);return[a,b,c,d,clean(x+size.w/2-a*m.width/2-c*m.height/2),clean(y+size.h/2-b*m.width/2-d*m.height/2)];}
function groupSize(g,m){const label=labelSize(g,m),span=(Math.max(1,g.pins.length)-1)*g.gap;return{w:label.w+(g.layout==='horizontal'?span:0),h:label.h+(g.layout==='horizontal'?0:span)};}
function groupMatrix(g,m){const r=turn(g.rotation),s=g.scale||1,sx=s*(g.mirrorY?-1:1),sy=s*(g.mirrorX?-1:1),matrix=[clean(r[0]*sx),clean(r[1]*sx),clean(r[2]*sy),clean(r[3]*sy),0,0],size=groupSize(g,m),box=bounds(matrix,size.w,size.h);matrix[4]=g.start[0]-box.x;matrix[5]=g.start[1]-box.y;return matrix;}
function groupBounds(g,m){const size=groupSize(g,m);return bounds(groupMatrix(g,m),size.w,size.h);}
function horizontalAxis(g){return(g.layout==='horizontal')!==(g.rotation===90||g.rotation===270);}
function inversePoint(matrix,x,y){const[a,b,c,d,e,f]=matrix,det=a*d-b*c;return{x:clean((d*(x-e)-c*(y-f))/det),y:clean((-b*(x-e)+a*(y-f))/det)};}
globalThis.OpenPinMapGeometry=Object.freeze({point,bounds,labelSize,labelMatrix,groupSize,groupMatrix,groupBounds,horizontalAxis,inversePoint});
})();
