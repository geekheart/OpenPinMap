import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/export.js';
const {withDpi,crc32,escapeXml}=globalThis.OpenPinMapExport;
const source=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=','base64');
test('PNG density follows IHDR, has valid CRC, and keeps image data intact',async()=>{
 const result=new Uint8Array(await(await withDpi(new Blob([source],{type:'image/png'}),300)).arrayBuffer());assert.equal(Buffer.from(result.subarray(12,16)).toString(),'IHDR');assert.equal(Buffer.from(result.subarray(37,41)).toString(),'pHYs');const v=new DataView(result.buffer);assert.equal(v.getUint32(41),11811);assert.equal(v.getUint32(45),11811);assert.equal(result[49],1);assert.equal(v.getUint32(50),crc32(result.subarray(37,50)));assert.deepEqual(Buffer.from(result.subarray(54)),source.subarray(33));
 const twice=new Uint8Array(await(await withDpi(new Blob([result],{type:'image/png'}),150)).arrayBuffer());assert.equal(twice.length,result.length);assert.equal(new DataView(twice.buffer).getUint32(41),5906);
});
test('JPEG density updates JFIF without changing scan bytes',async()=>{const src=Uint8Array.from([255,216,255,224,0,16,74,70,73,70,0,1,1,0,0,1,0,1,0,0,255,218,0,2,9,8,7,255,217]);const bytes=new Uint8Array(await(await withDpi(new Blob([src],{type:'image/jpeg'}),150)).arrayBuffer());assert.equal(bytes[13],1);assert.equal(new DataView(bytes.buffer).getUint16(14),150);assert.equal(new DataView(bytes.buffer).getUint16(16),150);assert.deepEqual(bytes.subarray(20),src.subarray(20));});
test('SVG label and image attributes escape XML markup',()=>{assert.equal(escapeXml('<IO & "3">'), '&lt;IO &amp; &quot;3&quot;&gt;');assert.equal(escapeXml('IO\u0000'), 'IO');});
