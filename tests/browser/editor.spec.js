import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
async function ready(page){await page.goto('./');await expect(page.locator('#source-thumbnail')).toHaveAttribute('src',/^data:image/);await expect.poll(()=>page.locator('#preview').evaluate(c=>c.width)).toBeGreaterThan(1);await expect(page.locator('#save-state')).toHaveText('已在本机自动保存');}
test('edit, undo/redo and restore complete project',async({page},testInfo)=>{
 await ready(page);await page.getByRole('button',{name:'引脚配置',exact:true}).click();
 const input=page.getByRole('textbox',{name:'第 2 针名称',exact:true});await input.fill('IO2_TEST');await input.press('Tab');
 await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeEnabled();await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(input).toHaveValue('IO17');
 await page.getByRole('button',{name:'重做',exact:true}).click();await expect(input).toHaveValue('IO2_TEST');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目',exact:true}).click();const download=await downloadPromise;const file=testInfo.outputPath('saved.openpinmap.json');await download.saveAs(file);
 const saved=JSON.parse(await readFile(file,'utf8'));expect(saved.format).toBe('openpinmap');expect(saved.state.groups[0].pins[1].name).toBe('IO2_TEST');
 await input.fill('TEMP');await input.press('Tab');await page.locator('#project-file').setInputFiles(file);await expect(page.locator('#toast')).toHaveText('项目已恢复。');await expect(input).toHaveValue('IO2_TEST');
});
test('PNG export retains alpha and full output dimensions',async({page},testInfo)=>{
 await ready(page);await page.screenshot({path:testInfo.outputPath('overview.png')});await page.getByRole('button',{name:'↓ 导出图片',exact:true}).click();await expect(page.getByRole('dialog',{name:'导出图片'})).toBeVisible();await expect(page.locator('#download-export')).toBeEnabled();const pending=page.waitForEvent('download');await page.locator('#download-export').click();const download=await pending;const file=testInfo.outputPath('transparent.png');await download.saveAs(file);
 const png=await readFile(file);const data='data:image/png;base64,'+png.toString('base64');
 const pixels=await page.evaluate(async data=>{const img=new Image();img.src=data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);return{w:img.width,h:img.height,alpha:x.getImageData(0,0,1,1).data[3],boardAlpha:x.getImageData(1240,1754,1,1).data[3]};},data);
 expect(pixels).toEqual({w:2480,h:3508,alpha:0,boardAlpha:255});
});
test('upload transparent source, import generator config, reject invalid JSON safely',async({page},testInfo)=>{
 await ready(page);await page.locator('#image-file').setInputFiles(path.join(root,'assets/s31.webp'));await expect(page.locator('#toast')).toHaveText('素材已替换。');await expect(page.locator('#alpha-tag')).toHaveText('透明通道已保留');
 await page.getByRole('button',{name:'引脚配置',exact:true}).click();const cfg={board_image:'s31.webp',font:{file:'arial.ttf',size:70},groups:[{connector:'TEST',start:[50,100],gap:150,pins:[{name:'GND',color:'#2ecc71'},{name:'IO1',color:'#3498db'}]}]};
 await page.locator('#config-file').setInputFiles({name:'pins.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(cfg))});await expect(page.locator('#pin-total')).toHaveText('2 个引脚');
 await page.locator('#config-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{bad')});await expect(page.locator('#toast')).toContainText('JSON 格式无效');await expect(page.locator('#pin-total')).toHaveText('2 个引脚');
 await page.screenshot({path:testInfo.outputPath('pins-editor.png')});
});
test('mobile layout has no page overflow; background controls work',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await ready(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.getByRole('button',{name:'白色',exact:true}).click();await expect(page.locator('#canvas-wrap')).not.toHaveClass(/checker/);
 await page.getByRole('button',{name:'透明',exact:true}).click();await expect(page.locator('#canvas-wrap')).toHaveClass(/checker/);
 await page.screenshot({path:testInfo.outputPath('mobile.png'),fullPage:true});
});
test('offline single HTML starts without HTTP requests',async({page})=>{
 const urls=[];page.on('request',r=>urls.push(r.url()));
 const {pathToFileURL}=await import('node:url');
 await page.goto(pathToFileURL(path.join(root,'dist/OpenPinMap.html')).href);
 await expect(page.locator('#pin-total')).toHaveText('54 个引脚');
 await expect(page.locator('#source-thumbnail')).toHaveAttribute('src',/^data:image/);
 await expect.poll(()=>page.locator('#preview').evaluate(c=>c.width)).toBeGreaterThan(1);
 expect(urls.filter(url=>/^https?:/.test(url))).toEqual([]);
});

