import {reloadProgress} from './combat-controls.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export function sampleTrack(keys, phase) {
 if (phase <= keys[0][0]) return keys[0].slice(1);
 for (let i = 1; i < keys.length; i++) {
  if (phase > keys[i][0]) continue;
  const a = keys[i - 1], b = keys[i];
  const u = clamp((phase - a[0]) / (b[0] - a[0])), t = u * u * (3 - 2 * u);
  return a.slice(1).map((value, k) => value + (b[k + 1] - value) * t);
 }
 return keys.at(-1).slice(1);
}

// Fixed-length two-bone IK. The pole fixes bend direction at nearly straight
// configurations. Targets outside the physical workspace are clamped, not scaled.
export function solveArm(T, shoulder, homeElbow, homeWrist, requested) {
 const upper = shoulder.distanceTo(homeElbow), lower = homeElbow.distanceTo(homeWrist);
 const axis = requested.clone().sub(shoulder);
 const distance = clamp(axis.length(), Math.abs(upper - lower) + 1e-5, upper + lower - 1e-5);
 if (axis.lengthSq() < 1e-12) axis.copy(homeWrist).sub(shoulder);
 axis.normalize();
 const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
 const height = Math.sqrt(Math.max(0, upper * upper - along * along));
 const pole = homeElbow.clone().sub(shoulder);
 pole.addScaledVector(axis, -pole.dot(axis));
 if (pole.lengthSq() < 1e-10) pole.set(-1, -.5, 0).addScaledVector(axis, axis.x + axis.y * .5);
 pole.normalize();
 const elbow = shoulder.clone().addScaledVector(axis, along).addScaledVector(pole, height);
 const wrist = shoulder.clone().addScaledVector(axis, distance);
 return {elbow, wrist, upper, lower, reachError: wrist.distanceTo(requested)};
}

