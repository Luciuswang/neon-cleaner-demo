import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";

const HIGH_SPLAT_URL = "./worlds/a0-war-signal-500k.spz";
const LOW_SPLAT_URL = "./worlds/a0-war-signal-low.spz";
const SAMPLE_SPLAT_URL = "https://sparkjs.dev/assets/splats/butterfly.spz";
const params = new URLSearchParams(location.search);
const isPrewarm = params.get("prewarm") === "1";
const perfMode = params.get("perf") || "balanced";
const maxPixelRatio = perfMode === "high" ? 1.45 : perfMode === "low" ? 0.85 : 1.05;
const maxPursuitDistance = perfMode === "high" ? 168 : perfMode === "low" ? 94 : 128;
const pathScale = perfMode === "high" ? 1.55 : perfMode === "low" ? 1 : 1.28;
const maxSpeed = perfMode === "high" ? 96 : perfMode === "low" ? 62 : 82;
const cameraMode = params.get("camera") || "first";
const usePostProcessing = params.get("post") !== "0" && perfMode !== "low";
const vfxDensity = perfMode === "high" ? 1 : perfMode === "low" ? 0.55 : 0.78;
const cockpitModelUrl = params.get("cockpit") || "./models/player-cockpit.glb";
const enemyModelUrl = params.get("enemy") || "./models/enemy-car.glb";
const cockpitModelScale = Number(params.get("cockpitScale")) || 1;
const enemyModelScale = Number(params.get("enemyScale")) || 1;

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

if (isPrewarm) {
  document.body.dataset.prewarm = "true";
}

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  if (event.data?.type !== "neon-world-activate") return;
  document.body.dataset.prewarm = "false";
  window.focus();
});

const state = {
  heading: 0,
  speed: 0,
  laneOffset: 0,
  pursuit: 0,
  stability: 100,
  distance: 0,
  impact: 0,
  lastTime: 0,
  complete: false,
  inputs: new Set(),
  firstFramePosted: false,
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

function sampleRoadWidth(progress) {
  const t = clamp(progress, 0, 1);
  return mix(1.28, 1.82, smoothstep(clamp((t - 0.12) / 0.28, 0, 1))) -
    mix(0, 0.36, smoothstep(clamp((t - 0.62) / 0.28, 0, 1)));
}

function samplePathBasis(progress) {
  const path = sampleChasePath(progress);
  const nextPath = sampleChasePath(clamp(progress + 0.035, 0, 1));
  const dx = nextPath.x - path.x;
  const dz = nextPath.z - path.z;
  const length = Math.hypot(dx, dz) || 1;
  const forwardX = dx / length;
  const forwardZ = dz / length;

  return {
    path,
    forwardX,
    forwardZ,
    rightX: -forwardZ,
    rightZ: forwardX,
    yaw: Math.atan2(forwardX, -forwardZ),
  };
}

function createLowPolyCar({
  bodyColor = 0x111722,
  cabinColor = 0x1d2631,
  accentColor = 0xff3fb6,
  headlightColor = 0x43dfff,
} = {}) {
  const car = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.36,
    metalness: 0.62,
    emissive: accentColor,
    emissiveIntensity: 0.08,
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: cabinColor,
    roughness: 0.22,
    metalness: 0.72,
    emissive: headlightColor,
    emissiveIntensity: 0.16,
  });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: accentColor,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  const cyanMaterial = new THREE.MeshBasicMaterial({
    color: headlightColor,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
  });
  const tireMaterial = new THREE.MeshStandardMaterial({
    color: 0x050608,
    roughness: 0.72,
    metalness: 0.18,
  });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.28, 2.55), bodyMaterial);
  chassis.position.y = 0.26;
  car.add(chassis);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.18, 0.92), bodyMaterial);
  nose.position.set(0, 0.32, -0.98);
  nose.rotation.x = -0.08;
  car.add(nose);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.46, 0.78), glassMaterial);
  cabin.position.set(0, 0.64, -0.12);
  cabin.rotation.x = -0.05;
  car.add(cabin);

  const rear = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 0.62), bodyMaterial);
  rear.position.set(0, 0.43, 0.94);
  car.add(rear);

  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.2), glowMaterial);
  spoiler.position.set(0, 0.76, 1.18);
  car.add(spoiler);

  for (const x of [-0.82, 0.82]) {
    for (const z of [-0.86, 0.86]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 18), tireMaterial);
      wheel.position.set(x, 0.15, z);
      wheel.rotation.z = Math.PI / 2;
      car.add(wheel);
    }
  }

  for (const x of [-0.42, 0.42]) {
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.035), cyanMaterial);
    headlight.position.set(x, 0.37, -1.32);
    car.add(headlight);

    const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.035), glowMaterial);
    tailLight.position.set(x, 0.38, 1.32);
    car.add(tailLight);
  }

  car.userData.glowMaterial = glowMaterial;
  car.userData.cyanMaterial = cyanMaterial;
  return car;
}

function createCockpitHoodGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([
      -1.46, -0.18, 0.16,
      1.46, -0.18, 0.16,
      0.78, 0.07, -1.52,
      -0.78, 0.07, -1.52,
    ], 3),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

function setGroupChildrenVisible(group, visible) {
  for (const child of group.children) {
    child.visible = visible;
  }
}

function prepareImportedModel(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.frustumCulled = false;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      material.side = material.side ?? THREE.FrontSide;
      material.needsUpdate = true;
    }
  });
}

async function urlExists(url) {
  if (!url || url === "0" || url === "false") return false;
  try {
    const response = await fetch(url, { method: "HEAD", cache: "no-cache" });
    return response.ok;
  } catch {
    return false;
  }
}

async function attachOptionalGlb({
  url,
  parent,
  hideFallback = true,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}) {
  if (!(await urlExists(url))) return null;

  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    const root = gltf.scene;
    prepareImportedModel(root);
    root.position.set(...position);
    root.rotation.set(...rotation);
    root.scale.setScalar(scale);

    if (hideFallback) {
      setGroupChildrenVisible(parent, false);
    }
    parent.add(root);
    return root;
  } catch (error) {
    console.warn(`Could not load GLB model from ${url}`, error);
    return null;
  }
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
scene.add(camera);

let composer = null;
let bloomPass = null;
if (usePostProcessing) {
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.26,
    0.32,
    0.86,
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
}

const spark = new SparkRenderer({ renderer });
scene.add(spark);

const rig = new THREE.Group();
scene.add(rig);

const vehicle = createLowPolyCar({
  bodyColor: 0x121823,
  cabinColor: 0x182334,
  accentColor: 0xff3fb6,
  headlightColor: 0x43dfff,
});
vehicle.position.set(0, 0.42, 2.2);
vehicle.visible = cameraMode !== "first";
scene.add(vehicle);

const cockpit = new THREE.Group();
cockpit.visible = cameraMode === "first";
const hood = new THREE.Mesh(
  createCockpitHoodGeometry(),
  new THREE.MeshBasicMaterial({
    color: 0x120812,
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),
);
hood.position.set(0, -0.68, -0.86);
hood.rotation.x = -0.06;
const hoodGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(1.42, 0.055),
  new THREE.MeshBasicMaterial({
    color: 0xff3fb6,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  }),
);
hoodGlow.position.set(0, -0.55, -2.18);
hoodGlow.rotation.x = -0.36;
const windshieldLine = new THREE.Mesh(
  new THREE.PlaneGeometry(1.76, 0.032),
  new THREE.MeshBasicMaterial({
    color: 0x43dfff,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  }),
);
windshieldLine.position.set(0, -0.29, -2.34);
windshieldLine.rotation.x = -0.44;
cockpit.add(hood, hoodGlow, windshieldLine);
camera.add(cockpit);

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

const boundaryLayer = new THREE.Group();
const boundaryMarkers = [];
const boundaryMaterials = [
  new THREE.MeshBasicMaterial({
    color: 0xff3fb6,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  }),
  new THREE.MeshBasicMaterial({
    color: 0x43dfff,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  }),
];
for (let i = 0; i < 24; i += 1) {
  for (const side of [-1, 1]) {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.72), boundaryMaterials[side > 0 ? 1 : 0]);
    marker.userData = { index: i, side };
    boundaryMarkers.push(marker);
    boundaryLayer.add(marker);
  }
}
scene.add(boundaryLayer);

