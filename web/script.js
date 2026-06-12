const state = {
  mode: "film",
  node: "A0",
  lane: 1,
  speed: 48,
  stability: 72,
  reaction: 50,
  risk: 0,
  driveTicks: 0,
  health: 100,
  timing: 0,
  terminal: 0,
  evidence: 100,
  upload: 0,
  boss: 100,
  combatTicks: 0,
  timer: null,
  currentVideo: "",
  takeoverReady: false,
  takeoverRevealTimer: null,
};

const defaultVideo = {
  src: "./assets/neon-cleaner-bg-noaudio.mp4",
  poster: "./assets/neon-cleaner-keyframe.png",
  loop: true,
};

const videoAssets = {
  A0: {
    src: "./assets/video/A0-S01-establishing-sulphur2-v2-web.mp4",
    poster: "./assets/video/A0-S01-establishing-sulphur2-v2-poster.jpg",
    loop: false,
  },
};

const nodes = {
  A0: {
    label: "A0 / Rain Signal",
    title: "雨夜，黑色车队带走了证人。",
    text: "林夏跨上黑色电动摩托，雨水从护目镜边缘滑落。阿洛标记出三辆黑色装甲车：目标将在 30 秒后进入高架。",
    button: "接管追车",
    next: "I1",
  },
  C1: {
    label: "C1 / Clean Pursuit",
    title: "你贴住了目标车尾。",
    text: "林夏压低车身从狭窄坡道飞出，摩托擦过护卫车侧翼。黑色装甲车队被迫改道，港口坐标暴露。",
    button: "进入港口",
    next: "A2",
  },
  C2: {
    label: "C2 / Damaged Pursuit",
    title: "追上了，但车快散了。",
    text: "摩托外壳被弹片撕开，后轮稳定系统报警。阿洛警告还能撑两分钟，林夏没有减速。",
    button: "进入港口",
    next: "A2",
  },
  C3: {
    label: "C3 / Lost Trail",
    title: "车队消失在高架阴影里。",
    text: "路口只剩雨声和红灯。阿洛只能锁定最后一次污染信号：港口仓库。你迟到了一步。",
    button: "赶往港口",
    next: "A2",
  },
  A2: {
    label: "A2 / Warehouse Threshold",
    title: "维克多开始上传伪造证据。",
    text: "仓库深处亮起洋红色污染光。米娅被固定在终端旁，上传进度正在攀升。阿洛提醒：打倒他不是重点，先打断终端。",
    button: "接管对决",
    next: "I2",
  },
  E1: {
    label: "E1 / Before the Breakpoint",
    title: "上传停在 99%。",
    text: "林夏击碎终端，米娅活了下来，原始证据完整保存。维克多第一次露出真正的恐惧。",
    button: "再来一遍",
    next: "restart",
  },
  E2: {
    label: "E2 / A Lit Wound",
    title: "你赢了今晚，但没有赢完。",
    text: "证据保住了一半，米娅活着，维克多逃进雨幕。城市暂时没有倒向谎言，但阴影还在。",
    button: "再来一遍",
    next: "restart",
  },
  E3: {
    label: "E3 / The City Believes the Screen",
    title: "屏幕比证词先抵达城市。",
    text: "伪造视频上传完成。雨夜的巨屏亮起，林夏站在街口，看着整座城市开始相信一个谎言。",
    button: "再来一遍",
    next: "restart",
  },
};

const el = {
  backgroundVideo: document.getElementById("backgroundVideo"),
  nodeLabel: document.getElementById("nodeLabel"),
  caption: document.getElementById("caption"),
  subtitle: document.getElementById("subtitle"),
  primaryBtn: document.getElementById("primaryBtn"),
  restartBtn: document.getElementById("restartBtn"),
  hud: document.getElementById("hud"),
  playfield: document.getElementById("playfield"),
  road: document.getElementById("road"),
  playerCar: document.getElementById("playerCar"),
  targetCar: document.getElementById("targetCar"),
  combat: document.getElementById("combat"),
  metricAName: document.getElementById("metricAName"),
  metricBName: document.getElementById("metricBName"),
  metricCName: document.getElementById("metricCName"),
  metricA: document.getElementById("metricA"),
  metricB: document.getElementById("metricB"),
  metricC: document.getElementById("metricC"),
  metricAValue: document.getElementById("metricAValue"),
  metricBValue: document.getElementById("metricBValue"),
  metricCValue: document.getElementById("metricCValue"),
  keys: document.getElementById("keys"),
  attackBtn: document.getElementById("attackBtn"),
  guardBtn: document.getElementById("guardBtn"),
  terminalBtn: document.getElementById("terminalBtn"),
  bossBar: document.getElementById("bossBar"),
  uploadBar: document.getElementById("uploadBar"),
  worldLink: document.getElementById("worldLink"),
};