export function createReloadPose(T, root, magazine) {
 const mesh = root.getObjectByName('source-fabric-articulated-held-arms');
 const rig = mesh?.userData.reloadRig;
 if (!mesh || !rig || !magazine) throw Error('Visible reload needs the retained articulated arm data');
 const position = mesh.geometry.attributes.position, normal = mesh.geometry.attributes.normal;
 position.setUsage(T.DynamicDrawUsage);normal.setUsage(T.DynamicDrawUsage);
 const base = position.array.slice(), baseNormals = normal.array.slice();
 const home = magazine.position.clone(), homeQ = magazine.quaternion.clone();
 const grip = magazine.getObjectByName('MagazineGripSocket') || magazine;
 root.updateWorldMatrix(true, true);
 const contact = mesh.worldToLocal(grip.getWorldPosition(new T.Vector3()));
 const handHome = rig.wrist.clone(), palmOffset = rig.palm.clone().sub(handHome);
 // Palm closes on the left face of the magazine, not at its central axis.
 const magPalm = contact.clone().add(new T.Vector3(-.013, .014, .015));
 const gripTurn = new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2);
 const magWrist = magPalm.clone().sub(palmOffset.clone().applyQuaternion(gripTurn));
 const upperHome = rig.elbow.clone().sub(rig.shoulder).normalize();
 const foreHome = handHome.clone().sub(rig.elbow).normalize();
 const replacement = magazine.clone(true); replacement.name = 'reload-replacement-magazine';
 magazine.parent.add(replacement); replacement.visible = false;
 const qUpper = new T.Quaternion(), qFore = new T.Quaternion(), qHand = new T.Quaternion();
 const v = new T.Vector3(), moved = new T.Vector3(), sum = new T.Vector3();
 let wasActive = false, lastPhase = 0, maximumLengthError = 0;
 let last = {stage: 'held', phase: 0, upperLengthError: 0, foreLengthError: 0, reachError: 0};
 const labels = p => p < .16 ? 'release-support' : p < .28 ? 'grasp-magazine'
  : p < .43 ? 'remove-magazine' : p < .58 ? 'retrieve-replacement'
  : p < .76 ? 'insert-magazine' : p < .86 ? 'seat-magazine' : 'return-to-grip';
 function update(remaining) {
  const active = remaining > 0, phase = reloadProgress(remaining);
  if (!active) {
   if (wasActive) {
    position.array.set(base); normal.array.set(baseNormals);
    position.needsUpdate = normal.needsUpdate = true;
   }
   magazine.position.copy(home); magazine.quaternion.copy(homeQ); magazine.visible = true;
   replacement.visible = false; wasActive = false; lastPhase = 0;
   last = {...last, stage: 'held', phase: 0, wrist: handHome.toArray(), upperLengthError: 0, foreLengthError: 0, reachError: 0};
   return;
  }
  const [pull, side, roll] = sampleTrack([
   [0,0,0,0],[.24,0,0,0],[.40,.18,-.018,-.10],
   [.48,.34,-.035,-.16],[.56,.30,-.018,-.06],
   [.73,0,0,0],[1,0,0,0]
  ], phase);
  magazine.position.copy(home).add(new T.Vector3(side, -pull, 0));
  magazine.quaternion.copy(homeQ).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),roll));
  // Swap while both magazines and the left hand are below the view. A fresh
  // instance returns with the hand; the old magazine never teleports on-screen.
  const newMag = phase >= .50;
  magazine.visible = !newMag || phase >= .76;
  replacement.visible = newMag && phase < .76;
  replacement.position.copy(magazine.position); replacement.quaternion.copy(magazine.quaternion);
  if (phase >= .76) { magazine.position.copy(home); magazine.quaternion.copy(homeQ); }
  const targetTrack = [
   [0,...handHome.toArray()],[.08,...handHome.toArray()],
   [.21,...magWrist.toArray()],
   [.28,magWrist.x,magWrist.y-.035,magWrist.z],
   [.43,magWrist.x-.035,magWrist.y-.25,magWrist.z+.035],
   [.52,magWrist.x-.04,magWrist.y-.32,magWrist.z+.05],
   [.58,magWrist.x-.018,magWrist.y-.27,magWrist.z+.02],
   [.73,...magWrist.toArray()],
   [.79,magWrist.x,magWrist.y+.012,magWrist.z],
   [.85,...magWrist.toArray()],[1,...handHome.toArray()]
  ];
  const target = new T.Vector3(...sampleTrack(targetTrack, phase));
  const solved = solveArm(T, rig.shoulder, rig.elbow, handHome, target);
  qUpper.setFromUnitVectors(upperHome, solved.elbow.clone().sub(rig.shoulder).normalize());
  qFore.setFromUnitVectors(foreHome, solved.wrist.clone().sub(solved.elbow).normalize());
  // Keep the authored hand orientation on the grip/magazine. Fingers travel
  // rigidly with the palm, without scaling or reusing the former stretched arm.
  const [handTurn]=sampleTrack([[0,0],[.06,0],[.21,1],[.85,1],[1,0]],phase);
  qHand.identity().slerp(gripTurn,handTurn);
  qHand.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),roll*.8));
  for (let i = 0; i < position.count; i++) {
   const weights = rig.weights, a = weights[i*3], b = weights[i*3+1], c = weights[i*3+2], weight = a+b+c;
   if (weight < 1e-6) continue;
   v.fromArray(base,i*3); sum.copy(v).multiplyScalar(Math.max(0,1-weight));
   if (a) sum.addScaledVector(moved.copy(v).sub(rig.shoulder).applyQuaternion(qUpper).add(rig.shoulder),a);
   if (b) sum.addScaledVector(moved.copy(v).sub(rig.elbow).applyQuaternion(qFore).add(solved.elbow),b);
   if (c) sum.addScaledVector(moved.copy(v).sub(handHome).applyQuaternion(qHand).add(solved.wrist),c);
   position.setXYZ(i,sum.x,sum.y,sum.z);
   v.fromArray(baseNormals,i*3); sum.copy(v).multiplyScalar(Math.max(0,1-weight));
   if(a)sum.addScaledVector(moved.copy(v).applyQuaternion(qUpper),a);
   if(b)sum.addScaledVector(moved.copy(v).applyQuaternion(qFore),b);
   if(c)sum.addScaledVector(moved.copy(v).applyQuaternion(qHand),c);
   sum.normalize();normal.setXYZ(i,sum.x,sum.y,sum.z);
  }
  position.needsUpdate = normal.needsUpdate = true;
  const upperError = Math.abs(rig.shoulder.distanceTo(solved.elbow)-solved.upper);
  const foreError = Math.abs(solved.elbow.distanceTo(solved.wrist)-solved.lower);
  maximumLengthError = Math.max(maximumLengthError,upperError,foreError);
  last = {stage:labels(phase),phase,wrist:solved.wrist.toArray(),requestedWrist:target.toArray(),
   upperLengthError:upperError,foreLengthError:foreError,reachError:solved.reachError,
   magazineOffset:magazine.position.clone().sub(home).toArray(),replacementVisible:replacement.visible};
  wasActive = true; lastPhase = phase;
 }
 return {update,info(){return {...last,maximumLengthError,lastPhase,
  method:'authored magazine/hand tracks, fixed-length two-bone IK, original arm skin weights on repaired visible mesh',
  anchors:{shoulder:rig.shoulder.toArray(),elbow:rig.elbow.toArray(),wrist:handHome.toArray(),palm:rig.palm.toArray(),magGrip:contact.toArray()},
  sourceRightHandUnchanged:true,sourceAssetsUnchanged:true};},
 dispose(){replacement.removeFromParent();}};
}