test('wheel and Ctrl-wheel zoom the canvas without browser zoom',async({page})=>{
 await ready(page);const before=await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio,canvas:document.querySelector('#preview').getBoundingClientRect().width}));const vp=await page.locator('#viewport').boundingBox();await page.mouse.move(vp.x+vp.width/2,vp.y+vp.height/2);await page.mouse.wheel(0,-150);await expect.poll(()=>page.locator('#preview').evaluate(c=>c.getBoundingClientRect().width)).toBeGreaterThan(before.canvas);
 await page.keyboard.down('Control');await page.mouse.wheel(0,-50);await page.keyboard.up('Control');expect(await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio}))).toEqual({width:before.width,dpr:before.dpr});
});
test('image and group handles, movement, alignment and complete JSON round-trip',async({page},testInfo)=>{
 await ready(page);const c=await page.locator('#preview').boundingBox(),z=c.width/2480;
 await page.mouse.click(c.x+1240*z,c.y+1754*z);await expect(page.locator('#selection-name')).toHaveText('产品素材');let h=await page.locator('[data-handle="se"]').boundingBox();await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+8,h.y+h.height/2+20,{steps:5});await page.mouse.up();await expect(page.locator('#image-scale')).not.toHaveValue('70');
 await page.getByRole('button',{name:'引脚配置',exact:true}).click();await expect(page.locator('#selection-name')).toHaveText('左侧');h=await page.locator('[data-handle="se"]').boundingBox();await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+5,h.y+h.height/2+15,{steps:5});await page.mouse.up();await expect(page.locator('#group-scale')).not.toHaveValue('70');
 const b=await page.locator('#selection-box').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+20);await page.mouse.down();await page.mouse.move(b.x+b.width/2-25,b.y+30,{steps:5});await page.mouse.up();await expect(page.locator('#group-x')).not.toHaveValue('452.5');
 await page.locator('#align-target').selectOption('previous');await page.locator('#align-top').click();await expect(page.locator('#group-y')).toHaveValue('352.3');
 const pending=page.waitForEvent('download');await page.locator('#save-project').click();const d=await pending,file=testInfo.outputPath('transforms.json');await d.saveAs(file);const p=JSON.parse(await readFile(file,'utf8'));expect(p.version).toBe(2);expect(p.state.groups[0].scale).toBeGreaterThan(.7);expect(p.state.imageScale).toBeGreaterThan(70);expect(p.state.paper.format).toBe('a4');
 await page.locator('#group-x').fill('999');await page.locator('#group-x').press('Tab');await page.locator('#project-file').setInputFiles(file);await expect(page.locator('#toast')).toHaveText('项目已恢复。');await expect(page.locator('#group-x')).toHaveValue(String(Math.round(p.state.groups[0].start[0]*10)/10));
});
test('JPG quality changes file size; SVG has vector labels and embedded photo',async({page},testInfo)=>{
 await ready(page);await page.locator('#export-png').click();await page.locator('#export-format').selectOption('jpg');await page.locator('#export-scale').selectOption('0.5');await expect(page.locator('#download-export')).toBeEnabled();
 async function save(name){const pending=page.waitForEvent('download');await page.locator('#download-export').click();const d=await pending;const file=testInfo.outputPath(name);await d.saveAs(file);return readFile(file);}
 const high=await save('high.jpg');await page.locator('#export-quality').press('Home');for(let n=0;n<20;n++)await page.locator('#export-quality').press('ArrowRight');await expect(page.locator('#export-quality-value')).toHaveText('30%');await expect(page.locator('#download-export')).toBeEnabled();const low=await save('low.jpg');expect(low.length).toBeLessThan(high.length);
 const px=await page.evaluate(async data=>{const i=new Image();i.src=data;await i.decode();const c=document.createElement('canvas');c.width=1;c.height=1;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);return{w:i.width,h:i.height,pixel:[...ctx.getImageData(0,0,1,1).data]};},'data:image/jpeg;base64,'+low.toString('base64'));expect(px).toEqual({w:1240,h:1754,pixel:[255,255,255,255]});
 await page.locator('#export-format').selectOption('svg');await expect(page.locator('#download-export')).toBeEnabled();const svg=(await save('pinout.svg')).toString();expect(svg).toContain('width="210mm"');expect(svg.match(/<text /g)).toHaveLength(54);expect(svg).toContain('data:image/webp;base64,');expect(svg).toContain('scale(0.7)');await expect.poll(()=>page.locator('#export-preview').evaluate(i=>i.naturalWidth)).toBeGreaterThan(0);
});
test('quarter-turn image rotation preserves center and exports to project and SVG',async({page},testInfo)=>{
 await ready(page);const c=await page.locator('#preview').boundingBox(),z=c.width/2480;await page.mouse.click(c.x+1240*z,c.y+1754*z);const before=await page.locator('#selection-box').boundingBox();
 await page.locator('[data-rotation="90"]').click();await expect(page.locator('[data-rotation="90"]')).toHaveAttribute('aria-pressed','true');await expect.poll(async()=>Math.abs((await page.locator('#selection-box').boundingBox()).width-before.height)).toBeLessThan(.5);const after=await page.locator('#selection-box').boundingBox();expect(after.width).toBeCloseTo(before.height,0);expect(after.height).toBeCloseTo(before.width,0);expect(after.x+after.width/2).toBeCloseTo(before.x+before.width/2,0);expect(after.y+after.height/2).toBeCloseTo(before.y+before.height/2,0);
 const pending=page.waitForEvent('download');await page.locator('#save-project').click();const d=await pending,file=testInfo.outputPath('rotated.json');await d.saveAs(file);const saved=JSON.parse(await readFile(file,'utf8'));expect(saved.state.imageRotation).toBe(90);
 await page.locator('[data-rotation="0"]').click();await page.locator('#project-file').setInputFiles(file);await expect(page.locator('[data-rotation="90"]')).toHaveAttribute('aria-pressed','true');await page.locator('#export-png').click();await page.locator('#export-format').selectOption('svg');await expect(page.locator('#download-export')).toBeEnabled();const sv=page.waitForEvent('download');await page.locator('#download-export').click();const sd=await sv,sf=testInfo.outputPath('rotated.svg');await sd.saveAs(sf);expect(await readFile(sf,'utf8')).toContain('transform="rotate(90 ');
});
test('capture material, pin-group and export controls for the README',async({page},testInfo)=>{
 await ready(page);const canvas=await page.locator('#preview').boundingBox(),scale=canvas.width/2480;
 await page.mouse.click(canvas.x+1240*scale,canvas.y+1754*scale);await expect(page.locator('#selection-box')).toBeVisible();await page.screenshot({path:testInfo.outputPath('material-controls.png')});
 await page.getByRole('button',{name:'引脚配置',exact:true}).click();await expect(page.locator('#selection-name')).toHaveText('左侧');await page.screenshot({path:testInfo.outputPath('pin-group-controls.png')});
 await page.locator('#export-png').click();await page.locator('#export-format').selectOption('jpg');await page.locator('#export-scale').selectOption('0.5');await expect(page.locator('#download-export')).toBeEnabled();await expect.poll(()=>page.locator('#export-preview').evaluate(i=>i.naturalWidth)).toBe(1240);await page.locator('#export-dialog').screenshot({path:testInfo.outputPath('export-settings.png')});
});

