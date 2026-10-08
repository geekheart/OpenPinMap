import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/i18n.js',import.meta.url),'utf8');
const model=readFileSync(new URL('../src/model.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const example=JSON.parse(readFileSync(new URL('../examples/p4.json',import.meta.url),'utf8'));
function context(search=''){
 const location={href:'https://example.org/OpenPinMap/'+search};
 const ctx=vm.createContext({URL,location,history:{replaceState(_state,_title,url){location.href=String(url);}}});
 vm.runInContext(source,ctx);vm.runInContext(model,ctx);return ctx;
}
test('Chinese is the default, URL language is explicit, and switching preserves unrelated URL state',()=>{
 const ctx=context('?project=demo#canvas'),i18n=ctx.OpenPinMapI18n;
 assert.equal(i18n.language,'zh-CN');assert.equal(i18n.t('export.image'),'导出图片');
 i18n.setLanguage('en');assert.equal(i18n.t('export.image'),'Export image');assert.equal(ctx.location.href,'https://example.org/OpenPinMap/?project=demo&lang=en#canvas');
 i18n.setLanguage('zh-CN');assert.equal(ctx.location.href,'https://example.org/OpenPinMap/?project=demo#canvas');
 assert.equal(context('?lang=en').OpenPinMapI18n.language,'en');assert.equal(context('?lang=fr').OpenPinMapI18n.language,'zh-CN');
});
test('language catalogs match, interpolate all placeholders, and cover explicit HTML bindings',()=>{
 const {messages,t,setLanguage}=context().OpenPinMapI18n;
 assert.deepEqual(Object.keys(messages['zh-CN']).sort(),Object.keys(messages.en).sort());
 for(const key of Object.keys(messages.en)){
  assert.ok(messages.en[key].trim(),key);assert.ok(!/[\u3400-\u9fff]/.test(messages.en[key]),key);
  assert.deepEqual(messages['zh-CN'][key].match(/\{\w+\}/g)||[],messages.en[key].match(/\{\w+\}/g)||[],key);
 }
 for(const [,key] of html.matchAll(/data-i18n(?:-(?:aria-label|alt|title|content|placeholder))?="([^"]+)"/g))assert.ok(key in messages.en,key);
 setLanguage('en');assert.equal(t('status.pinCount',{count:54}),'54 pins');assert.equal(t('pin.deleteAria',{number:3}),'Delete pin 3');
 assert.ok(!/<option[^>]*>\s*<span/.test(html),'option labels must be translated on the option itself');
});
test('language switches localize validation errors without rewriting pin names, metadata or project schema',()=>{
 const ctx=context(),i18n=ctx.OpenPinMapI18n,model=ctx.OpenPinMapModel;
 const input={format:'openpinmap',version:2,state:{...structuredClone(example),name:'中文项目',imageData:'data:image/webp;base64,UklGRg=='}};
 input.state.groups[0].connector='用户分组';input.state.groups[0].pins[0].name='中文标签';
 const before=JSON.stringify(model.validateProject(input));
 let error;try{model.validateGroups([]);}catch(e){error=e;}
 assert.equal(i18n.errorMessage(error),'配置需要包含 1–24 个引脚分组。');
 i18n.setLanguage('en');assert.equal(i18n.errorMessage(error),'The configuration must contain 1–24 pin groups.');
 assert.equal(JSON.stringify(model.validateProject(input)),before);assert.equal(input.state.groups[0].pins[0].name,'中文标签');
 assert.throws(()=>model.validateGroups([]),/1–24 pin groups/);
});
test('explicit UI bindings leave user input values untouched',()=>{
 const ctx=context('?lang=en');
 const label={dataset:{i18n:'project.save'},textContent:'保存项目'},userInput={value:'用户内容',textContent:'不应被修改'};
 const aria={getAttribute:()=> 'project.name',setAttribute(name,value){this[name]=value;}};
 const select={value:'zh-CN'};
 ctx.document={documentElement:{lang:'zh-CN'},getElementById:id=>id==='language-select'?select:null,querySelectorAll(selector){if(selector==='[data-i18n]')return[label];if(selector==='[data-i18n-aria-label]')return[aria];return[];}};
 ctx.OpenPinMapI18n.apply();assert.equal(label.textContent,'Save project');assert.equal(aria['aria-label'],'Project name');assert.equal(select.value,'en');assert.equal(ctx.document.documentElement.lang,'en');assert.equal(userInput.value,'用户内容');assert.equal(userInput.textContent,'不应被修改');
});
