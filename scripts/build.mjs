import {readFile,mkdir,writeFile,copyFile,cp,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(root,'dist');
await rm(out,{recursive:true,force:true});
await mkdir(path.join(out,'src'),{recursive:true});
const config=JSON.parse(await readFile(path.join(root,'examples/s31.json'),'utf8'));
const image=await readFile(path.join(root,'assets/s31.webp'));
const defaults=`window.PIN_DEFAULTS = ${JSON.stringify(config)};\nwindow.PIN_DEFAULT_IMAGE = "data:image/webp;base64,${image.toString('base64')}";\n`;
for(const name of ['index.html','style.css','app.js','src/model.js'])await copyFile(path.join(root,name),path.join(out,name));
await cp(path.join(root,'assets'),path.join(out,'assets'),{recursive:true});
await writeFile(path.join(out,'defaults.js'),defaults);
await writeFile(path.join(out,'.nojekyll'),'');
let single=await readFile(path.join(root,'index.html'),'utf8');
single=single.replace('<link rel="stylesheet" href="style.css">',`<style>${await readFile(path.join(root,'style.css'),'utf8')}</style>`);
single=single.replace('href="assets/favicon.svg"',`href="data:image/svg+xml;base64,${(await readFile(path.join(root,'assets/favicon.svg'))).toString('base64')}"`);
for(const [name,content] of [['defaults.js',defaults],['src/model.js',await readFile(path.join(root,'src/model.js'),'utf8')],['app.js',await readFile(path.join(root,'app.js'),'utf8')]]){
 single=single.replace(`<script src="${name}"></script>`,`<script>${content.replaceAll('</script','<\\/script')}</script>`);
}
await writeFile(path.join(out,'OpenPinMap.html'),single);
console.log(`Built dist/ and dist/OpenPinMap.html (${(Buffer.byteLength(single)/1024/1024).toFixed(1)} MB)`);