test('language switch preserves edits, unsaved bulk text and project schema',async({page},testInfo)=>{
 await ready(page);await page.locator('[data-tab=pins]').click();
 await page.locator('#project-name').fill('我的电路板');await page.locator('#project-name').press('Tab');
 await page.getByRole('textbox',{name:'第 2 针名称',exact:true}).fill('自定义GPIO');await page.getByRole('textbox',{name:'第 2 针名称',exact:true}).press('Tab');
 await page.locator('summary').click();await page.locator('#batch-pins').fill('尚未应用的批量内容');
 await page.locator('#language-select').selectOption('en');
 await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('#export-png')).toContainText('Export image');
 await expect(page.getByRole('textbox',{name:'Pin 2 name',exact:true})).toHaveValue('自定义GPIO');await expect(page.locator('#batch-pins')).toHaveValue('尚未应用的批量内容');await expect(page.locator('#project-name')).toHaveValue('我的电路板');
 const pending=page.waitForEvent('download');await page.locator('#save-project').click();const file=testInfo.outputPath('english-project.json');await(await pending).saveAs(file);const saved=JSON.parse(await readFile(file,'utf8'));
 expect(saved.format).toBe('openpinmap');expect(saved.state.name).toBe('我的电路板');expect(saved.state.groups[0].pins[1].name).toBe('自定义GPIO');expect(saved.state).not.toHaveProperty('language');
 await page.locator('#language-select').selectOption('zh-CN');await expect(page.locator('#save-project')).toHaveText('保存项目');await expect(page.locator('#project-name')).toHaveValue('我的电路板');
});
test('English URL covers panels, accessible controls, export and validation feedback',async({page})=>{
 await page.goto('./?lang=en');await expect(page.locator('#source-thumbnail')).toHaveAttribute('src',/^data:image/);await expect(page.locator('#save-state')).toHaveText('Automatically saved on this device');
 await expect(page.locator('#paper-size option[value=portrait]')).toHaveText('A4 · Portrait · 210 × 297 mm');await expect(page.locator('#github-link')).toHaveAttribute('href','https://github.com/geekheart/OpenPinMap');await expect(page.locator('#github-link svg')).toBeAttached();
 await page.locator('[data-tab=pins]').click();await expect(page.getByRole('textbox',{name:'Pin 2 name',exact:true})).toBeVisible();
 await page.locator('#config-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{bad')});await expect(page.locator('#toast')).toContainText('Invalid JSON');
 await page.locator('#export-png').click();await expect(page.getByRole('dialog',{name:'Export image'})).toBeVisible();await expect(page.locator('#download-export')).toBeEnabled();await expect(page.locator('#export-info')).toContainText('Lossless');
 await page.locator('#export-format').selectOption('svg');await expect(page.locator('#export-scale-label')).toHaveText('Image resolution');await expect(page.locator('#quality-label')).toHaveText('Embedded image quality');await expect(page.locator('#download-export')).toBeEnabled();await expect(page.locator('#export-info')).toContainText('Vector labels');
 await page.locator('#close-export').click();await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
