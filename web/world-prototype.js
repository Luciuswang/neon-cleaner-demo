import * as THREE from "three";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";

const LOCAL_SPLAT_URL = "./worlds/a0-war-signal-500k.spz";
const SAMPLE_SPLAT_URL = "https://sparkjs.dev/assets/splats/butterfly.spz";

const el = {
  canvas: document.getElementById("worldCanvas"),
  assetStatus: document.getElementById("assetStatus"),
  pursuitMeter: document.getElementById("pursuitMeter"),
  stabilityMeter: document.getElementById("stabilityMeter"),
  pursuitValue: document.getElementById("pursuitValue"),
  stabilityValue: document.getElementById("stabilityValue"),
  branchReadout: document.getElementById("branchReadout"),
  steerLeft: document.getElementById("steerLeft"),
  steerRight: document.getElementById("steerRight"),
  boost: document.getElementById("boost"),
  brake: document.getElementById("brake"),
};

const state = {
  heading: 0,
  speed: 11,
  pursuit: 0,
  stability: 100,
  distance: 0,
  lastTime: 0,
  complete: false,
  inputs: new Set(),
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function resolveSplatUrl() {
  const override = new URLSearchParams(location.search).get("splat");
  if (override) return override;

  try {
    const response = await fetch(LOCAL_SPLAT_URL, { method: "HEAD" });
    if (response.ok) return LOCAL_SPLAT_URL;
  } catch {
  }

  return SAMPLE_SPLAT_URL;
}

function setButtonActive(button, isActive) {
  button.dataset.active = isActive ? "true" : "false";
}

function bindHold(button, key) {
  const start = (event) => {
    event.preventDefault();
    state.inputs.add(key);
    setButtonActive(button, true);
  };
  const end = (event) => {
    event.preventDefault();
    state.inputs.delete(key);
    setButtonActive(button, false);
  };

  button.addEventListener("pointerdown", start);
  button.addEventListener("pointerup", end);
  button.addEventListener("pointercancel", end);
  button.addEventListener("pointerleave", end);
}

bindHold(el.steerLeft, "left");
bindHold(el.steerRight, "right");
bindHold(el.boost, "boost");
bindHold(el.brake, "brake");

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") state.inputs.add("left");
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") state.inputs.add("right");
  if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") state.inputs.add("boost");
  if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") state.inputs.add("brake");
});

window.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") state.inputs.delete("left");
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") state.inputs.delete("right");
  if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") state.inputs.delete("boost");
  if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") state.inputs.delete("brake");
});

const renderer = new THREE.WebGLRenderer({
  canvas: el.canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x070910, 0.017);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.02, 900);
camera.position.set(0, 4.3, 12);

const spark = new SparkRenderer({ renderer });
scene.add(spark);

const rig = new THREE.Group();
scene.add(rig);

const vehicle = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.BoxGeometry(1.25, 0.38, 2.45),
  new THREE.MeshStandardMaterial({
    color: 0x131923,
    roughness: 0.42,
    metalness: 0.58,
    emissive: 0x240017,
    emissiveIntensity: 0.5,
  }),
);
const cabin = new THREE.Mesh(
  new THREE.BoxGeometry(0.92, 0.34, 0.98),
  new THREE.MeshStandardMaterial({
    color: 0x2f1329,
    roughness: 0.28,
    metalness: 0.76,
    emissive: 0xff3fb6,
    emissiveIntensity: 0.24,
  }),
);
cabin.position.set(0, 0.3, -0.16);
vehicle.add(body, cabin);
vehicle.position.set(0, 0.42, 2.2);
scene.add(vehicle);

const road = new THREE.Group();
for (let i = 0; i < 34; i += 1) {
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(i % 5 === 0 ? 9.5 : 0.08, 0.02, 0.85),
    new THREE.MeshBasicMaterial({
      color: i % 5 === 0 ? 0xff3fb6 : 0x43dfff,
      transparent: true,
      opacity: i % 5 === 0 ? 0.18 : 0.26,
    }),
  );
  strip.position.set(i % 5 === 0 ? 0 : (i % 2 ? -3.2 : 3.2), 0.02, -i * 8);
  road.add(strip);
}
scene.add(road);