const worldPrewarm = {
  started: false,
  ready: false,
  pendingOpen: false,
  frame: null,
};

const canPrewarmWorld = location.protocol === "http:" || location.protocol === "https:";
const takeoverRevealProgress = 0.82;
const takeoverRevealRemainingSeconds = 1.2;
const takeoverRevealFallbackMs = 12000;

if (el.backgroundVideo) {
  setBackgroundVideo(defaultVideo);
}

function updateWorldPrewarmStatus() {
  if (!el.worldLink) return;
  if (!canPrewarmWorld) {
    el.worldLink.dataset.ready = "false";
    el.worldLink.textContent = "打开本地3D";
    el.worldLink.href = "http://127.0.0.1:5177/world-prototype.html";
    return;
  }
  el.worldLink.dataset.ready = worldPrewarm.ready ? "true" : "false";
  el.worldLink.textContent = worldPrewarm.ready ? "3D场景已就绪" : "3D场景预热中";
}

function prewarmWorld() {
  if (!canPrewarmWorld) {
    updateWorldPrewarmStatus();
    return;
  }
  if (worldPrewarm.started || !el.worldLink) return;
  worldPrewarm.started = true;
  updateWorldPrewarmStatus();

  const frame = document.createElement("iframe");
  frame.className = "world-prewarm-frame";
  frame.title = "3D takeover prewarm";
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");
  frame.src = "./world-prototype.html?prewarm=1";
  document.body.appendChild(frame);
  worldPrewarm.frame = frame;
}

function activatePrewarmedWorld() {
  if (!worldPrewarm.ready || !worldPrewarm.frame) return false;
  worldPrewarm.frame.classList.add("is-active");
  worldPrewarm.frame.removeAttribute("aria-hidden");
  worldPrewarm.frame.contentWindow?.postMessage({ type: "neon-world-activate" }, window.location.origin);
  worldPrewarm.frame.focus();
  return true;
}

function startWorldTakeover(event) {
  event?.preventDefault();
  if (!canPrewarmWorld) {
    location.href = "http://127.0.0.1:5177/world-prototype.html";
    return;
  }

  if (!worldPrewarm.started) prewarmWorld();
  if (!worldPrewarm.ready || !worldPrewarm.frame) {
    worldPrewarm.pendingOpen = true;
    if (el.worldLink) el.worldLink.textContent = "3D 加载中...";
    el.primaryBtn.textContent = "3D 接管加载中...";
    el.primaryBtn.disabled = true;

    window.setTimeout(() => {
      if (!worldPrewarm.pendingOpen) return;
      location.href = "./world-prototype.html";
    }, 7000);
    return;
  }

  activatePrewarmedWorld();
}

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  if (event.data?.type !== "neon-world-ready") return;
  worldPrewarm.ready = true;
  updateWorldPrewarmStatus();
  if (worldPrewarm.pendingOpen && worldPrewarm.frame) {
    worldPrewarm.pendingOpen = false;
    activatePrewarmedWorld();
  }
});

updateWorldPrewarmStatus();

function setBackgroundVideo(asset = defaultVideo) {
  if (!el.backgroundVideo || state.currentVideo === asset.src) return;
  state.currentVideo = asset.src;
  el.backgroundVideo.pause();
  el.backgroundVideo.loop = Boolean(asset.loop);
  el.backgroundVideo.poster = asset.poster;
  el.backgroundVideo.src = asset.src;
  el.backgroundVideo.load();
  el.backgroundVideo.muted = true;
  el.backgroundVideo.play().catch(() => {
    el.backgroundVideo.setAttribute("data-autoplay-blocked", "true");
  });
}

function setPrimaryAvailable(available) {
  el.primaryBtn.hidden = !available;
  el.primaryBtn.disabled = !available;
}

function clearTakeoverRevealTimer() {
  if (!state.takeoverRevealTimer) return;
  window.clearTimeout(state.takeoverRevealTimer);
  state.takeoverRevealTimer = null;
}

function revealTakeoverButton() {
  if (state.mode !== "film" || state.node !== "A0" || state.takeoverReady) return;
  state.takeoverReady = true;
  clearTakeoverRevealTimer();
  setPrimaryAvailable(true);
  el.keys.textContent = worldPrewarm.ready ? "3D 场景已就绪，接管窗口开启。" : "接管窗口开启，3D 场景继续加载中。";
}