test('offline English interface embeds translations without network requests',async({page})=>{
 const urls=[];page.on('request',r=>urls.push(r.url()));const {pathToFileURL}=await import('node:url');await page.goto(pathToFileURL(path.join(root,'dist/OpenPinMap.html')).href+'?lang=en');
 await expect(page.locator('#pin-total')).toHaveText('54 pins');await expect(page.locator('#save-project')).toHaveText('Save project');await expect(page.locator('#source-thumbnail')).toHaveAttribute('src',/^data:image/);expect(urls.filter(url=>/^https?:/.test(url))).toEqual([]);
 await page.locator('[data-tab=pins]').click();await page.getByRole('combobox',{name:'Label layout',exact:true}).selectOption('horizontal');await page.getByRole('combobox',{name:'Text direction',exact:true}).selectOption('horizontal');await page.getByRole('combobox',{name:'Label rotation',exact:true}).selectOption('90');await page.getByRole('combobox',{name:'Group rotation',exact:true}).selectOption('180');await page.locator('#group-mirror-y').check();
 await expect(page.locator('#selection-box')).toBeVisible();await expect(page.locator('#label-rotation')).toHaveValue('90');await expect(page.locator('#group-mirror-y')).toBeChecked();expect(urls.filter(url=>/^https?:/.test(url))).toEqual([]);
});

