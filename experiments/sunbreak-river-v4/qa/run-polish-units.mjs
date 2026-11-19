import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {runtimeHashes} from './source-binding.mjs';
import assert from 'node:assert/strict';
const sha=b=>createHash('sha256').update(b).digest('hex');
const names=['map-checks','terrain-rays','ai-movement','village-checks','fracture-checks','buffer-checks','landscape-checks','riverbank-checks','afterrain-assets-checks','vegetation-clumps','water-checks','wildbank-checks','surface-checks','masonry-materials-checks','height-fog-checks','downloaded-dressing-checks','environment-polish-checks','shot-feedback-event-checks','polish-preservation-checks','stone-cover-checks','combat-feedback-checks'];
const modes={'map-checks':['--polish'],'masonry-materials-checks':['--polish']};
const required=21;
assert.equal(names.length,required,'all 21 current suites required');
assert.equal(new Set(names).size,required,'no duplicated suite can replace a required suite');
// Retain the previous report verbatim as data (including all failures and source
// drift). Do not relabel old failures as passes when the new contracts are run.
const reportFile=new URL('polish-units.json',import.meta.url);
let previousReport=null;
try{const bytes=await readFile(reportFile);previousReport={sha256:sha(bytes),report:JSON.parse(bytes)}}catch(error){if(error.code!=='ENOENT')throw error}
const units={},sources=await runtimeHashes();
for(const name of names){
 const file=new URL(name+'.mjs',import.meta.url),args=['--stdout-only',...(modes[name]||[])];
 try{
  const before=sha(await readFile(file)),r=spawnSync(process.execPath,[fileURLToPath(file),...args],{encoding:'utf8',windowsHide:true,maxBuffer:15e6});
  let result;try{result=JSON.parse(r.stdout)}catch{result={stdout:r.stdout}}
  const testUnchanged=before===sha(await readFile(file));
  // Several original suites print Node object inspection instead of JSON; their
  // assertions/exit code remain authoritative. No output or an explicit JSON
  // failure is never accepted, even if a buggy suite exits zero.
  const reportedFailure=result?.pass===false||result?.verdict==='FAIL';
  const pass=r.status===0&&!r.error&&!r.signal&&!!r.stdout?.trim()&&testUnchanged&&!reportedFailure;
  units[name]={pass,exit:r.status,signal:r.signal,testSHA256:before,testUnchanged,args,result,error:r.error?.stack||r.stderr,classification:'required'};
 }catch(error){units[name]={pass:false,exit:null,args,error:error.stack,classification:'required'}}
 console.log(name+': '+(units[name].pass?'PASS':'FAIL'));
}
const unchanged=JSON.stringify(sources)===JSON.stringify(await runtimeHashes());
const pass=unchanged&&Object.keys(units).length===required&&names.every(name=>units[name]?.pass===true);
await writeFile(reportFile,JSON.stringify({schema:'river-material-polish-cpu-v2',date:new Date().toISOString(),pass,unchanged,required,sources,units,previousReport},null,2)+'\n');
console.log(JSON.stringify({pass,unchanged,required,passed:names.filter(name=>units[name]?.pass).length,failed:names.filter(name=>!units[name]?.pass)}));if(!pass)process.exitCode=1;
