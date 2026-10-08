'use strict';
(() => {
function localizedError(key,fallback){const value=new Error(globalThis.OpenPinMapI18n?globalThis.OpenPinMapI18n.t(key):fallback);value.i18nKey=key;return value;}
const escapeXml=value=>String(value).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c])).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
// Canvas encoders default to 96 dpi. Keep A4 physical size in downloaded rasters.
async function withDpi(blob,dpi){
 const bytes=new Uint8Array(await blob.arrayBuffer());
 if(blob.type==='image/png'){
  const chunk=new Uint8Array(21),v=new DataView(chunk.buffer);v.setUint32(0,9);chunk.set([112,72,89,115],4);v.setUint32(8,Math.round(dpi/0.0254));v.setUint32(12,Math.round(dpi/0.0254));chunk[16]=1;v.setUint32(17,crc32(chunk.subarray(4,17)));
  const parts=[bytes.subarray(0,33),chunk];let at=33;
  while(at+12<=bytes.length){const size=new DataView(bytes.buffer,bytes.byteOffset+at,4).getUint32(0)+12;if(at+size>bytes.length)throw localizedError('error.pngEncoding','PNG 编码无效。');if(String.fromCharCode(...bytes.subarray(at+4,at+8))!=='pHYs')parts.push(bytes.subarray(at,at+size));at+=size;}
  return new Blob(parts,{type:blob.type});
 }
 if(blob.type==='image/jpeg'){
  // JFIF APP0 density fields; add a JFIF segment if the encoder omitted it.
  let at=2;
  while(at+4<bytes.length&&bytes[at]===255){const marker=bytes[at+1];if(marker===0xda||marker===0xd9)break;const length=(bytes[at+2]<<8)|bytes[at+3];if(length<2||at+2+length>bytes.length)break;
   if(marker===0xe0&&length>=16&&String.fromCharCode(...bytes.subarray(at+4,at+9))==='JFIF\0'){bytes[at+11]=1;const v=new DataView(bytes.buffer);v.setUint16(at+12,Math.round(dpi));v.setUint16(at+14,Math.round(dpi));return new Blob([bytes],{type:blob.type});}at+=length+2;
  }
  const jfif=new Uint8Array([255,224,0,16,74,70,73,70,0,1,1,1,0,0,0,0,0,0]);new DataView(jfif.buffer).setUint16(12,Math.round(dpi));new DataView(jfif.buffer).setUint16(14,Math.round(dpi));return new Blob([bytes.subarray(0,2),jfif,bytes.subarray(2)],{type:blob.type});
 }
 return blob;
}
globalThis.OpenPinMapExport=Object.freeze({escapeXml,crc32,withDpi});
})();