const target = new THREE.Mesh(
  new THREE.BoxGeometry(1.45, 0.5, 2.7),
  new THREE.MeshStandardMaterial({
    color: 0x07090d,
    roughness: 0.36,
    metalness: 0.72,
    emissive: 0x123344,
    emissiveIntensity: 0.7,
  }),
);
target.position.set(1.6, 0.52, -28);
scene.add(target);

const hemi = new THREE.HemisphereLight(0x9fc7ff, 0x0a0208, 1.1);
scene.add(hemi);

const magentaLight = new THREE.PointLight(0xff3fb6, 5, 26);
magentaLight.position.set(-2.8, 3.4, 0);
scene.add(magentaLight);

const cyanLight = new THREE.PointLight(0x43dfff, 4, 30);
cyanLight.position.set(4, 4.5, -18);
scene.add(cyanLight);

const splatUrl = await resolveSplatUrl();
const splat = new SplatMesh({ url: splatUrl });
if (splatUrl === SAMPLE_SPLAT_URL) {
  splat.quaternion.set(1, 0, 0, 0);
  splat.position.set(0, 3.2, -24);
  splat.scale.setScalar(4.8);
  el.assetStatus.textContent = "Sample SPZ";
} else {
  splat.position.set(0, -1.2, -12);
  splat.scale.setScalar(1);
  el.assetStatus.textContent = "Marble SPZ";
}
scene.add(splat);

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", resize);

function updateHud() {
  const pursuit = Math.round(clamp(state.pursuit, 0, 100));
  const stability = Math.round(clamp(state.stability, 0, 100));
  el.pursuitMeter.style.width = `${pursuit}%`;
  el.stabilityMeter.style.width = `${stability}%`;
  el.pursuitValue.textContent = pursuit;
  el.stabilityValue.textContent = stability;

  if (state.complete) {
    if (state.pursuit > 86 && state.stability > 68) {
      el.branchReadout.textContent = "C1 / Clean Pursuit";
    } else if (state.pursuit > 62 && state.stability > 36) {
      el.branchReadout.textContent = "C2 / Damaged Pursuit";
    } else {
      el.branchReadout.textContent = "C3 / Lost Trail";
    }
  }
}

function animate(time) {
  const seconds = time * 0.001;
  const dt = Math.min(0.05, state.lastTime ? seconds - state.lastTime : 0.016);
  state.lastTime = seconds;

  const steer = Number(state.inputs.has("right")) - Number(state.inputs.has("left"));
  const throttle = Number(state.inputs.has("boost")) - Number(state.inputs.has("brake"));

  state.heading += steer * dt * 0.82;
  state.speed = clamp(state.speed + throttle * dt * 12 - dt * 0.7, 4.5, 24);
  state.distance += state.speed * dt;
  state.pursuit = clamp(state.pursuit + (state.speed - 8) * dt * 0.62, 0, 100);
  state.stability = clamp(state.stability - Math.abs(steer) * dt * (state.speed * 0.9) + dt * 3.2, 0, 100);

  if (state.pursuit >= 100 && !state.complete) {
    state.complete = true;
    state.speed = Math.min(state.speed, 12);
  }

  const lateral = Math.sin(state.heading) * 3.4;
  vehicle.position.x = THREE.MathUtils.lerp(vehicle.position.x, lateral, 0.14);
  vehicle.position.y = 0.42 + Math.sin(seconds * 10) * 0.025;
  vehicle.rotation.y = THREE.MathUtils.lerp(vehicle.rotation.y, -state.heading * 0.55, 0.12);
  vehicle.rotation.z = THREE.MathUtils.lerp(vehicle.rotation.z, -steer * 0.08, 0.16);

  target.position.x = Math.sin(seconds * 0.9) * 1.8;
  target.position.z = -28 - state.pursuit * 0.26 + Math.sin(seconds * 1.4) * 0.7;

  road.position.z = (state.distance % 8) * 1.8;
  road.rotation.y = state.heading * 0.08;

  magentaLight.position.x = vehicle.position.x - 2.5;
  magentaLight.position.z = vehicle.position.z - 1.2;
  cyanLight.position.x = target.position.x + 2.1;
  cyanLight.position.z = target.position.z + 0.2;

  const camX = vehicle.position.x * 0.52;
  const camY = 3.8 + state.speed * 0.018;
  const camZ = 10.5 - state.speed * 0.04;
  camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.08);
  camera.lookAt(vehicle.position.x * 0.32, 1.1, -16 - state.pursuit * 0.06);

  updateHud();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