const target = createLowPolyCar({
  bodyColor: 0x07090d,
  cabinColor: 0x111c22,
  accentColor: 0xff3fb6,
  headlightColor: 0x43dfff,
});
target.scale.setScalar(1.08);
target.position.set(1.6, 0.52, -28);
scene.add(target);

attachOptionalGlb({
  url: cockpitModelUrl,
  parent: cockpit,
  hideFallback: true,
  position: [0, -0.58, -1.18],
  rotation: [0, 0, 0],
  scale: cockpitModelScale,
});

attachOptionalGlb({
  url: enemyModelUrl,
  parent: target,
  hideFallback: true,
  position: [0, -0.08, 0],
  rotation: [0, 0, 0],
  scale: enemyModelScale,
});

const hemi = new THREE.HemisphereLight(0x9fc7ff, 0x0a0208, 1.1);
scene.add(hemi);

const magentaLight = new THREE.PointLight(0xff3fb6, 5, 26);
magentaLight.position.set(-2.8, 3.4, 0);
scene.add(magentaLight);

const cyanLight = new THREE.PointLight(0x43dfff, 4, 30);
cyanLight.position.set(4, 4.5, -18);
scene.add(cyanLight);

const vfxLayer = new THREE.Group();
scene.add(vfxLayer);

const vfxDirector = {
  sparks: [],
  explosions: [],
  shockwaves: [],
  smoke: [],
  flash: 0,
  lastWallSparkAt: -10,
  lastExplosionAt: -10,
  firstBlastDone: false,
  sparkGeometry: new THREE.BoxGeometry(0.045, 0.045, 0.34),
  emberGeometry: new THREE.BoxGeometry(0.08, 0.08, 0.72),
  burstGeometry: new THREE.SphereGeometry(1, 18, 10),
  smokeGeometry: new THREE.SphereGeometry(1, 14, 8),
  shockwaveGeometry: new THREE.RingGeometry(0.45, 0.62, 48),
  sparkMaterials: [
    new THREE.MeshBasicMaterial({ color: 0xffca5f, transparent: true, opacity: 1, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xff3fb6, transparent: true, opacity: 1, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0x43dfff, transparent: true, opacity: 1, depthWrite: false }),
  ],
  spawnWallImpact(origin, basis, side, intensity, seconds) {
    if (seconds - this.lastWallSparkAt < 0.12) return;
    this.lastWallSparkAt = seconds;
    this.flash = Math.max(this.flash, 0.38 + intensity * 0.38);

    const count = Math.round((10 + intensity * 18) * vfxDensity);
    for (let i = 0; i < count; i += 1) {
      const material = this.sparkMaterials[i % this.sparkMaterials.length].clone();
      const mesh = new THREE.Mesh(this.sparkGeometry, material);
      mesh.position.copy(origin);
      mesh.position.y += 0.08 + Math.random() * 0.22;
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      vfxLayer.add(mesh);
      this.sparks.push({
        mesh,
        material,
        age: 0,
        life: 0.28 + Math.random() * 0.28,
        spin: (Math.random() - 0.5) * 10,
        velocity: new THREE.Vector3(
          basis.rightX * side * (1.2 + Math.random() * 2.2) + basis.forwardX * (Math.random() - 0.5) * 1.2,
          0.55 + Math.random() * 1.9,
          basis.rightZ * side * (1.2 + Math.random() * 2.2) + basis.forwardZ * (Math.random() - 0.5) * 1.2,
        ),
      });
    }

    this.spawnShockwave(origin, 0xff3fb6, 0.42 + intensity * 0.16, 1.8 + intensity * 1.2);
  },
  spawnExplosion(origin, basis, intensity = 1) {
    this.lastExplosionAt = performance.now() * 0.001;
    this.flash = Math.max(this.flash, 0.5);

    const burstMaterial = new THREE.MeshBasicMaterial({
      color: 0xff7a2f,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const burst = new THREE.Mesh(this.burstGeometry, burstMaterial);
    burst.position.copy(origin);
    burst.position.y += 0.68;
    vfxLayer.add(burst);

    const light = new THREE.PointLight(0xff8844, 9 * intensity, 18 + intensity * 8);
    light.position.copy(burst.position);
    vfxLayer.add(light);

    this.explosions.push({
      burst,
      burstMaterial,
      light,
      age: 0,
      life: 0.86,
      intensity,
      baseScale: 0.42 + intensity * 0.26,
    });

    this.spawnShockwave(origin, 0xffca5f, 0.6, 3.2 + intensity * 1.6);

    for (let i = 0; i < Math.round(18 * vfxDensity); i += 1) {
      const material = this.sparkMaterials[i % 2].clone();
      const ember = new THREE.Mesh(this.emberGeometry, material);
      ember.position.copy(origin);
      ember.position.y += 0.35 + Math.random() * 0.5;
      ember.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      vfxLayer.add(ember);
      this.sparks.push({
        mesh: ember,
        material,
        age: 0,
        life: 0.55 + Math.random() * 0.45,
        spin: (Math.random() - 0.5) * 12,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 5 + basis.rightX * (Math.random() - 0.5) * 2,
          1.1 + Math.random() * 3.2,
          (Math.random() - 0.5) * 5 + basis.forwardZ * (Math.random() - 0.5) * 2,
        ),
      });
    }

    for (let i = 0; i < Math.max(2, Math.round(5 * vfxDensity)); i += 1) {
      const smokeMaterial = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x6f7480 : 0x33272c,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      });
      const puff = new THREE.Mesh(this.smokeGeometry, smokeMaterial);
      puff.position.copy(origin);
      puff.position.x += (Math.random() - 0.5) * 1.5;
      puff.position.y += 0.75 + Math.random() * 1.1;
      puff.position.z += (Math.random() - 0.5) * 1.5;
      vfxLayer.add(puff);
      this.smoke.push({
        puff,
        material: smokeMaterial,
        age: 0,
        life: 1.8 + Math.random() * 0.7,
        drift: new THREE.Vector3((Math.random() - 0.5) * 0.45, 0.32 + Math.random() * 0.28, -0.25 - Math.random() * 0.3),
        scale: 0.5 + Math.random() * 0.35,
      });
    }
  },
  spawnShockwave(origin, color, opacity, radius) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(this.shockwaveGeometry, material);
    ring.position.copy(origin);
    ring.position.y = Math.max(0.08, origin.y + 0.05);
    ring.rotation.x = -Math.PI / 2;
    vfxLayer.add(ring);
    this.shockwaves.push({ ring, material, age: 0, life: 0.58, radius });
  },
  maybeSpawnAmbientExplosion(progress, basis, speed, seconds) {
    const driveIntensity = clamp(speed / maxSpeed, 0, 1);
    if (!this.firstBlastDone && progress > 0.07 && speed > maxSpeed * 0.12) {
      this.firstBlastDone = true;
      const firstBasis = samplePathBasis(clamp(progress + 0.18, 0, 1));
      const firstSide = state.laneOffset >= 0 ? 1 : -1;
      const firstWidth = sampleRoadWidth(progress) + 2.15;
      this.spawnExplosion(
        new THREE.Vector3(
          firstBasis.path.x + firstBasis.rightX * firstWidth * firstSide,
          firstBasis.path.y,
          firstBasis.path.z + firstBasis.rightZ * firstWidth * firstSide,
        ),
        basis,
        1.08,
      );
      return;
    }
    if (speed < maxSpeed * 0.14 || seconds - this.lastExplosionAt < 1.35 + (1 - driveIntensity) * 0.65) return;
    if (Math.random() > 0.16 * vfxDensity + driveIntensity * 0.26) return;

    const blastProgress = clamp(progress + 0.2 + Math.random() * 0.18, 0, 1);
    const blastBasis = samplePathBasis(blastProgress);
    const side = Math.random() > 0.5 ? 1 : -1;
    const width = sampleRoadWidth(blastProgress) + 1.8 + Math.random() * 1.5;
    const origin = new THREE.Vector3(
      blastBasis.path.x + blastBasis.rightX * width * side,
      blastBasis.path.y,
      blastBasis.path.z + blastBasis.rightZ * width * side,
    );
    this.spawnExplosion(origin, basis, 0.78 + Math.random() * 0.45);
  },
  update(dt, driveIntensity) {
    this.flash = Math.max(0, this.flash - dt * 1.85);

    for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
      const spark = this.sparks[i];
      spark.age += dt;
      spark.velocity.y -= dt * 4.8;
      spark.mesh.position.addScaledVector(spark.velocity, dt);
      spark.mesh.rotation.x += spark.spin * dt;
      spark.mesh.rotation.z -= spark.spin * dt * 0.7;
      spark.material.opacity = clamp(1 - spark.age / spark.life, 0, 1);
      spark.mesh.scale.setScalar(1 + driveIntensity * 0.4);
      if (spark.age >= spark.life) {
        vfxLayer.remove(spark.mesh);
        spark.material.dispose();
        this.sparks.splice(i, 1);
      }
    }

    for (let i = this.explosions.length - 1; i >= 0; i -= 1) {
      const explosion = this.explosions[i];
      explosion.age += dt;
      const t = clamp(explosion.age / explosion.life, 0, 1);
      const scale = explosion.baseScale + t * (2.6 + explosion.intensity * 1.2);
      explosion.burst.scale.setScalar(scale);
      explosion.burstMaterial.opacity = (1 - t) * 0.78;
      explosion.light.intensity = (1 - t) * 10 * explosion.intensity;
      if (explosion.age >= explosion.life) {
        vfxLayer.remove(explosion.burst);
        vfxLayer.remove(explosion.light);
        explosion.burstMaterial.dispose();
        this.explosions.splice(i, 1);
      }
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i -= 1) {
      const shockwave = this.shockwaves[i];
      shockwave.age += dt;
      const t = clamp(shockwave.age / shockwave.life, 0, 1);
      shockwave.ring.scale.setScalar(1 + t * shockwave.radius);
      shockwave.material.opacity = (1 - t) * 0.58;
      if (shockwave.age >= shockwave.life) {
        vfxLayer.remove(shockwave.ring);
        shockwave.material.dispose();
        this.shockwaves.splice(i, 1);
      }
    }

    for (let i = this.smoke.length - 1; i >= 0; i -= 1) {
      const smoke = this.smoke[i];
      smoke.age += dt;
      const t = clamp(smoke.age / smoke.life, 0, 1);
      smoke.puff.position.addScaledVector(smoke.drift, dt);
      smoke.puff.scale.setScalar(smoke.scale + t * 2.2);
      smoke.material.opacity = (1 - t) * 0.22;
      if (smoke.age >= smoke.life) {
        vfxLayer.remove(smoke.puff);
        smoke.material.dispose();
        this.smoke.splice(i, 1);
      }
    }
  },
};

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
  if (composer) {
    composer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    composer.setSize(window.innerWidth, window.innerHeight);
  }
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
    const modeName = cameraMode === "chase" ? "追车视角" : "第一人称";
    el.branchReadout.textContent = `${modeName} / 推进 ${pursuit}% / 速度 ${Math.round(state.speed)}`;
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

  let driveIntensity = clamp(state.speed / maxSpeed, 0, 1);
  const steeringPower = 0.78 + driveIntensity * 0.7;
  state.heading = clamp(state.heading + steer * dt * steeringPower, -0.86, 0.86);
  state.laneOffset = clamp(state.laneOffset + steer * dt * (4.4 + driveIntensity * 3.6), -2.85, 2.85);
  state.laneOffset = THREE.MathUtils.lerp(state.laneOffset, 0, dt * (0.22 + driveIntensity * 0.28));
  const acceleration = state.inputs.has("boost") ? 58 : -8;
  const braking = state.inputs.has("brake") ? 48 : 0;
  state.speed = clamp(state.speed + acceleration * dt - braking * dt, 0, maxSpeed);
  state.distance = clamp(state.distance + state.speed * dt * 0.58, 0, maxPursuitDistance);
  state.pursuit = clamp((state.distance / maxPursuitDistance) * 100, 0, 100);

  const progress = state.distance / maxPursuitDistance;
  const roadWidth = sampleRoadWidth(progress);
  const overflow = Math.abs(state.laneOffset) - roadWidth;
  const nearEdge = Math.abs(state.laneOffset) > roadWidth * 0.78 && steer === Math.sign(state.laneOffset);
  if (nearEdge) {
    const side = Math.sign(state.laneOffset);
    const scrapeBasis = samplePathBasis(progress);
    const scrapeOrigin = new THREE.Vector3(
      scrapeBasis.path.x + scrapeBasis.rightX * roadWidth * side,
      scrapeBasis.path.y,
      scrapeBasis.path.z + scrapeBasis.rightZ * roadWidth * side,
    );
    vfxDirector.spawnWallImpact(scrapeOrigin, scrapeBasis, side, 0.32 + driveIntensity * 0.6, seconds);
    state.impact = clamp(state.impact + 0.018 + driveIntensity * 0.025, 0, 1);
  }
  if (overflow > 0) {
    const side = Math.sign(state.laneOffset);
    const impactBasis = samplePathBasis(progress);
    const impactOrigin = new THREE.Vector3(
      impactBasis.path.x + impactBasis.rightX * roadWidth * side,
      impactBasis.path.y,
      impactBasis.path.z + impactBasis.rightZ * roadWidth * side,
    );
    vfxDirector.spawnWallImpact(impactOrigin, impactBasis, side, clamp(overflow + driveIntensity, 0.2, 1.35), seconds);
    state.laneOffset = THREE.MathUtils.lerp(state.laneOffset, side * roadWidth, clamp(dt * (8 + overflow * 3), 0, 1));
    state.speed = clamp(state.speed - (18 + overflow * 26) * dt, 0, maxSpeed);
    state.impact = clamp(state.impact + overflow * 0.3 + driveIntensity * 0.05, 0, 1);
  }
  state.impact = Math.max(0, state.impact - dt * 1.9);
  driveIntensity = clamp(state.speed / maxSpeed, 0, 1);
  state.stability = clamp(
    state.stability -
      Math.abs(steer) * dt * (11 + driveIntensity * 9) -
      Math.max(0, state.speed - maxSpeed * 0.72) * dt * 0.28 -
      Math.max(0, overflow) * dt * 34 +
      dt * 2.2,
    0,
    100,
  );

  if (state.pursuit >= 100 && !state.complete) {
    state.complete = true;
    state.speed = 0;
  }

  const basis = samplePathBasis(progress);
  const path = basis.path;
  const tangentYaw = basis.yaw;
  const vehicleX = path.x + basis.rightX * state.laneOffset;
  const vehicleZ = path.z + basis.rightZ * state.laneOffset;
  const vehicleY = path.y + Math.sin(seconds * 18) * (0.008 + state.speed * 0.001);
  vehicle.position.x = THREE.MathUtils.lerp(vehicle.position.x, vehicleX, 0.18);
  vehicle.position.y = THREE.MathUtils.lerp(vehicle.position.y, vehicleY, 0.18);
  vehicle.position.z = THREE.MathUtils.lerp(vehicle.position.z, vehicleZ, 0.18);
  vehicle.rotation.y = THREE.MathUtils.lerp(vehicle.rotation.y, tangentYaw - state.heading * 0.22, 0.16);
  vehicle.rotation.z = THREE.MathUtils.lerp(vehicle.rotation.z, -steer * 0.12, 0.18);

  const targetProgress = clamp(progress + 0.25, 0, 1);
  const targetBasis = samplePathBasis(targetProgress);
  const targetLane = Math.sin(seconds * 0.9) * 0.58;
  target.position.x = targetBasis.path.x + targetBasis.rightX * targetLane;
  target.position.y = targetBasis.path.y + 0.12;
  target.position.z = targetBasis.path.z + targetBasis.rightZ * targetLane + Math.sin(seconds * 1.4) * 0.2;
  target.rotation.y = targetBasis.yaw;

  guide.position.x = path.x + basis.rightX * state.laneOffset * 0.35;
  guide.position.z = path.z + basis.rightZ * state.laneOffset * 0.35 - 1.2;
  guide.rotation.y = tangentYaw + state.heading * 0.08;

  trackRibbon.position.x = path.x + basis.forwardX * 17;
  trackRibbon.position.z = path.z + basis.forwardZ * 17;
  trackRibbon.scale.x = roadWidth / 3.1;
  trackRibbon.rotation.y = tangentYaw;
  trackRibbon.material.opacity = 0.06 + driveIntensity * 0.12;

  speedLayer.position.x = path.x + basis.rightX * state.laneOffset * 0.12;
  speedLayer.position.y = 0.055;
  speedLayer.position.z = path.z + basis.rightZ * state.laneOffset * 0.12;
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
  el.stage.dataset.impact = state.impact > 0.16 ? "hit" : "clean";

  for (const marker of boundaryMarkers) {
    const markerProgress = clamp(progress + 0.015 + marker.userData.index * 0.018, 0, 1);
    const markerBasis = samplePathBasis(markerProgress);
    const markerWidth = sampleRoadWidth(markerProgress) + 0.18;
    marker.position.x = markerBasis.path.x + markerBasis.rightX * markerWidth * marker.userData.side;
    marker.position.y = markerBasis.path.y + 0.075;
    marker.position.z = markerBasis.path.z + markerBasis.rightZ * markerWidth * marker.userData.side;
    marker.rotation.y = markerBasis.yaw;
    marker.visible = markerProgress < 0.995;
  }
  for (const material of boundaryMaterials) {
    material.opacity = 0.12 + driveIntensity * 0.18 + state.impact * 0.32;
  }

  vfxDirector.maybeSpawnAmbientExplosion(progress, basis, state.speed, seconds);
  vfxDirector.update(dt, driveIntensity);
  el.stage.style.setProperty("--vfx-flash", String(clamp(vfxDirector.flash, 0, 0.72).toFixed(3)));

  if (proceduralWorld) {
    proceduralWorld.position.z = 4 + (state.distance % 12) * 0.12;
    proceduralWorld.rotation.y = state.heading * 0.025;
  }

  magentaLight.position.x = vehicle.position.x - 2.5;
  magentaLight.position.z = vehicle.position.z - 1.2;
  cyanLight.position.x = target.position.x + 2.1;
  cyanLight.position.z = target.position.z + 0.2;

  const lookProgress = clamp(progress + 0.16 + driveIntensity * 0.1, 0, 1);
  const lookBasis = samplePathBasis(lookProgress);
  if (cameraMode === "chase") {
    const chaseDistance = 6.2 + driveIntensity * 2.4;
    const camX = vehicle.position.x - basis.forwardX * chaseDistance + basis.rightX * state.laneOffset * 0.28;
    const camY = 1.85 + driveIntensity * 1.25;
    const camZ = vehicle.position.z - basis.forwardZ * chaseDistance + basis.rightZ * state.laneOffset * 0.28;
    camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.2);
    camera.fov = THREE.MathUtils.lerp(camera.fov, Math.min(90, 68 + state.speed * 0.38), 0.12);
  } else {
    const shake = state.impact * Math.sin(seconds * 48) * 0.055;
    const camX = vehicle.position.x + basis.forwardX * 0.56 + basis.rightX * (0.08 + shake);
    const camY = 0.72 + driveIntensity * 0.22 + Math.sin(seconds * 22) * driveIntensity * 0.018;
    const camZ = vehicle.position.z + basis.forwardZ * 0.56 + basis.rightZ * (0.08 + shake);
    camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.34);
    camera.fov = THREE.MathUtils.lerp(camera.fov, Math.min(98, 84 + state.speed * 0.22), 0.16);
    cockpit.rotation.z = THREE.MathUtils.lerp(cockpit.rotation.z, -steer * 0.045 - state.laneOffset * 0.018, 0.18);
    cockpit.position.y = Math.sin(seconds * 20) * driveIntensity * 0.015 - state.impact * 0.025;
    hoodGlow.material.opacity = 0.55 + driveIntensity * 0.28 + state.impact * 0.18;
  }
  camera.updateProjectionMatrix();
  camera.lookAt(
    lookBasis.path.x + lookBasis.rightX * state.laneOffset * 0.42,
    0.9 + driveIntensity * 0.24,
    lookBasis.path.z + lookBasis.rightZ * state.laneOffset * 0.42,
  );
  camera.rotateZ(-steer * 0.04 - state.laneOffset * 0.016 + state.impact * Math.sin(seconds * 39) * 0.018);

  if (bloomPass) {
    bloomPass.strength = 0.24 + driveIntensity * 0.18 + state.impact * 0.28 + vfxDirector.flash * 0.52;
    bloomPass.radius = 0.26 + driveIntensity * 0.16;
  }

  updateHud();
  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }

  if (!state.firstFramePosted) {
    state.firstFramePosted = true;
    window.parent?.postMessage({ type: "neon-world-ready" }, window.location.origin);
  }
}

renderer.setAnimationLoop(animate);
