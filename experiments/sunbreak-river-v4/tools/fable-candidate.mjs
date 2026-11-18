// Bounded tool-free generation. Raw model streams never enter the repository.
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const prompt=await readFile(process.argv[2]||new URL('../brief-fable-compact.md',import.meta.url),'utf8');
const temp=await mkdtemp(join(tmpdir(),'sunbreak-fable-river-'));
const proc=spawn('cmd.exe',['/d','/s','/c','npx --yes --package=@anthropic-ai/claude-code@2.1.326 claude -p --model claude-fable-5-2 --effort low --tools "" --system-prompt "Return concise complete JavaScript only. Do not plan or narrate." --no-session-persistence --output-format stream-json --include-partial-messages --verbose --max-budget-usd 2'],{cwd:temp,windowsHide:true,env:{...process.env,MAX_THINKING_TOKENS:'0',CLAUDE_CODE_MAX_OUTPUT_TOKENS:'8000'},stdio:['pipe','pipe','pipe']});
let stdout='',stderr='';proc.stdout.on('data',d=>stdout+=d);proc.stderr.on('data',d=>stderr+=d);proc.stdin.end(prompt);
const code=await new Promise((r,j)=>{proc.once('error',j);proc.once('exit',r)});
let result,visible=[],partials=[],types={};try{const messages=stdout.split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s));result=messages.findLast(m=>m.type==='result');const seen=new Set();for(const m of messages){types[m.type]=(types[m.type]||0)+1;if(m.type==='stream_event'&&m.event?.delta?.type==='text_delta')partials.push(m.event.delta.text);if(m.type==='assistant')for(const c of m.message.content)if(c.type==='text'){const key=m.message.id+'\n'+c.text;if(!seen.has(key)){seen.add(key);visible.push(c.text)}}}}catch{throw Error('Invalid generation response; raw output withheld, exit '+code)}
if(code||result.is_error){console.log(JSON.stringify({failed:true,models:Object.keys(result.modelUsage||{}),costUSD:result.total_cost_usd,error:String(result.result).slice(0,1000)}));throw Error('Generation failed; no candidate applied')}
const source=(partials.length?partials.join(''):visible.length?visible.join(''):result.result).replace(/^```(?:javascript|js)?\s*\n/,'').replace(/\n```\s*$/,'');
await writeFile(join(temp,'village.js'),source);
const receipt={requested:'claude-fable-5-2',reportedModels:Object.keys(result.modelUsage||{}),cli:'2.1.326',costUSD:result.total_cost_usd,billingIndependentlyVerified:false,tools:[],sourceBytes:Buffer.byteLength(source),types,visibleBlocks:visible.length,textDeltas:partials.length,resultTextLength:result.result?.length,candidatePath:join(temp,'village.js')};
await writeFile(join(temp,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
