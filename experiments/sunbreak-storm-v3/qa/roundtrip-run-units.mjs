// Execute the existing test bodies, redirecting ONLY their output filenames.
// Historical evidence remains byte-identical; imports resolve to actual sources.
import {readFileSync} from 'node:fs';
for(const [name,oldOutput,newOutput]of [
 ['check-house-logic.mjs','house-unit.json','roundtrip-house-unit.json'],
 ['tactical-unit.mjs','tactical-unit.json','roundtrip-ai-unit.json'],
 ['check-weather-audio.mjs','weather-audio-unit.json','roundtrip-weather-audio-unit.json']
]){
 const url=new URL(name,import.meta.url);
 let code=readFileSync(url,'utf8').replaceAll('import.meta.url',JSON.stringify(url.href));
 code=code.replace(/from\s*['"](\.{1,2}\/[^'"]+)['"]/g,(_,s)=>'from '+JSON.stringify(new URL(s,url).href));
 code=code.replaceAll('./'+oldOutput,'./'+newOutput);
 await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