function maybeRevealTakeoverFromVideo() {
  if (state.mode !== "film" || state.node !== "A0" || state.takeoverReady || !el.backgroundVideo) return;
  const { currentTime, duration } = el.backgroundVideo;
  if (!Number.isFinite(duration) || duration <= 0) return;
  const progress = currentTime / duration;
  const remaining = duration - currentTime;
  if (progress >= takeoverRevealProgress || remaining <= takeoverRevealRemainingSeconds) {
    revealTakeoverButton();
  }
}

function scheduleTakeoverReveal(id) {
  clearTakeoverRevealTimer();
  state.takeoverReady = id !== "A0";
  setPrimaryAvailable(id !== "A0");
  if (id !== "A0") return;

  el.keys.textContent = "观看开场，接管窗口会在合适时机出现。";
  state.takeoverRevealTimer = window.setTimeout(revealTakeoverButton, takeoverRevealFallbackMs);
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function setMetric(a, b, c) {
  el.metricA.style.width = `${clamp(a)}%`;
  el.metricB.style.width = `${clamp(b)}%`;
  el.metricC.style.width = `${clamp(c)}%`;
  el.metricAValue.textContent = Math.round(clamp(a));
  el.metricBValue.textContent = Math.round(clamp(b));
  el.metricCValue.textContent = Math.round(clamp(c));
}

function showFilm(id) {
  clearInterval(state.timer);
  state.mode = "film";
  state.node = id;
  setBackgroundVideo(videoAssets[id] || defaultVideo);
  const node = nodes[id];
  el.nodeLabel.textContent = node.label;
  el.caption.textContent = node.title;
  el.subtitle.textContent = node.text;
  el.primaryBtn.textContent = node.button;
  el.hud.hidden = true;
  el.playfield.hidden = true;
  el.road.classList.remove("active");
  el.combat.hidden = true;
  el.keys.textContent = "影片节点会切到可接管片段，操作结果决定下一段影片。";
  scheduleTakeoverReveal(id);
  if (id === "A0") prewarmWorld();
}

function startDriving() {
  clearInterval(state.timer);
  state.mode = "drive";
  state.node = "I1";
  state.lane = 1;
  state.speed = 48;
  state.stability = 72;
  state.reaction = 50;
  state.risk = 0;
  state.driveTicks = 0;
  el.nodeLabel.textContent = "I1 / Car Chase Takeover";
  el.caption.textContent = "接管：追上黑色 SUV";
  el.subtitle.textContent = "保持速度，但不要失控。按空格走捷径会提高风险，也可能提高成绩。";
  el.primaryBtn.disabled = true;
  el.hud.hidden = false;
  el.playfield.hidden = false;
  el.road.classList.add("active");
  el.combat.hidden = true;
  el.metricAName.textContent = "速度";
  el.metricBName.textContent = "稳定";
  el.metricCName.textContent = "风险";
  el.keys.textContent = "← → 控方向，↑ 加速，↓ 刹车，空格走捷径";
  updateCarPositions();
  state.timer = setInterval(tickDriving, 220);
}

function updateCarPositions() {
  const laneX = [18, 50, 82][state.lane];
  el.playerCar.style.left = `${laneX}%`;
  const targetWobble = 50 + Math.sin(state.driveTicks * 0.45) * 14;
  el.targetCar.style.left = `${targetWobble}%`;
}

function tickDriving() {
  state.driveTicks += 1;
  state.speed = clamp(state.speed - 0.8 + Math.random() * 1.6);
  state.stability = clamp(state.stability - Math.abs(state.speed - 72) * 0.035 - state.risk * 0.018);
  state.reaction = clamp(state.reaction + 0.55 + Math.random() * 1.2);
  state.risk = clamp(state.risk - 1.6);
  updateCarPositions();
  setMetric(state.speed, state.stability, state.risk);

  if (state.driveTicks >= 118) {
    finishDriving();
  }
}

function finishDriving() {
  clearInterval(state.timer);
  const score = state.speed * 0.35 + state.stability * 0.35 + state.reaction * 0.2 + state.risk * 0.1;
  if (score >= 85) showFilm("C1");
  else if (score >= 55) showFilm("C2");
  else showFilm("C3");
}

function startCombat() {
  clearInterval(state.timer);
  state.mode = "combat";
  state.node = "I2";
  state.health = 100;
  state.timing = 42;
  state.terminal = 0;
  state.evidence = 100;
  state.upload = 0;
  state.boss = 100;
  state.combatTicks = 0;
  el.nodeLabel.textContent = "I2 / Boss Interrupt";
  el.caption.textContent = "接管：阻止伪造上传";
  el.subtitle.textContent = "只打 Boss 不够。你要在活下来和破坏终端之间分配注意力。";
  el.primaryBtn.disabled = true;
  el.hud.hidden = false;
  el.playfield.hidden = false;
  el.road.classList.remove("active");
  el.combat.hidden = false;
  el.metricAName.textContent = "时机";
  el.metricBName.textContent = "终端";
  el.metricCName.textContent = "证据";
  el.keys.textContent = "J 攻击，K 格挡，L 破坏终端";
  updateCombat();
  state.timer = setInterval(tickCombat, 260);
}

function tickCombat() {
  state.combatTicks += 1;
  state.upload = clamp(state.upload + 1.8 + Math.random() * 1.5);
  state.evidence = clamp(state.evidence - state.upload * 0.018);
  if (state.combatTicks % 9 === 0) state.health = clamp(state.health - 7);
  updateCombat();
  if (state.upload >= 100 || state.health <= 0 || state.combatTicks >= 115) {
    finishCombat();
  }
}

function updateCombat() {
  setMetric(state.timing, state.terminal, state.evidence);
  el.bossBar.style.width = `${state.boss}%`;
  el.uploadBar.style.width = `${state.upload}%`;
}

function finishCombat() {
  clearInterval(state.timer);
  if (state.timing >= 80 && state.terminal >= 80 && state.evidence >= 70) showFilm("E1");
  else if (state.health > 0 && state.evidence >= 40) showFilm("E2");
  else showFilm("E3");
}

function restart() {
  Object.assign(state, {
    mode: "film",
    node: "A0",
    lane: 1,
    speed: 48,
    stability: 72,
    reaction: 50,
    risk: 0,
    driveTicks: 0,
    health: 100,
    timing: 0,
    terminal: 0,
    evidence: 100,
    upload: 0,
    boss: 100,
    combatTicks: 0,
  });
  showFilm("A0");
}

function primaryAction() {
  if (el.primaryBtn.hidden || el.primaryBtn.disabled) return;
  const node = nodes[state.node];
  if (!node) return;
  if (node.next === "I1") startWorldTakeover();
  else if (node.next === "I2") startCombat();
  else if (node.next === "restart") restart();
  else showFilm(node.next);
}

function handleDriveKey(event) {
  if (state.mode !== "drive") return;
  if (event.key === "ArrowLeft") {
    state.lane = Math.max(0, state.lane - 1);
    state.stability = clamp(state.stability - 4);
    state.reaction = clamp(state.reaction + 4);
  }
  if (event.key === "ArrowRight") {
    state.lane = Math.min(2, state.lane + 1);
    state.stability = clamp(state.stability - 4);
    state.reaction = clamp(state.reaction + 4);
  }
  if (event.key === "ArrowUp") {
    state.speed = clamp(state.speed + 8);
    state.stability = clamp(state.stability - 2);
  }
  if (event.key === "ArrowDown") {
    state.speed = clamp(state.speed - 9);
    state.stability = clamp(state.stability + 3);
  }
  if (event.code === "Space") {
    state.risk = clamp(state.risk + 20);
    state.speed = clamp(state.speed + 8);
    state.reaction = clamp(state.reaction + 6);
  }
  updateCarPositions();
  setMetric(state.speed, state.stability, state.risk);
}

function handleCombatKey(event) {
  if (state.mode !== "combat") return;
  if (event.key.toLowerCase() === "j") combatAttack();
  if (event.key.toLowerCase() === "k") combatGuard();
  if (event.key.toLowerCase() === "l") combatTerminal();
}

function combatAttack() {
  state.boss = clamp(state.boss - 10);
  state.timing = clamp(state.timing + 5 + Math.random() * 5);
  state.health = clamp(state.health - 2);
  updateCombat();
}

function combatGuard() {
  state.health = clamp(state.health + 7);
  state.timing = clamp(state.timing + 8);
  state.upload = clamp(state.upload + 2);
  updateCombat();
}

function combatTerminal() {
  state.terminal = clamp(state.terminal + 13);
  state.upload = clamp(state.upload - 8);
  state.timing = clamp(state.timing - 2);
  state.evidence = clamp(state.evidence + 2);
  updateCombat();
}

el.primaryBtn.addEventListener("click", primaryAction);
el.restartBtn.addEventListener("click", restart);
el.backgroundVideo.addEventListener("timeupdate", maybeRevealTakeoverFromVideo);
el.backgroundVideo.addEventListener("ended", revealTakeoverButton);
el.worldLink.addEventListener("pointerenter", prewarmWorld);
el.worldLink.addEventListener("focus", prewarmWorld);
el.worldLink.addEventListener("click", startWorldTakeover);
el.attackBtn.addEventListener("click", combatAttack);
el.guardBtn.addEventListener("click", combatGuard);
el.terminalBtn.addEventListener("click", combatTerminal);
window.addEventListener("keydown", (event) => {
  handleDriveKey(event);
  handleCombatKey(event);
});

restart();
