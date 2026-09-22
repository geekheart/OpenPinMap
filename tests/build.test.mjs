import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root});
test('Pages entry resolves every script under a repository subpath',()=>{
 const html=readFileSync(root+'/dist/index.html','utf8');
 for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){const asset=match[1];assert.ok(!asset.startsWith('/'),asset);assert.ok(existsSync(root+'/dist/'+asset),asset);}
 assert.ok(html.includes('OpenPinMap'));assert.ok(!html.includes('header-note'));assert.ok(!html.includes('class="hint"'));
});
test('single HTML package embeds scripts, styles and image without network dependencies',()=>{
 const html=readFileSync(root+'/dist/OpenPinMap.html','utf8');assert.ok(!/<script src=/.test(html));assert.ok(!/<link rel="stylesheet"/.test(html));assert.ok(html.includes('data:image/webp;base64,'));assert.ok(html.includes('data:image/svg+xml;base64,'));
 assert.ok(!html.includes('/Users/'));assert.ok(!html.includes('C:/Windows/'));
});
