// Bind a human-readable independent review receipt to the bytes actually reviewed.
// Run only after receiving that review; this script does not review or grant PASS.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {runtimeHashes} from './source-binding.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const review=JSON.parse(await readFile(resolve(root,'qa/downloaded-review-findings.json'),'utf8'));
assert.ok(review.art?.reviewer&&review.art?.received&&review.declaredReviewSet?.length);
assert.equal(new Set(review.declaredReviewSet).size,review.declaredReviewSet.length);
const sources=await runtimeHashes();
const evidence=[];
for(const path of review.declaredReviewSet){
 assert.ok(path.startsWith('qa/evidence/')&&!path.includes('..')&&path.endsWith('.png'));
 const bytes=await readFile(resolve(root,path)),side=await readFile(resolve(root,path.replace(/\.png$/,'.json'))),state=JSON.parse(side);
 assert.deepEqual(state.buildHashes,sources,'Review image is not current source: '+path);
 evidence.push({path,sha256:sha(bytes),stateSHA256:sha(side)});
}
const receipt={...review,sourcesSHA256:sha(JSON.stringify(sources)),evidence,bindingBy:'root integrator after independent visual review; reviewer did not independently hash files',sealedAt:new Date().toISOString()};
await writeFile(resolve(root,'qa/downloaded-review.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({status:receipt.status,reviewedImages:evidence.length,sourcesSHA256:receipt.sourcesSHA256}));
