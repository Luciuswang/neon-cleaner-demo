import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function validatePreparedPR(pr,prepared){
 assert.equal(pr.number,prepared.number,'Prepared PR number changed');
 assert.equal(pr.head.sha,prepared.head,'Prepared PR head changed');
 assert.equal(pr.head.repo.full_name,'Luciuswang/neon-cleaner-demo');
 assert.equal(pr.base.repo.full_name,'Luciuswang/neon-cleaner-demo');
 assert.equal(pr.base.ref,'main','Unexpected PR base');
}
export function validateManifest(bytes,prepared){
 assert.equal(sha256(bytes),prepared.manifestSha256,'Manifest differs from prepared artifact');
 const release=JSON.parse(bytes);
 assert.equal(release.sourceCommit,prepared.sourceCommit);
 assert.equal(release.schema,'sunbreak-river-overlay-v1');
 assert.equal(release.publicPath,'sunbreak/river/');
 assert.ok(release.files.length>0&&release.sharedFiles.length>0);
 return release;
}
