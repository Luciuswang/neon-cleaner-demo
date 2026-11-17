// Read-only production validation; writes only its own arm-* evidence report.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),load=p=>readFile(new URL(p,root));
const sha=b=>createHash('sha256').update(b).digest('hex');
const report=JSON.parse(await load('qa/arm-after-report.json')),before=JSON.parse(await load('qa/arm-before-report.json'));
const source=await load('weapon.js'),fixture=await load('qa/arm-before-weapon.js'),provenance=await load('weapon-provenance.json');
const checks=[];
function check(name,pass){checks.push({name,pass:!!pass});assert.ok(pass,name)}
check('report binds current production weapon',report.weaponSHA256===sha(source)&&report.servedSHA256===sha(source));
check('frozen production weapon unchanged',sha(source)==='f85489fad56913d74b90e541d6bbaea98e38c15621f761b34de328506dc44cbe');
check('frozen provenance unchanged',sha(provenance)==='96f686dabe1ec3754c0e1454c5f252af91017c134b2668eb9433a339205ab55c');
check('before fixture is the exact captured original weapon',before.weaponSHA256===sha(fixture));
check('isolated engineering verdict',report.engineeringVerdict==='PASS'&&Object.values(report.engineeringChecks).every(Boolean));
for(const asset of JSON.parse(provenance).files){
 const bytes=await load(asset.path);
 check('immutable source '+asset.path,sha(bytes)===asset.sha256&&bytes.length===asset.bytes&&report.assetHashes[asset.path]===asset.sha256);
}
const update=s=>s.toString().match(/  update\(dt,state\)\{([\s\S]*?)\n  \},/)[1].replace(/\/\/[^\n]*/g,'').replace(/\s/g,'');
check('baseline weapon update code unchanged',update(source)===update(fixture));
check('no production dependency on QA',!source.toString().includes('/qa/')&&!source.toString().includes('arm-before'));
check('rearOffset removed from production',!source.toString().includes('rearOffset'));
check('all four weapon states sampled',['idle','ads','fire','reload-mid'].every(n=>report.samples.some(s=>s.name===n)));
for(const sample of report.samples){
 check('canvas hash '+sample.name,sha(await load('qa/'+sample.path))===sample.sha256);
 check('draw cost and uniform fit '+sample.name,sample.drawCalls===before.samples.find(s=>s.name===sample.name).drawCalls&&sample.info.uniformDisplayScale===1.7);
 check('parent/state/muzzle '+sample.name,sample.parentUnchanged&&sample.stateUnchanged&&sample.muzzleWorldError<1e-6);
}
check('all original UV values within Float32 precision',report.geometry.uv.uv.maxDelta<1e-7&&report.geometry.uv.uv1.maxDelta<1e-7);
check('pure grip and finger tips unchanged',report.geometry.contactMaxVertexDelta<1e-6&&report.geometry.fingerTipMaxVertexDelta<1e-6);
check('rigid cloth edges do not stretch',report.geometry.rigidEdgeMaxRelativeChange<.001);
check('no open/nonmanifold left sleeve',report.geometry.openLeftShoulderEdges===0&&report.geometry.nonManifoldEdges===0);
const topology=report.geometry.topology,sweep=report.sweep;
check('v2 separates source-ring frustum diagnostics from actual defects',report.schema==='sunbreak-arm-native-canvas-v2'&&
 !('maxLeftVisibleBoundary'in sweep)&&sweep.sourceRingDiagnostic.examplesInFrustum.length<=8&&
 sweep.sourceRingDiagnostic.maxOriginalLeftRingVerticesInFrustum<=24&&sweep.sourceRingDiagnostic.maxOriginalLeftRingVerticesInFrustum>0);
check('all 24 original left ring edges sewn with opposite source/closure winding',topology.originalLeftRingAdjacency.length===24&&
 topology.originalLeftRingAdjacency.every(e=>e.incidence===2&&e.sourceFaces===1&&e.closureFaces===1&&e.directionBalance===0));
check('all 120 closure edges have valid adjacency',topology.closureEdges===120&&topology.invalidClosureEdges===0&&topology.invalidSeamEdges===0);
check('displayed vertex links, faces and winding are manifold',topology.nonManifoldVertices.length===0&&topology.inconsistentWindingEdges===0&&
 topology.degenerateWeldedFaces===0&&topology.duplicateFaces===0&&topology.maxWeldSpread<1e-6);
check('one closed orientable left component with Euler characteristic 2',topology.components.filter(c=>c.sides.includes('left')).length===1&&
 topology.components.some(c=>c.sides.length===1&&c.sides[0]==='left'&&c.boundaryEdges===0&&c.eulerCharacteristic===2));
check('remaining 24 right source opening edges are disclosed, unchanged, no unexpected openings',
 topology.actualBoundaryEdges===24&&topology.actualLeftBoundaryEdges===0&&topology.remainingOriginalRightShoulderEdges===24&&
 topology.originalRightBoundaryUnchanged&&topology.unexpectedBoundaryEdges===0&&sweep.unchangedRightOpening.boundaryEdges===24);
check('actual-surface sweep has no defects or left boundary vertices in frustum',sweep.failures.length===0&&
 sweep.actualSurface.openLeftBoundaryEdges===0&&sweep.actualSurface.maxActualLeftBoundaryVerticesInFrustum===0);
check('deleted closure face negative control fails unchanged zero-opening criterion',
 topology.negativeControls.removedClosureFace.openLeftEdges===3&&topology.negativeControls.removedClosureFace.rejectedByZeroDefectCriteria);
check('reversed closure face negative control fails unchanged zero-winding-defect criterion',
 topology.negativeControls.reversedClosureFace.inconsistentWindingEdges===3&&topology.negativeControls.reversedClosureFace.rejectedByZeroDefectCriteria);
check('measured source joint lengths preserved',report.samples[0].info.sleeve.maxJointLengthError<1e-6);
check('only bounded shoulder completion added',report.geometry.addedVertices===25&&report.geometry.addedTriangles===72);
check('1815 bounded numerical states; no continuous review claim',report.sweep.frames===1815&&report.sweep.fullContinuousVisualReview===false);
const result={schema:'sunbreak-arm-verification-v2',verdict:'PASS',checks,weaponSHA256:sha(source),provenanceSHA256:sha(provenance),renderReport:'qa/arm-after-report.json',
 limitations:['Writer LEFT ARM engineering check only; main reports integrated checks23/house47/tactical24 pass; those checks were not rerun by this specialist. Independent Zeno art review remains external.','Original right shoulder has 24 unchanged open edges; some enter the frustum. Their occlusion/exposure is not tested here; no global watertightness or hole-free art claim.','Still samples are not full continuous visual review or a hardware performance benchmark.','Authored mixed wrist/cuff skin blends deform; rigid cloth, source joint lengths and grip contacts are checked separately.']};
await writeFile(new URL('arm-verification.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({verdict:result.verdict,checks:checks.length,weaponSHA256:result.weaponSHA256,provenanceSHA256:result.provenanceSHA256},null,2));
