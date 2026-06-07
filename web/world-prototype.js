import * as THREE from "three";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";

const HIGH_SPLAT_URL = "./worlds/a0-war-signal-500k.spz";
const LOW_SPLAT_URL = "./worlds/a0-war-signal-low.spz";
const SAMPLE_SPLAT_URL = "https://sparkjs.dev/assets/splats/butterfly.spz";
const params = new URLSearchParams(location.search);
const perfMode = params.get("perf") || "balanced";
const maxPixelRatio = perfMode === "high" ? 1.45 : perfMode === "low" ? 0.85 : 1.05;
const maxPursuitDistance = perfMode === "high" ? 168 : perfMode === "low" ? 94 : 128;
const pathScale = perfMode === "high" ? 1.55 : perfMode === "low" ? 1 : 1.28;
const maxSpeed = perfMode === "high" ? 96 : perfMode === "low" ? 62 : 82;

const el = {
  stage: document.querySelector(".world-stage"),
  canvas: document.getElementById("worldCanvas"),
  assetStatus: document.getElementById("assetStatus"),
  pursuitMeter: document.getElementById("pursuitMeter"),
  stabilityMeter: document.getElementById("stabilityMeter"),
  pursuitValue: document.getElementById("pursuitValue"),
  stabilityValue: document.getElementById("stabilityValue"),
  branchReadout: document.getElementById("branchReadout"),
  assetNote: document.getElementById("assetNote"),
  steerLeft: document.getElementById("steerLeft"),
  steerRight: document.getElementById("steerRight"),
  boost: document.getElementById("boost"),
  brake: document.getElementById("brake"),
};

const state = {
  heading: 0,
  speed: 0,
  laneOffset: 0,
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

function mix(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function sampleChasePath(progress) {
  const t = clamp(progress, 0, 1);
  const z = mix(2.2, -38 * pathScale, t);
  const x =
    mix(0.1, -1.8, smoothstep(clamp(t / 0.28, 0, 1))) +
    mix(0, 4.2, smoothstep(clamp((t - 0.24) / 0.44, 0, 1))) +
    mix(0, -2.2, smoothstep(clamp((t - 0.68) / 0.32, 0, 1)));
  const y = mix(0.18, 0.5, smoothstep(t));
  const yaw =
    mix(-0.12, 0.48, smoothstep(clamp((t - 0.18) / 0.5, 0, 1))) -
    mix(0, 0.26, smoothstep(clamp((t - 0.72) / 0.28, 0, 1)));

  return { x, y, z, yaw };
}

async function resolveSplatUrl() {
  const override = params.get("splat");
  if (override) return override;

  if (params.get("sample") === "1") {
    return SAMPLE_SPLAT_URL;
  }

  const quality = params.get("quality");
  const preferredUrls = quality === "low"
    ? [LOW_SPLAT_URL, HIGH_SPLAT_URL]
    : [HIGH_SPLAT_URL, LOW_SPLAT_URL];

  for (const url of preferredUrls) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok) return url;
    } catch {
    }
  }

  return null;
}

async function readAssetSize(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    const size = Number(response.headers.get("content-length"));
    if (Number.isFinite(size) && size > 0) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
  } catch {
  }

  return null;
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
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s"].includes(key)) {
    event.preventDefault();
  }
  if (event.key === "ArrowLeft" || key === "a") state.inputs.add("left");
  if (event.key === "ArrowRight" || key === "d") state.inputs.add("right");
  if (event.key === "ArrowUp" || key === "w") state.inputs.add("boost");
  if (event.key === "ArrowDown" || key === "s") state.inputs.add("brake");
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s"].includes(key)) {
    event.preventDefault();
  }
  if (event.key === "ArrowLeft" || key === "a") state.inputs.delete("left");
  if (event.key === "ArrowRight" || key === "d") state.inputs.delete("right");
  if (event.key === "ArrowUp" || key === "w") state.inputs.delete("boost");
  if (event.key === "ArrowDown" || key === "s") state.inputs.delete("brake");
});

const renderer = new THREE.WebGLRenderer({
  canvas: el.canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x070910, 0.017);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.02, 900);
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

const guide = new THREE.Group();
const guideMaterial = new THREE.MeshBasicMaterial({
  color: 0xff3fb6,
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
});
for (let i = 0; i < 12; i += 1) {
  const marker = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.8), guideMaterial);
  marker.position.set(0, 0.03, -i * 2.4 - 1.4);
  guide.add(marker);
}
guide.visible = true;
scene.add(guide);

