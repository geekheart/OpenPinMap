import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
async function ready(page){await page.goto('./');await expect(page.locator('#source-thumbnail')).toHaveAttribute('src',/^data:image/);await expect.poll(()=>page.locator('#preview').evaluate(c=>c.width)).toBeGreaterThan(1);await expect(page.locator('#save-state')).toHaveText('已在本机自动保存');}
test('edit, undo/redo and restore complete project',async({page},testInfo)=>{
 await ready(page);await page.getByRole('button',{name:'引脚配置',exact:true}).click();
 const input=page.getByRole('textbox',{name:'第 2 针名称',exact:true});await input.fill('IO2_TEST');await input.press('Tab');
 await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeEnabled();await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(input).toHaveValue('IO2');
 await page.getByRole('button',{name:'重做',exact:true}).click();await expect(input).toHaveValue('IO2_TEST');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目',exact:true}).click();const download=await downloadPromise;const file=testInfo.outputPath('saved.openpinmap.json');await download.saveAs(file);
 const saved=JSON.parse(await readFile(file,'utf8'));expect(saved.format).toBe('openpinmap');expect(saved.state.groups[0].pins[1].name).toBe('IO2_TEST');
 await input.fill('TEMP');await input.press('Tab');await page.locator('#project-file').setInputFiles(file);await expect(page.locator('#toast')).toHaveText('项目已恢复。');await expect(input).toHaveValue('IO2_TEST');
});
test('PNG export retains alpha and full output dimensions',async({page},testInfo)=>{
 await ready(page);await page.screenshot({path:testInfo.outputPath('overview.png')});const pending=page.waitForEvent('download');await page.getByRole('button',{name:'↓ 导出 PNG',exact:true}).click();const download=await pending;const file=testInfo.outputPath('transparent.png');await download.saveAs(file);
 const png=await readFile(file);const data='data:image/png;base64,'+png.toString('base64');
 const pixels=await page.evaluate(async data=>{const img=new Image();img.src=data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);return{w:img.width,h:img.height,alpha:x.getImageData(0,0,1,1).data[3],boardAlpha:x.getImageData(1688,2500,1,1).data[3]};},data);
 expect(pixels).toEqual({w:3376,h:5000,alpha:0,boardAlpha:255});
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
 await expect(page.locator('#pin-total')).toHaveText('42 个引脚');
 await expect(page.locator('#source-thumbnail')).toHaveAttribute('src',/^data:image/);
 await expect.poll(()=>page.locator('#preview').evaluate(c=>c.width)).toBeGreaterThan(1);
 expect(urls.filter(url=>/^https?:/.test(url))).toEqual([]);
});