async function importLayoutProject(page,groups){
 await ready(page);
 const image=await page.locator('#source-thumbnail').evaluate(img=>({data:img.src,width:img.naturalWidth,height:img.naturalHeight}));
 const project={format:'openpinmap',version:2,state:{name:'Four sides',width:1000,height:900,paper:{format:'custom'},fontSize:24,radius:0,guides:true,imageData:image.data,imageX:370,imageY:320,imageScale:260/Math.max(image.width,image.height)*100,groups}};
 await page.locator('#project-file').setInputFiles({name:'layout.openpinmap.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
 await expect(page.locator('#toast')).toHaveText('项目已恢复。');await page.locator('[data-tab=pins]').click();await expect(page.locator('#selection-box')).toBeVisible();
}
function shortPinGroup(connector,start,layout){return{connector,start,gap:100,...(layout?{layout}:{}),pins:['IO1','3V3','GND'].map(name=>({name,color:'#3498db'}))};}
async function saveLayoutDownload(page,testInfo,button,name){const pending=page.waitForEvent('download');await page.locator(button).click();const file=testInfo.outputPath(name);await(await pending).saveAs(file);return readFile(file);}

test('horizontal groups switch bounds, align horizontally and anchor the opposite spacing edge',async({page})=>{
 await importLayoutProject(page,[shortPinGroup('TOP',[200,120])]);
 await expect(page.locator('#group-layout')).toHaveValue('vertical');const vertical=await page.locator('#selection-box').boundingBox();
 await page.locator('#group-layout').selectOption('horizontal');
 await expect(page.locator('[data-handle=n]')).toBeHidden();await expect(page.locator('[data-handle=s]')).toBeHidden();await expect(page.locator('[data-handle=e]')).toBeVisible();await expect(page.locator('[data-handle=w]')).toBeVisible();
 const horizontal=await page.locator('#selection-box').boundingBox();expect(horizontal.width).toBeGreaterThan(vertical.width);expect(horizontal.height).toBeLessThan(vertical.height);
 await expect(page.locator('#align-top')).toHaveText('左端');await expect(page.locator('#align-bottom')).toHaveText('右端');
 await page.locator('#align-target').selectOption('canvas');await page.locator('#align-top').click();await expect(page.locator('#group-x')).toHaveValue('0');
 await page.locator('#align-bottom').click();await expect.poll(async()=>{const box=await page.locator('#selection-box').boundingBox(),canvas=await page.locator('#preview').boundingBox();return Math.abs(box.x+box.width-canvas.x-canvas.width);}).toBeLessThan(1);
 await page.locator('#align-center').click();await expect.poll(async()=>{const box=await page.locator('#selection-box').boundingBox(),canvas=await page.locator('#preview').boundingBox();return Math.abs(box.x+box.width/2-canvas.x-canvas.width/2);}).toBeLessThan(1);
 async function dragSpacing(handle,dx){
  const before=await page.locator('#selection-box').boundingBox(),gap=Number(await page.locator('#group-gap').inputValue()),h=await page.locator(`[data-handle=${handle}]`).boundingBox();
  await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+dx,h.y+h.height/2,{steps:4});await page.mouse.up();
  await expect.poll(async()=>Number(await page.locator('#group-gap').inputValue())).toBeGreaterThan(gap);
  await expect.poll(async()=>(await page.locator('#selection-box').boundingBox()).width-before.width).toBeGreaterThan(Math.abs(dx)-1);
  const after=await page.locator('#selection-box').boundingBox();expect(after.height).toBeCloseTo(before.height,1);expect(after.width-before.width).toBeCloseTo(Math.abs(dx),0);
  expect(handle==='e'?after.x:after.x+after.width).toBeCloseTo(handle==='e'?before.x:before.x+before.width,1);
 }
 await dragSpacing('e',24);await dragSpacing('w',-20);
});

test('four groups keep independent layouts through history, language changes and saved projects',async({page},testInfo)=>{
 await importLayoutProject(page,[shortPinGroup('LEFT',[100,330]),shortPinGroup('TOP',[350,100]),shortPinGroup('RIGHT',[730,330]),shortPinGroup('BOTTOM',[350,680])]);
 await page.locator('#group-tabs button').nth(1).click();await expect(page.locator('#group-layout')).toHaveValue('vertical');
 await page.locator('#group-layout').selectOption('horizontal');await page.locator('#undo').click();await expect(page.locator('#group-layout')).toHaveValue('vertical');await page.locator('#redo').click();await expect(page.locator('#group-layout')).toHaveValue('horizontal');
 await expect(page.locator('#group-text-direction')).toHaveValue('horizontal');await page.locator('#label-rotation').selectOption('90');await page.locator('#group-rotation').selectOption('90');await page.locator('#group-mirror-x').check();await page.locator('#group-mirror-y').check();
 await page.locator('#undo').click();await expect(page.locator('#group-mirror-y')).not.toBeChecked();await expect(page.locator('#group-mirror-x')).toBeChecked();await page.locator('#redo').click();await expect(page.locator('#group-mirror-y')).toBeChecked();
 await page.locator('summary').click();await page.locator('#batch-pins').fill('尚未应用\nUNAPPLIED');await page.locator('#language-select').selectOption('en');
 await expect(page.locator('#group-layout')).toHaveValue('horizontal');await expect(page.locator('#batch-pins')).toHaveValue('尚未应用\nUNAPPLIED');await expect(page.locator('#align-top')).toHaveText('Top');await expect(page.locator('#align-bottom')).toHaveText('Bottom');
 await expect(page.locator('#group-text-direction')).toHaveValue('horizontal');await expect(page.locator('#label-rotation')).toHaveValue('90');await expect(page.locator('#group-rotation')).toHaveValue('90');await expect(page.locator('#group-mirror-x')).toBeChecked();await expect(page.locator('#group-mirror-y')).toBeChecked();
 const saved=JSON.parse((await saveLayoutDownload(page,testInfo,'#save-project','four-sides.json')).toString());
 expect(saved.state.groups.map(g=>g.layout)).toEqual(['vertical','horizontal','vertical','vertical']);expect(saved.state.groups[1].pins.map(p=>p.name)).toEqual(['IO1','3V3','GND']);expect(saved.state).not.toHaveProperty('language');
 expect(saved.state.groups[1]).toMatchObject({textDirection:'horizontal',labelRotation:90,rotation:90,mirrorX:true,mirrorY:true});
 await page.locator('#group-layout').selectOption('vertical');await page.locator('#project-file').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await expect(page.locator('#group-layout')).toHaveValue('horizontal');
 await page.locator('#group-tabs button').nth(0).click();await expect(page.locator('#group-layout')).toHaveValue('vertical');await page.locator('#group-tabs button').nth(1).click();await expect(page.locator('#group-layout')).toHaveValue('horizontal');
 await expect(page.locator('#label-rotation')).toHaveValue('90');await expect(page.locator('#group-rotation')).toHaveValue('90');await expect(page.locator('#group-mirror-x')).toBeChecked();await expect(page.locator('#group-mirror-y')).toBeChecked();
 await page.locator('#language-select').selectOption('zh-CN');await expect(page.locator('#align-top')).toHaveText('顶端');
});

test('label arrangement, character direction and capsule rotation are independent',async({page},testInfo)=>{
 await importLayoutProject(page,[{...shortPinGroup('TOP',[300,200]),textDirection:'horizontal'}]);
 await expect(page.locator('#group-text-direction')).toHaveValue('horizontal');await page.locator('#group-layout').selectOption('horizontal');await expect(page.locator('#group-text-direction')).toHaveValue('horizontal');
 await expect.poll(async()=>{const b=await page.locator('#selection-box').boundingBox();return b.width/b.height;}).toBeGreaterThan(2);
 const row=await page.locator('#selection-box').boundingBox();await page.locator('#label-rotation').selectOption('90');
 await expect.poll(async()=>(await page.locator('#selection-box').boundingBox()).height).toBeGreaterThan(row.height);
 const rotated=await page.locator('#selection-box').boundingBox();expect(rotated.width).toBeLessThan(row.width);expect(rotated.x+rotated.width/2).toBeCloseTo(row.x+row.width/2,0);expect(rotated.y+rotated.height/2).toBeCloseTo(row.y+row.height/2,0);
 await page.locator('#group-text-direction').selectOption('vertical');await page.locator('#group-layout').selectOption('vertical');await expect(page.locator('#group-text-direction')).toHaveValue('vertical');await expect(page.locator('#label-rotation')).toHaveValue('90');
 await page.locator('#group-text-direction').selectOption('horizontal');await expect(page.locator('#group-layout')).toHaveValue('vertical');await page.locator('#group-layout').selectOption('horizontal');
 await page.locator('#export-png').click();await page.locator('#export-format').selectOption('svg');await expect(page.locator('#download-export')).toBeEnabled();const source=(await saveLayoutDownload(page,testInfo,'#download-export','rotated-capsules.svg')).toString();
 const text=await page.evaluate(source=>[...new DOMParser().parseFromString(source,'image/svg+xml').querySelectorAll('text')].map(el=>el.textContent),source);expect(text).toEqual(['IO1','3V3','GND']);
 await page.locator('#close-export').click();await expect(page.locator('#export-dialog')).toBeHidden();
 await page.locator('[data-tab=style]').click();await page.locator('#radius').press('End');await page.locator('[data-tab=pins]').click();await page.screenshot({path:testInfo.outputPath('rotated-capsules.png')});
 await page.locator('#language-select').selectOption('en');await expect(page.getByRole('combobox',{name:'Text direction',exact:true})).toBeVisible();await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);expect(await page.locator('#panel-pins').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});

test('vertical layout keeps label clearance when text direction changes and survives history and import',async({page},testInfo)=>{
 await importLayoutProject(page,[{...shortPinGroup('LEFT',[100,100],'vertical'),textDirection:'horizontal'}]);
 await page.evaluate(()=>{
  window.spacingRects=[];const original=CanvasRenderingContext2D.prototype.roundRect;
  CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,...rest){if(this.canvas.id!=='preview'&&this.canvas.width===1000&&this.canvas.height===900)window.spacingRects.push({x,y,w,h});return original.call(this,x,y,w,h,...rest);};
 });
 async function capsules(name){
  await page.evaluate(()=>{window.spacingRects=[];});await page.locator('#export-png').click();await page.locator('#export-format').selectOption('png');await expect(page.locator('#download-export')).toBeEnabled();await expect.poll(()=>page.evaluate(()=>window.spacingRects.length)).toBe(3);const canvas=await page.evaluate(()=>window.spacingRects);
  await page.locator('#export-format').selectOption('svg');await expect(page.locator('#download-export')).toBeEnabled();const source=(await saveLayoutDownload(page,testInfo,'#download-export',name)).toString();
  const svg=await page.evaluate(source=>[...new DOMParser().parseFromString(source,'image/svg+xml').querySelectorAll('g > rect')].map(el=>Object.fromEntries([['x','x'],['y','y'],['w','width'],['h','height']].map(([key,attr])=>[key,Number(el.getAttribute(attr))]))),source);
  expect(svg).toEqual(canvas);await page.locator('#close-export').click();return svg;
 }
 const original=await capsules('vertical-horizontal-text.svg'),clearance=100-original[0].h;
 expect(clearance).toBeGreaterThan(0);await page.locator('#group-text-direction').selectOption('vertical');const automaticGap=Number(await page.locator('#group-gap').inputValue());expect(automaticGap).toBeGreaterThan(100);
 await page.locator('#undo').click();await expect(page.locator('#group-text-direction')).toHaveValue('horizontal');await expect(page.locator('#group-gap')).toHaveValue('100');await page.locator('#redo').click();await expect(page.locator('#group-text-direction')).toHaveValue('vertical');expect(Number(await page.locator('#group-gap').inputValue())).toBeCloseTo(automaticGap,2);
 const stacked=await capsules('vertical-stacked-text.svg');expect(automaticGap).toBeCloseTo(stacked[0].h+clearance,2);for(let i=1;i<stacked.length;i++){const pitch=stacked[i].y-stacked[i-1].y;expect(pitch).toBeGreaterThanOrEqual(stacked[i-1].h);expect(pitch-stacked[i-1].h).toBeCloseTo(clearance,5);}
 const saved=JSON.parse((await saveLayoutDownload(page,testInfo,'#save-project','automatic-spacing.json')).toString());expect(saved.state.groups[0].gap).toBeCloseTo(automaticGap,2);expect(saved.state.groups[0].textDirection).toBe('vertical');
 await page.locator('#group-text-direction').selectOption('horizontal');await expect(page.locator('#group-gap')).toHaveValue('100');await page.locator('#project-file').setInputFiles({name:'automatic-spacing.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await expect(page.locator('#group-text-direction')).toHaveValue('vertical');expect(Number(await page.locator('#group-gap').inputValue())).toBeCloseTo(automaticGap,2);
 await page.locator('#group-text-direction').selectOption('horizontal');await expect(page.locator('#group-gap')).toHaveValue('100');await page.locator('#group-layout').selectOption('horizontal');expect(Number(await page.locator('#group-gap').inputValue())).toBeCloseTo(original[0].w+clearance,2);
 await page.locator('#group-text-direction').selectOption('vertical');expect(Number(await page.locator('#group-gap').inputValue())).toBeCloseTo(stacked[0].w+clearance,2);await page.locator('#group-layout').selectOption('vertical');expect(Number(await page.locator('#group-gap').inputValue())).toBeCloseTo(automaticGap,2);
 const restored=await capsules('horizontal-to-vertical-stacked.svg');for(let i=1;i<restored.length;i++)expect(restored[i].y-restored[i-1].y-restored[i-1].h).toBeCloseTo(clearance,5);
});

test('horizontal SVG glyphs and top/bottom leaders match PNG Canvas drawing',async({page},testInfo)=>{
 const groups=[shortPinGroup('TOP',[350,100],'horizontal'),shortPinGroup('BOTTOM',[350,680],'horizontal'),shortPinGroup('LEFT',[100,330]),shortPinGroup('RIGHT',[730,330])];
 await importLayoutProject(page,groups);
 await page.evaluate(()=>{
  window.layoutDraw={rects:[],texts:[],lines:[]};const proto=CanvasRenderingContext2D.prototype,moves=new WeakMap();
  const capture=ctx=>ctx.canvas.id!=='preview'&&ctx.canvas.width===1000&&ctx.canvas.height===900;
  const transform=ctx=>{const m=ctx.getTransform();return[m.a,m.b,m.c,m.d,m.e,m.f];};
  for(const [method,key,count] of [['roundRect','rects',5],['fillText','texts',3]]){const original=proto[method];proto[method]=function(...args){if(capture(this))window.layoutDraw[key].push({values:args.slice(0,count),transform:transform(this)});return original.apply(this,args);};}
  const move=proto.moveTo,line=proto.lineTo;proto.moveTo=function(x,y){if(capture(this))moves.set(this,[x,y]);return move.call(this,x,y);};proto.lineTo=function(x,y){if(capture(this))window.layoutDraw.lines.push({values:[...moves.get(this),x,y],transform:transform(this)});return line.call(this,x,y);};
 });
 await page.locator('#export-png').click();await expect(page.locator('#download-export')).toBeEnabled();await expect.poll(()=>page.evaluate(()=>window.layoutDraw.rects.length)).toBe(12);
 const canvas=await page.evaluate(()=>window.layoutDraw);
 await page.locator('#export-format').selectOption('svg');await expect(page.locator('#download-export')).toBeEnabled();const source=(await saveLayoutDownload(page,testInfo,'#download-export','four-sides.svg')).toString();
 const svg=await page.evaluate(source=>{
  const doc=new DOMParser().parseFromString(source,'image/svg+xml'),attrs=(el,names)=>names.map(name=>Number(el.getAttribute(name)));
  return{image:attrs(doc.querySelector('image'),['x','y','width','height']),groups:[...doc.querySelectorAll('g')].map(g=>{
   const [x,y,s]=g.getAttribute('transform').match(/-?\d+(?:\.\d+)?/g).map(Number),transform=[s,0,0,s,x,y];
   return{rects:[...g.querySelectorAll('rect')].map(el=>({values:attrs(el,['x','y','width','height','rx']),transform})),texts:[...g.querySelectorAll('text')].map(el=>({values:[el.textContent,...attrs(el,['x','y'])],transform})),lines:[...g.querySelectorAll('path')].map(el=>({values:el.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number),transform}))};
  })};
 },source);
 expect(canvas.rects).toEqual(svg.groups.flatMap(g=>g.rects));expect(canvas.texts).toEqual(svg.groups.flatMap(g=>g.texts));expect(canvas.lines).toEqual(svg.groups.flatMap(g=>g.lines));
 for(const [index,g] of svg.groups.slice(0,2).entries()){
  expect(g.rects.map(r=>r.values.slice(0,2))).toEqual([[0,0],[100,0],[200,0]]);
  expect(g.texts.map(t=>t.values[0])).toEqual(Array.from('IO13V3GND'));
  for(let pin=0;pin<3;pin++){const glyphs=g.texts.slice(pin*3,pin*3+3);expect(glyphs[0].values[2]).toBeLessThan(glyphs[1].values[2]);expect(glyphs[1].values[2]).toBeLessThan(glyphs[2].values[2]);for(const glyph of glyphs){expect(glyph.values[1]).toBeGreaterThan(pin*100);expect(glyph.values[1]).toBeLessThan(pin*100+g.rects[pin].values[2]);}}
  for(const line of g.lines){expect(line.values[0]).toBe(line.values[2]);expect(line.values[3]+groups[index].start[1]).toBeCloseTo(svg.image[1]+(index===0?0:svg.image[3]),5);expect(line.values[1]).toBe(index===0?g.rects[0].values[3]:0);}
 }
});

test('rotated and mirrored label groups share world geometry in SVG and Canvas',async({page},testInfo)=>{
 const groups=[
  {...shortPinGroup('TOP',[300,100],'horizontal'),textDirection:'horizontal',labelRotation:90,rotation:90,mirrorX:true,mirrorY:false},
  {...shortPinGroup('BOTTOM',[300,620],'horizontal'),textDirection:'vertical',labelRotation:270,rotation:270,mirrorX:false,mirrorY:true},
  {...shortPinGroup('LEFT',[100,320]),textDirection:'horizontal',labelRotation:0,rotation:180,mirrorX:true,mirrorY:true}
 ];
 await importLayoutProject(page,groups);
 const before=await page.locator('#selection-box').boundingBox();await page.locator('#group-rotation').selectOption('0');
 await expect.poll(async()=>(await page.locator('#selection-box').boundingBox()).width).toBeGreaterThan(before.width);
 const after=await page.locator('#selection-box').boundingBox();expect(after.x+after.width/2).toBeCloseTo(before.x+before.width/2,0);expect(after.y+after.height/2).toBeCloseTo(before.y+before.height/2,0);expect(after.width).toBeCloseTo(before.height,0);expect(after.height).toBeCloseTo(before.width,0);
 await page.locator('#group-rotation').selectOption('90');
 await page.evaluate(()=>{
  window.transformedDraw={rects:[],texts:[],lines:[]};const proto=CanvasRenderingContext2D.prototype,moves=new WeakMap();
  const capture=ctx=>ctx.canvas.id!=='preview'&&ctx.canvas.width===1000&&ctx.canvas.height===900;
  const n=v=>Math.round(v*1e4)/1e4||0,point=(m,x,y)=>[n(m.a*x+m.c*y+m.e),n(m.b*x+m.d*y+m.f)];
  const rect=proto.roundRect,text=proto.fillText,move=proto.moveTo,line=proto.lineTo;
  proto.roundRect=function(x,y,w,h,...rest){if(capture(this)){const m=this.getTransform();window.transformedDraw.rects.push([[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(p=>point(m,...p)).sort((a,b)=>a[0]-b[0]||a[1]-b[1]));}return rect.call(this,x,y,w,h,...rest);};
  proto.fillText=function(value,x,y,...rest){if(capture(this)){const m=this.getTransform();window.transformedDraw.texts.push({value,point:point(m,x,y),direction:[m.a,m.b,m.c,m.d].map(n)});}return text.call(this,value,x,y,...rest);};
  proto.moveTo=function(x,y){if(capture(this))moves.set(this,point(this.getTransform(),x,y));return move.call(this,x,y);};
  proto.lineTo=function(x,y){if(capture(this))window.transformedDraw.lines.push([moves.get(this),point(this.getTransform(),x,y)]);return line.call(this,x,y);};
 });
 await page.locator('#export-png').click();await expect(page.locator('#download-export')).toBeEnabled();await expect.poll(()=>page.evaluate(()=>window.transformedDraw.rects.length)).toBe(9);
 const canvas=await page.evaluate(()=>window.transformedDraw);
 await page.locator('#export-format').selectOption('svg');await expect(page.locator('#download-export')).toBeEnabled();const source=(await saveLayoutDownload(page,testInfo,'#download-export','transformed-groups.svg')).toString();
 const svg=await page.evaluate(source=>{
  const doc=new DOMParser().parseFromString(source,'image/svg+xml'),n=v=>Math.round(v*1e4)/1e4||0,attrs=(el,names)=>names.map(name=>Number(el.getAttribute(name)));
  const matrix=el=>{const ancestors=[];for(let current=el;current&&current!==doc.documentElement;current=current.parentElement){const value=current.transform?.baseVal?.consolidate()?.matrix;if(value)ancestors.unshift(value);}return ancestors.reduce((m,value)=>m.multiply(value),new DOMMatrix());};
  const point=(m,x,y)=>[n(m.a*x+m.c*y+m.e),n(m.b*x+m.d*y+m.f)];
  return{
   rects:[...doc.querySelectorAll('rect')].map(el=>{const [x,y,w,h]=attrs(el,['x','y','width','height']),m=matrix(el);return[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(p=>point(m,...p)).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);}),
   texts:[...doc.querySelectorAll('text')].map(el=>{const m=matrix(el);return{value:el.textContent,point:point(m,...attrs(el,['x','y'])),direction:[m.a,m.b,m.c,m.d].map(n)};}),
   lines:[...doc.querySelectorAll('path,line')].map(el=>{const values=el.tagName==='line'?attrs(el,['x1','y1','x2','y2']):el.getAttribute('d').match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number),m=matrix(el);return[point(m,...values.slice(0,2)),point(m,...values.slice(2,4))];})
  };
 },source);
 expect(svg).toEqual(canvas);expect(svg.texts.slice(0,3).map(text=>text.value)).toEqual(['IO1','3V3','GND']);expect(svg.texts.slice(3,12).map(text=>text.value)).toEqual(Array.from('IO13V3GND'));
 await page.locator('#close-export').click();await expect(page.locator('#export-dialog')).toBeHidden();
 await page.locator('#group-tabs button').nth(2).click();
 const preview=await page.locator('#preview').boundingBox(),z=preview.width/1000,second=canvas.rects[1],cx=second.reduce((sum,p)=>sum+p[0],0)/4,cy=second.reduce((sum,p)=>sum+p[1],0)/4;
 await page.mouse.click(preview.x+cx*z,preview.y+cy*z);await expect(page.locator('#selection-name')).toHaveText('TOP');
 await expect(page.locator('[data-handle=n]')).toBeVisible();await expect(page.locator('[data-handle=s]')).toBeVisible();await expect(page.locator('[data-handle=e]')).toBeHidden();await expect(page.locator('[data-handle=w]')).toBeHidden();
 const box=await page.locator('#selection-box').boundingBox(),handle=await page.locator('[data-handle=s]').boundingBox(),gap=Number(await page.locator('#group-gap').inputValue());
 await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2+20,{steps:4});await page.mouse.up();
 await expect.poll(async()=>Number(await page.locator('#group-gap').inputValue())).toBeGreaterThan(gap);const enlarged=await page.locator('#selection-box').boundingBox();expect(enlarged.y).toBeCloseTo(box.y,1);expect(enlarged.width).toBeCloseTo(box.width,1);expect(enlarged.height-box.height).toBeCloseTo(20,0);
});
