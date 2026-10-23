import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/geometry.js';
const {point,bounds,labelSize,labelMatrix,groupMatrix,groupBounds,horizontalAxis,inversePoint}=globalThis.OpenPinMapGeometry;
const metrics={width:120,height:40};
const group=(overrides={})=>({start:[200,300],gap:60,scale:1,layout:'horizontal',pins:[{},{},{}],...overrides});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('label quarter turns rotate the entire capsule into a positive bounding box',()=>{
 for(const angle of [0,90,180,270]){
  const g=group({labelRotation:angle}),size=labelSize(g,metrics),matrix=labelMatrix(g,metrics,70,90);
  assert.deepEqual(bounds(matrix,120,40),{x:70,y:90,...size});
  const origin=point(matrix,60,20);assert.deepEqual(origin,{x:70+size.w/2,y:90+size.h/2});
 }
 assert.deepEqual(point(labelMatrix(group({labelRotation:90}),metrics,0,0),0,0),{x:40,y:0});
});
test('X and Y axis mirrors reflect glyphs and label order on their respective local axes',()=>{
 const plain=groupMatrix(group(),metrics),flipX=groupMatrix(group({mirrorX:true}),metrics),flipY=groupMatrix(group({mirrorY:true}),metrics);
 assert.deepEqual(point(plain,0,0),{x:200,y:300});
 assert.deepEqual(point(flipX,0,0),{x:200,y:340});
 assert.deepEqual(point(flipY,0,0),{x:440,y:300});
 assert.deepEqual(point(flipY,240,40),{x:200,y:340});
});
test('mixed layout, label rotation, group rotation and mirrors preserve bounds and invert exactly',()=>{
 for(const layout of ['horizontal','vertical'])for(const labelRotation of [0,90,180,270])for(const rotation of [0,90,180,270])for(const mirrorX of [false,true])for(const mirrorY of [false,true]){
  const g=group({layout,labelRotation,rotation,mirrorX,mirrorY,scale:.7}),matrix=groupMatrix(g,metrics),box=groupBounds(g,metrics),label=labelSize(g,metrics),span=120;
  near(box.x,200);near(box.y,300);
  const width=label.w+(layout==='horizontal'?span:0),height=label.h+(layout==='vertical'?span:0),swap=rotation===90||rotation===270;
  near(box.w,(swap?height:width)*.7);near(box.h,(swap?width:height)*.7);
  assert.equal(horizontalAxis(g),(layout==='horizontal')!==swap);
  for(const [x,y] of [[0,0],[width,0],[0,height],[width,height],[17,23]]){
   const world=point(matrix,x,y),local=inversePoint(matrix,world.x,world.y);near(local.x,x);near(local.y,y);
   assert.ok(world.x>=box.x-1e-8&&world.x<=box.x+box.w+1e-8&&world.y>=box.y-1e-8&&world.y<=box.y+box.h+1e-8);
  }
 }
});
test('empty and single-pin groups keep one finite label extent',()=>{
 for(const pins of [[],[{}]])assert.deepEqual(groupBounds(group({pins,labelRotation:90,rotation:90,mirrorX:true}),metrics),{x:200,y:300,w:120,h:40});
});