const trackRibbon = new THREE.Mesh(
  new THREE.PlaneGeometry(6.2, 72),
  new THREE.MeshBasicMaterial({
    color: 0xff3fb6,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
  }),
);
trackRibbon.rotation.x = -Math.PI / 2;
trackRibbon.position.set(0, 0.025, -16);
scene.add(trackRibbon);

const speedLayer = new THREE.Group();
const speedMarkers = [];
const speedMaterials = [
  new THREE.MeshBasicMaterial({
    color: 0xff3fb6,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  }),
  new THREE.MeshBasicMaterial({
    color: 0x43dfff,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  }),
];
for (let i = 0; i < 42; i += 1) {
  const lane = i % 3 === 0 ? -2.15 : i % 3 === 1 ? 0 : 2.15;
  const length = i % 3 === 1 ? 1.4 : 2.4;
  const marker = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.025, length), speedMaterials[i % 2]);
  marker.userData = {
    lane,
    phase: i * 2.35,
    drift: i % 2 === 0 ? -0.18 : 0.18,
  };
  speedMarkers.push(marker);
  speedLayer.add(marker);
}
scene.add(speedLayer);

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

function makeMaterial(color, emissive = 0x000000, emissiveIntensity = 0.1) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.58,
    metalness: 0.28,
    emissive,
    emissiveIntensity,
  });
}

function createProceduralWarSanFrancisco() {
  const world = new THREE.Group();
  world.name = "procedural-war-san-francisco";

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 360),
    new THREE.MeshStandardMaterial({
      color: 0x11141a,
      roughness: 0.2,
      metalness: 0.45,
      emissive: 0x05060a,
      emissiveIntensity: 0.28,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -84;
  world.add(ground);

  const centerLineMaterial = new THREE.MeshBasicMaterial({
    color: 0xff3fb6,
    transparent: true,
    opacity: 0.36,
  });
  for (let i = 0; i < 28; i += 1) {
    const laneMark = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 3.5), centerLineMaterial);
    laneMark.position.set(0, 0.04, -i * 10 - 6);
    world.add(laneMark);
  }

  const buildingMaterials = [
    makeMaterial(0x161b23, 0x02060c, 0.22),
    makeMaterial(0x20242b, 0x0c0508, 0.18),
    makeMaterial(0x10151d, 0x06131a, 0.26),
  ];

  for (let i = 0; i < 34; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const width = 4 + (i % 4) * 1.2;
    const depth = 6 + (i % 5) * 1.4;
    const height = 7 + ((i * 7) % 18);
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      buildingMaterials[i % buildingMaterials.length],
    );
    building.position.set(side * (17 + (i % 3) * 5), height / 2, -10 - i * 7.4);
    building.rotation.z = i % 7 === 0 ? side * 0.08 : 0;
    world.add(building);

    if (i % 6 === 0) {
      const brokenTop = new THREE.Mesh(
        new THREE.ConeGeometry(width * 0.65, 2.8, 4),
        makeMaterial(0x0b0e13, 0x1e0905, 0.34),
      );
      brokenTop.position.set(building.position.x + side * 0.4, height + 1.0, building.position.z);
      brokenTop.rotation.y = Math.PI * 0.25;
      world.add(brokenTop);
    }
  }

  const railMaterial = makeMaterial(0x262b31, 0x1e0509, 0.16);
  for (let i = 0; i < 9; i += 1) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(15, 0.32, 0.45), railMaterial);
    rail.position.set(-13 + i * 3.3, 7 + Math.sin(i) * 0.4, -58 - i * 4.6);
    rail.rotation.z = i > 5 ? -0.18 : 0.02;
    world.add(rail);
  }

  const towerMaterial = makeMaterial(0x4b1b25, 0x2a0508, 0.35);
  for (const x of [-42, 42]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3.8, 26, 3.8), towerMaterial);
    tower.position.set(x, 13, -132);
    world.add(tower);

    const bridgeTop = new THREE.Mesh(new THREE.BoxGeometry(11, 1.2, 2.8), towerMaterial);
    bridgeTop.position.set(x, 25.5, -132);
    world.add(bridgeTop);
  }
  const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(98, 1.1, 4), towerMaterial);
  bridgeDeck.position.set(0, 5.5, -132);
  bridgeDeck.rotation.z = -0.05;
  world.add(bridgeDeck);

  const cableMaterial = new THREE.MeshBasicMaterial({
    color: 0xff786f,
    transparent: true,
    opacity: 0.38,
  });
  for (let i = 0; i < 12; i += 1) {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 60, 8), cableMaterial);
    cable.position.set(-31 + i * 5.6, 15 + Math.sin(i * 0.5) * 2, -132);
    cable.rotation.z = Math.PI / 2 + (i - 6) * 0.025;
    world.add(cable);
  }

  const smokeMaterial = new THREE.MeshBasicMaterial({
    color: 0x9aa0a7,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  for (let i = 0; i < 18; i += 1) {
    const smoke = new THREE.Mesh(new THREE.SphereGeometry(2.8 + (i % 4), 12, 8), smokeMaterial);
    smoke.position.set(-28 + (i % 6) * 11, 12 + (i % 5) * 4, -38 - i * 8);
    smoke.scale.y = 1.7 + (i % 3) * 0.55;
    world.add(smoke);
  }

  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff3fb6,
    transparent: true,
    opacity: 0.42,
  });
  for (let i = 0; i < 16; i += 1) {
    const ember = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 2.4), glowMaterial);
    ember.position.set(-25 + (i % 8) * 7, 0.2, -18 - i * 9);
    ember.rotation.y = Math.random() * Math.PI;
    world.add(ember);
  }

  const droneMaterial = makeMaterial(0x07090d, 0x43dfff, 0.6);
  for (let i = 0; i < 7; i += 1) {
    const drone = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.75), droneMaterial);
    drone.position.set(-15 + i * 5, 8 + (i % 3) * 2.4, -35 - i * 11);
    drone.rotation.set(0.08 * i, 0.3 * i, 0.12 * i);
    world.add(drone);
  }

  world.position.z = 4;
  return world;
}

