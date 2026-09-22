import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../src/model.js';
const {validateGroups,validateProject}=globalThis.OpenPinMapModel;
const source=JSON.parse(readFileSync(new URL('../examples/s31.json',import.meta.url)));
const project=()=>({format:'openpinmap',version:1,state:{...structuredClone(source),imageData:'data:image/webp;base64,UklGRg=='}});
test('S31 top-view order and electrical aliases remain intact',()=>{
 const g=validateGroups(source.groups);
 assert.equal(g.reduce((n,x)=>n+x.pins.length,0),42);
 assert.deepEqual(g[0].pins.map(p=>p.name),['GND',...Array.from({length:16},(_,i)=>`IO${i+2}`),'3.3V','IO18','5V','GND']);
 assert.deepEqual(g[1].pins.map(p=>p.name),['GND','IO58','IO59','IO60','IO45','IO44','IO43','IO42','IO40','IO39','IO38','IO37','IO36','IO35','IO21','IO20','IO24','IO25','IO23','IO22','GND']);
 assert.equal(g[1].pins[1]._net,'TX0');assert.equal(g[1].pins[16]._net,'SD_CLK');
 assert.deepEqual(source.groups.map(g=>g.pins.map(p=>p._pin)),[Array.from({length:21},(_,i)=>i+1),Array.from({length:21},(_,i)=>21-i)]);
});
test('project save/import preserves image, transparency, position and pin metadata',()=>{
 const p=project();p.state.palette.gpio='#123456';const s=validateProject(JSON.parse(JSON.stringify(p)));
 assert.equal(s.imageData,p.state.imageData);assert.equal(s.background,'transparent');assert.equal(s.imageX,source.imageX);assert.equal(s.groups[1].pins[1]._alias,'IO58 / TX0');assert.equal(s.palette.gpio,'#123456');
});
test('legacy Pins Studio projects are accepted',()=>{const p=project();p.format='pins-studio';delete p.state.palette;assert.equal(validateProject(p).palette.gpio,'#3498db');});
test('invalid import does not modify the supplied document',()=>{
 const p=project();p.state.groups[0].pins[0].color='red';const before=JSON.stringify(p);assert.throws(()=>validateProject(p),/#RRGGBB/);assert.equal(JSON.stringify(p),before);
});
test('reject null documents and unsupported versions or remote image URLs',()=>{
 for(const p of [null,{}, {...project(),version:99}, {...project(),format:'unknown'}])assert.throws(()=>validateProject(p));
 const p=project();p.state.imageData='https://example.com/image.png';assert.throws(()=>validateProject(p),/图片/);
});
test('reject malformed groups, non-finite coordinates and bad colors',()=>{
 for(const g of [null,{}, {pins:[],start:[NaN,0],gap:10}, {pins:[],start:[0,0],gap:0},{pins:[null],start:[0,0],gap:10},{pins:[{name:'IO1',color:'url(javascript:)'}],start:[0,0],gap:10}])assert.throws(()=>validateGroups([g]));
});
test('enforce group, pin and pixel budgets',()=>{
 const g={pins:[],start:[0,0],gap:10};assert.throws(()=>validateGroups(Array.from({length:25},()=>g)));
 assert.throws(()=>validateGroups([{...g,pins:Array.from({length:301},()=>({name:'IO',color:'#3498db'}))}]));
 const p=project();p.state.width=8000;p.state.height=8000;assert.throws(()=>validateProject(p),/3200/);
});
test('plain label text is retained without HTML interpretation',()=>{const g=structuredClone(source.groups);g[0].pins[0].name='<img src=x onerror=alert(1)>';assert.equal(validateGroups(g)[0].pins[0].name,'<img src=x onerror=alert(1)>');});

test('v2 A4, image and group transforms, export options survive JSON round-trip',()=>{
 const p=project();p.version=2;p.state.paper={format:'a4',orientation:'landscape',dpi:300};p.state.imageScale=321.25;p.state.imageRotation=270;p.state.imageX=91.5;p.state.groups[0].scale=1.75;p.state.groups[0].gap=183.25;p.state.groups[0].start=[120.25,342.75];p.state.exportSettings={format:'jpg',scale:.5,quality:63,optimizeSvg:false,smoothing:false};
 const s=validateProject(JSON.parse(JSON.stringify(p)));assert.deepEqual([s.width,s.height],[3508,2480]);assert.equal(s.imageScale,321.25);assert.equal(s.imageRotation,270);assert.equal(s.imageX,91.5);assert.equal(s.groups[0].scale,1.75);assert.deepEqual(s.groups[0].start,[120.25,342.75]);assert.equal(s.groups[0].gap,183.25);assert.deepEqual(s.exportSettings,p.state.exportSettings);
});
test('v1 projects keep custom dimensions and default group scale',()=>{const s=validateProject(project());assert.equal(s.paper.format,'custom');assert.equal(s.groups[0].scale,1);assert.deepEqual([s.width,s.height],[source.width,source.height]);});
test('P4 default is transparent A4 with unchanged 27 pins on each side',()=>{const s=JSON.parse(readFileSync(new URL('../examples/p4.json',import.meta.url)));assert.equal(s.paper.format,'a4');assert.deepEqual([s.width,s.height],[2480,3508]);assert.equal(s.background,'transparent');assert.deepEqual(s.groups.map(g=>g.pins.length),[27,27]);assert.equal(s.groups[0].pins[0].name,'IO16');assert.equal(s.groups[1].pins[26].name,'GND');assert.equal(s.groups[0].pins[23].name,'VO4');});

test('rotation accepts quarter turns and defaults older projects to zero',()=>{for(const angle of [0,90,180,270]){const p=project();p.state.imageRotation=angle;assert.equal(validateProject(p).imageRotation,angle);}const p=project();p.state.imageRotation=45;assert.equal(validateProject(p).imageRotation,0);});
