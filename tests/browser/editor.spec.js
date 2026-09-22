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
 await page.getByRole('button',{name:'引脚配置',exact:true}).click();h=await page.locator('[data-handle="se"]').boundingBox();await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+5,h.y+h.height/2+15,{steps:5});await page.mouse.up();await expect(page.locator('#group-scale')).not.toHaveValue('70');
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
 await page.locator('[data-rotation="90"]').click();await expect(page.locator('[data-rotation="90"]')).toHaveAttribute('aria-pressed','true');const after=await page.locator('#selection-box').boundingBox();expect(after.width).toBeCloseTo(before.height,0);expect(after.height).toBeCloseTo(before.width,0);expect(after.x+after.width/2).toBeCloseTo(before.x+before.width/2,0);expect(after.y+after.height/2).toBeCloseTo(before.y+before.height/2,0);
 const pending=page.waitForEvent('download');await page.locator('#save-project').click();const d=await pending,file=testInfo.outputPath('rotated.json');await d.saveAs(file);const saved=JSON.parse(await readFile(file,'utf8'));expect(saved.state.imageRotation).toBe(90);
 await page.locator('[data-rotation="0"]').click();await page.locator('#project-file').setInputFiles(file);await expect(page.locator('[data-rotation="90"]')).toHaveAttribute('aria-pressed','true');await page.locator('#export-png').click();await page.locator('#export-format').selectOption('svg');await expect(page.locator('#download-export')).toBeEnabled();const sv=page.waitForEvent('download');await page.locator('#download-export').click();const sd=await sv,sf=testInfo.outputPath('rotated.svg');await sd.saveAs(sf);expect(await readFile(sf,'utf8')).toContain('transform="rotate(90 ');
});
