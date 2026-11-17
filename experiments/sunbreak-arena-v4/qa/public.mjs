// Same actual anonymous-public input harness, with synchronous READ-ONLY state
// from the already published demoQA.snapshot(). The HUD's data-qa mirror refreshes
// every200ms and is not suitable for immediate-release assertions. No hooks,
// injection, runtime mutations, changed delays or weaker assertions.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
if(!process.argv.includes('--phase=public'))throw Error('Public phase required');
const url=new URL('./browser.mjs',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let code=readFileSync(url,'utf8');
const from="({...JSON.parse(document.body.dataset.qa),weapon:JSON.parse(document.body.dataset.render||'{}').weapon})";
const to="({...window.demoQA.snapshot(),weapon:JSON.parse(document.body.dataset.render||'{}').weapon})";
if(code.split(from).length!==2)throw Error('Harness changed; review adapter');
code=code.replace(from,to).replaceAll('import.meta.url',JSON.stringify(url.href));
const adapter={method:'Exact anonymous-public harness using synchronous read-only production snapshot instead of200ms HUD mirror; no runtime mutation, timing or assertion changes',
 source:'qa/public.mjs',sourceSha256:hash(readFileSync(new URL(import.meta.url))),baseSourceSha256:hash(readFileSync(url)),adaptedProgramSha256:hash(code)};
code=code.replace("schema:'sunbreak-auto-browser-v1'","schema:'sunbreak-auto-browser-v1',harnessAdapter:"+JSON.stringify(adapter));
await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
