import {readFile} from 'node:fs/promises';
import * as T from '../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
const loaderURL=new URL('../../sunbreak-storm-v3/vendor/presentation/examples/jsm/loaders/RGBELoader.js',import.meta.url),threeURL=new URL('../../sunbreak-storm-v3/vendor/presentation/build/three.module.js',import.meta.url);
const code=(await readFile(loaderURL,'utf8')).replace("from 'three'",`from '${threeURL.href}'`),{RGBELoader}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const b=await readFile(new URL('../assets/afterrain-light/kloofendal_43d_clear_puresky_2k.hdr',import.meta.url));
const d=new RGBELoader().setDataType(T.FloatType).parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
const l=[];for(let i=0;i<d.data.length;i+=4)l.push(d.data[i]*.2126+d.data[i+1]*.7152+d.data[i+2]*.0722);l.sort((a,b)=>a-b);
console.log({width:d.width,height:d.height,p50:l[Math.floor(l.length*.5)],p90:l[Math.floor(l.length*.9)],p99:l[Math.floor(l.length*.99)],p999:l[Math.floor(l.length*.999)],max:l.at(-1)});