const splatUrl = await resolveSplatUrl();
let proceduralWorld = null;
let splat = null;
if (splatUrl) {
  const assetSize = await readAssetSize(splatUrl);
  splat = new SplatMesh({ url: splatUrl });
  if (splatUrl === SAMPLE_SPLAT_URL) {
    splat.quaternion.set(1, 0, 0, 0);
    splat.position.set(0, 3.2, -24);
    splat.scale.setScalar(4.8);
    el.assetStatus.textContent = "Sample SPZ";
    el.assetNote.textContent = "当前是 SparkJS 示例资产，只用于排查渲染问题。正式实验请放入 Marble 导出的旧金山 .spz。";
  } else {
    splat.position.set(0, -0.95, -12);
    splat.scale.setScalar(1);
    const isLow = splatUrl.includes("-low.");
    el.assetStatus.textContent = isLow ? "Marble SPZ low" : "Marble SPZ";
    el.assetNote.textContent = `已加载 Marble 世界资产${assetSize ? `（${assetSize}）` : ""}。当前是短程接管验证：只在可用路段内推进，避免走远后片状破碎。${isLow ? "当前是低清测试版。" : "手机请优先下载 low-res splat 并访问 ?quality=low&perf=low。"}`;
  }
  scene.add(splat);
} else {
  proceduralWorld = createProceduralWarSanFrancisco();
  scene.add(proceduralWorld);
  el.assetStatus.textContent = "本地代理场景";
  el.assetNote.textContent = "还没有 Marble 导出的旧金山 .spz；当前先用本地低模战后旧金山代理场景验证手机和接管手感。";
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
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

  if (!state.complete) {
    el.branchReadout.textContent = `推进 ${pursuit}% / 速度 ${Math.round(state.speed)}`;
  } else {
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

  const driveIntensity = clamp(state.speed / maxSpeed, 0, 1);
  const steeringPower = 0.78 + driveIntensity * 0.7;
  state.heading = clamp(state.heading + steer * dt * steeringPower, -0.86, 0.86);
  state.laneOffset = clamp(state.laneOffset + steer * dt * (3.4 + driveIntensity * 2.2), -1.9, 1.9);
  state.laneOffset = THREE.MathUtils.lerp(state.laneOffset, 0, dt * (0.42 + driveIntensity * 0.45));
  const acceleration = state.inputs.has("boost") ? 58 : -8;
  const braking = state.inputs.has("brake") ? 48 : 0;
  state.speed = clamp(state.speed + acceleration * dt - braking * dt, 0, maxSpeed);
  state.distance = clamp(state.distance + state.speed * dt * 0.58, 0, maxPursuitDistance);
  state.pursuit = clamp((state.distance / maxPursuitDistance) * 100, 0, 100);
  state.stability = clamp(state.stability - Math.abs(steer) * dt * (15 + driveIntensity * 10) - Math.max(0, state.speed - maxSpeed * 0.72) * dt * 0.35 + dt * 2.2, 0, 100);

  if (state.pursuit >= 100 && !state.complete) {
    state.complete = true;
    state.speed = 0;
  }

  const progress = state.distance / maxPursuitDistance;
  const path = sampleChasePath(progress);
  const nextPath = sampleChasePath(clamp(progress + 0.04, 0, 1));
  const tangentYaw = Math.atan2(nextPath.x - path.x, -(nextPath.z - path.z));
  const vehicleX = path.x + state.laneOffset;
  const vehicleZ = path.z;
  const vehicleY = path.y + Math.sin(seconds * 16) * (0.01 + state.speed * 0.0012);
  vehicle.position.x = THREE.MathUtils.lerp(vehicle.position.x, vehicleX, 0.18);
  vehicle.position.y = THREE.MathUtils.lerp(vehicle.position.y, vehicleY, 0.18);
  vehicle.position.z = THREE.MathUtils.lerp(vehicle.position.z, vehicleZ, 0.18);
  vehicle.rotation.y = THREE.MathUtils.lerp(vehicle.rotation.y, tangentYaw - state.heading * 0.22, 0.16);
  vehicle.rotation.z = THREE.MathUtils.lerp(vehicle.rotation.z, -steer * 0.12, 0.18);

  const targetProgress = clamp(progress + 0.25, 0, 1);
  const targetPath = sampleChasePath(targetProgress);
  target.position.x = targetPath.x + Math.sin(seconds * 0.9) * 0.4;
  target.position.y = targetPath.y + 0.12;
  target.position.z = targetPath.z + Math.sin(seconds * 1.4) * 0.2;

  guide.position.x = path.x + state.laneOffset * 0.35;
  guide.position.z = vehicle.position.z - 1.2;
  guide.rotation.y = tangentYaw + state.heading * 0.08;

  trackRibbon.position.x = path.x + state.laneOffset * 0.25;
  trackRibbon.position.z = vehicle.position.z - 18;
  trackRibbon.rotation.y = tangentYaw;
  trackRibbon.material.opacity = 0.06 + driveIntensity * 0.12;

  speedLayer.position.x = path.x + state.laneOffset * 0.12;
  speedLayer.position.y = 0.055;
  speedLayer.position.z = vehicle.position.z;
  speedLayer.rotation.y = tangentYaw;
  for (const marker of speedMarkers) {
    const phase = marker.userData.phase;
    marker.position.x = marker.userData.lane + state.laneOffset * 0.18 + Math.sin(seconds * 1.4 + phase) * marker.userData.drift;
    marker.position.z = -58 + ((phase + state.distance * 2.4) % 72);
    marker.scale.z = 1 + driveIntensity * 2.6;
    marker.visible = driveIntensity > 0.08;
  }
  for (const material of speedMaterials) {
    material.opacity = 0.08 + driveIntensity * 0.28;
  }
  el.stage.dataset.speed = driveIntensity > 0.28 ? "fast" : "idle";

  if (proceduralWorld) {
    proceduralWorld.position.z = 4 + (state.distance % 12) * 0.12;
    proceduralWorld.rotation.y = state.heading * 0.025;
  }

  magentaLight.position.x = vehicle.position.x - 2.5;
  magentaLight.position.z = vehicle.position.z - 1.2;
  cyanLight.position.x = target.position.x + 2.1;
  cyanLight.position.z = target.position.z + 0.2;

  const chaseDistance = 6.2 + driveIntensity * 2.4;
  const camX = vehicle.position.x - Math.sin(tangentYaw) * chaseDistance + state.laneOffset * 0.28;
  const camY = 1.85 + driveIntensity * 1.25;
  const camZ = vehicle.position.z + Math.cos(tangentYaw) * chaseDistance;
  const lookProgress = clamp(progress + 0.14 + driveIntensity * 0.08, 0, 1);
  const lookPath = sampleChasePath(lookProgress);
  camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.2);
  camera.fov = THREE.MathUtils.lerp(camera.fov, Math.min(90, 68 + state.speed * 0.38), 0.12);
  camera.updateProjectionMatrix();
  camera.lookAt(lookPath.x + state.laneOffset * 0.16, 0.92 + driveIntensity * 0.22, lookPath.z);
  camera.rotateZ(-steer * 0.045 - state.laneOffset * 0.012);

  updateHud();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
