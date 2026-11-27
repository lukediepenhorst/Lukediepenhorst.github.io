import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

/* Pixel ratio is capped for phones like an iPhone 13 (3x). Geometry stays boxes and low-segment primitives. */
const MAX_PIXEL_RATIO = 1.5;
const ELBOW_REST = -0.9;

const HOME = {
  wide: { fov: 33, position: [-0.15, 8.5, 13.1], target: [-0.2, 0.42, 0] },
  narrow: { fov: 52, position: [0, 13.4, 15.2], target: [0, 0.15, 0] },
};

const LAYOUT = {
  "chief-of-staff": { x: -3.35, z: -3.15, mark: "antenna" },
  "inbox-manager": { x: 0, z: -3.45, mark: "mail" },
  "texts": { x: 3.35, z: -3.15, mark: "nubs" },
  "business-lab": { x: -3.35, z: -0.05, mark: "lamp" },
  "personal-shopper": { x: 0, z: -0.35, mark: "bag" },
  "content-coach": { x: 3.35, z: -0.05, mark: "headset" },
  "opportunity-scout": { x: -3.35, z: 3.05, mark: "radar" },
  "money-manager": { x: 0, z: 2.7, mark: "coin" },
  "goal-tracker": { x: 3.35, z: 3.05, mark: "fin" },
};

const MOTION = {
  Working: { bob: 1.7, bobAmp: 0.028, type: 8.5, typeAmp: 0.22, head: 0.85, headAmp: 0.42, glow: 2.5 },
  Idle: { bob: 0.7, bobAmp: 0.012, type: 0, typeAmp: 0, head: 0.32, headAmp: 0.2, glow: 0.7 },
  "Waiting on Luke": { bob: 1.05, bobAmp: 0.016, type: 1.3, typeAmp: 0.045, head: 0.4, headAmp: 0.12, glow: 1.15 },
  Done: { bob: 0.85, bobAmp: 0.01, type: 0, typeAmp: 0, head: 0.28, headAmp: 0.1, glow: 0.55 },
};

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function showFallback(text) {
  const fallback = document.getElementById("fallback");
  const fallbackText = document.getElementById("fallback-text");
  const hint = document.getElementById("hint");
  const loading = document.getElementById("loading");
  if (fallbackText) fallbackText.textContent = text;
  if (fallback) fallback.hidden = false;
  if (hint) hint.hidden = true;
  if (loading) loading.hidden = true;
}

function hideLoading() {
  const loading = document.getElementById("loading");
  if (loading) loading.hidden = true;
}

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch (err) {
    return false;
  }
}

function waitForRoster() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(window.BotHQ || { ready: true, error: "The roster did not load.", bots: [], selectedId: null });
    };
    if (window.BotHQ && window.BotHQ.ready) {
      finish();
      return;
    }
    document.addEventListener("bothq:ready", finish, { once: true });
    window.setTimeout(finish, 12000);
  });
}

function slotFor(bot, index) {
  if (LAYOUT[bot.id]) return LAYOUT[bot.id];
  return {
    x: ((index % 3) - 1) * 3.5,
    z: 4.6,
    mark: "antenna",
  };
}

function motionFor(status) {
  return MOTION[status] || MOTION.Idle;
}

function markTexture(char, stroke) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = "rgba(8, 10, 16, 0.88)";
  ctx.beginPath();
  ctx.arc(64, 64, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.fillStyle = stroke;
  ctx.font = "700 72px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(char, 64, 68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function screenTexture(hex) {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0b1018";
  ctx.fillRect(0, 0, 160, 96);
  ctx.fillStyle = hex;
  ctx.globalAlpha = 0.95;
  ctx.fillRect(0, 0, 160, 10);
  ctx.globalAlpha = 0.35;
  ctx.fillRect(10, 20, 78, 5);
  ctx.fillRect(10, 30, 52, 5);
  ctx.globalAlpha = 0.8;
  const bars = [28, 46, 34, 58, 40, 22];
  bars.forEach((height, index) => {
    ctx.fillRect(12 + index * 24, 86 - height, 14, height);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function windowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");
  const sky = ctx.createLinearGradient(0, 0, 0, 192);
  sky.addColorStop(0, "#081018");
  sky.addColorStop(1, "#1a4563");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 512, 192);
  ctx.fillStyle = "#0c1a28";
  [[18, 80], [70, 120], [124, 64], [176, 140], [240, 96], [300, 150], [368, 78], [430, 112]].forEach(([x, h]) => {
    ctx.fillRect(x, 192 - h, 40, h);
  });
  ctx.fillStyle = "rgba(186, 224, 255, 0.45)";
  for (let i = 0; i < 36; i += 1) {
    ctx.fillRect((i * 53) % 490 + 12, (i * 31) % 140 + 12, 3, 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function shadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const grd = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grd.addColorStop(0, "rgba(0,0,0,0.5)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function floorMarkTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(130, 196, 220, 0.65)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(128, 128, 96, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(210, 232, 244, 0.72)";
  ctx.font = "600 72px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("HQ", 128, 136);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function startScene(bots) {
  const viewport = document.getElementById("viewport");
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const renderer = new THREE.WebGLRenderer({
    antialias: !coarse,
    alpha: false,
    stencil: false,
    powerPreference: "high-performance",
    failIfMajorPerformanceCaveat: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setClearColor(0x07090f, 1);
  viewport.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090f);
  scene.fog = new THREE.Fog(0x07090f, 22, 46);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = "labels";
  viewport.appendChild(labelRenderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.42;
  controls.rotateSpeed = coarse ? 0.7 : 0.85;
  controls.zoomSpeed = 0.75;
  controls.minDistance = 5.5;
  controls.maxDistance = 18;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = Math.PI / 2.08;

  const hemi = new THREE.HemisphereLight(0xc9d6ff, 0x22182c, 1.25);
  const key = new THREE.DirectionalLight(0xf4f7ff, 2.5);
  key.position.set(4.5, 9, 8);
  const fill = new THREE.DirectionalLight(0x8eabff, 0.9);
  fill.position.set(-7, 4, -4);
  const pool = new THREE.PointLight(0xd5e7ff, 6, 16, 2);
  pool.position.set(0, 3.2, 0.4);
  scene.add(hemi, key, fill, pool);

  const geo = {
    deskTop: new THREE.BoxGeometry(1.46, 0.07, 0.76),
    deskLeg: new THREE.BoxGeometry(0.055, 0.74, 0.055),
    lip: new THREE.BoxGeometry(1.46, 0.028, 0.03),
    bezel: new THREE.BoxGeometry(0.62, 0.4, 0.03),
    stand: new THREE.BoxGeometry(0.06, 0.22, 0.06),
    standBase: new THREE.BoxGeometry(0.24, 0.025, 0.14),
    screen: new THREE.PlaneGeometry(0.52, 0.3),
    glow: new THREE.PlaneGeometry(0.74, 0.5),
    keyboard: new THREE.BoxGeometry(0.34, 0.025, 0.12),
    mouse: new THREE.BoxGeometry(0.05, 0.02, 0.08),
    mug: new THREE.CylinderGeometry(0.045, 0.038, 0.07, 8),
    chairSeat: new THREE.BoxGeometry(0.38, 0.05, 0.38),
    chairBack: new THREE.BoxGeometry(0.38, 0.42, 0.05),
    chairPost: new THREE.BoxGeometry(0.06, 0.32, 0.06),
    torso: new THREE.BoxGeometry(0.3, 0.32, 0.17),
    head: new THREE.BoxGeometry(0.22, 0.18, 0.2),
    visor: new THREE.BoxGeometry(0.24, 0.05, 0.23),
    eye: new THREE.BoxGeometry(0.045, 0.032, 0.02),
    neck: new THREE.BoxGeometry(0.08, 0.06, 0.08),
    upper: new THREE.BoxGeometry(0.055, 0.16, 0.055),
    fore: new THREE.BoxGeometry(0.05, 0.15, 0.05),
    hand: new THREE.BoxGeometry(0.055, 0.04, 0.06),
    antenna: new THREE.BoxGeometry(0.02, 0.14, 0.02),
    antennaTip: new THREE.BoxGeometry(0.05, 0.04, 0.05),
    mail: new THREE.BoxGeometry(0.14, 0.1, 0.02),
    nub: new THREE.BoxGeometry(0.045, 0.07, 0.045),
    stalk: new THREE.BoxGeometry(0.02, 0.1, 0.02),
    bulb: new THREE.SphereGeometry(0.045, 8, 6),
    bag: new THREE.BoxGeometry(0.1, 0.12, 0.06),
    band: new THREE.BoxGeometry(0.24, 0.035, 0.16),
    pad: new THREE.BoxGeometry(0.045, 0.07, 0.04),
    radar: new THREE.CylinderGeometry(0.07, 0.07, 0.025, 8),
    coin: new THREE.CylinderGeometry(0.055, 0.055, 0.02, 10),
    fin: new THREE.BoxGeometry(0.025, 0.16, 0.1),
    pick: new THREE.BoxGeometry(0.78, 1.2, 0.6),
    floor: new THREE.BoxGeometry(14, 0.08, 12.6),
    ground: new THREE.PlaneGeometry(80, 80),
    wall: new THREE.BoxGeometry(14, 2.7, 0.12),
    window: new THREE.PlaneGeometry(4.2, 1.25),
    rack: new THREE.BoxGeometry(0.52, 1.35, 0.4),
    slit: new THREE.BoxGeometry(0.34, 0.04, 0.02),
    shadow: new THREE.PlaneGeometry(1, 1),
    mark: new THREE.PlaneGeometry(2.3, 2.3),
  };

  const mats = {
    floor: new THREE.MeshStandardMaterial({ color: 0x141b28, roughness: 0.94, metalness: 0.04 }),
    ground: new THREE.MeshStandardMaterial({ color: 0x090c14, roughness: 1, metalness: 0 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x121826, roughness: 0.9, metalness: 0.05 }),
    desk: new THREE.MeshStandardMaterial({ color: 0x2a3346, roughness: 0.72, metalness: 0.1 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 0.6, metalness: 0.2 }),
    chair: new THREE.MeshStandardMaterial({ color: 0x151b27, roughness: 0.7, metalness: 0.12 }),
    bezel: new THREE.MeshStandardMaterial({ color: 0x0c1018, roughness: 0.4, metalness: 0.45 }),
    rack: new THREE.MeshStandardMaterial({ color: 0x121820, roughness: 0.55, metalness: 0.35 }),
    eye: new THREE.MeshBasicMaterial({ color: 0xeaf8ff }),
    slit: new THREE.MeshBasicMaterial({ color: 0x6ee0ff }),
    paper: new THREE.MeshStandardMaterial({ color: 0xf3efe4, roughness: 0.8, metalness: 0 }),
    coin: new THREE.MeshStandardMaterial({ color: 0xf0d48a, roughness: 0.35, metalness: 0.6, emissive: 0xf0d48a, emissiveIntensity: 0.15 }),
    bulb: new THREE.MeshBasicMaterial({ color: 0xfff1c9 }),
    shadow: new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
    floorMark: new THREE.MeshBasicMaterial({ map: floorMarkTexture(), transparent: true, depthWrite: false }),
    window: new THREE.MeshBasicMaterial({ map: windowTexture() }),
    pick: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
  };

  const floor = new THREE.Mesh(geo.floor, mats.floor);
  floor.position.y = -0.04;
  const ground = new THREE.Mesh(geo.ground, mats.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.09;
  const grid = new THREE.GridHelper(12, 12, 0x35506e, 0x243044);
  grid.position.y = 0.012;
  const wall = new THREE.Mesh(geo.wall, mats.wall);
  wall.position.set(0, 1.35, -5.85);
  const windowPane = new THREE.Mesh(geo.window, mats.window);
  windowPane.position.set(0, 1.55, -5.76);
  const floorDecal = new THREE.Mesh(geo.mark, mats.floorMark);
  floorDecal.rotation.x = -Math.PI / 2;
  floorDecal.position.y = 0.03;
  scene.add(ground, floor, grid, wall, windowPane, floorDecal);

  [-6.15, 6.15].forEach((x) => {
    const rack = new THREE.Mesh(geo.rack, mats.rack);
    rack.position.set(x, 0.68, -5.15);
    scene.add(rack);
    for (let i = 0; i < 5; i += 1) {
      const slit = new THREE.Mesh(geo.slit, mats.slit);
      slit.position.set(x, 0.28 + i * 0.18, -4.94);
      scene.add(slit);
    }
  });

  const questionMat = new THREE.SpriteMaterial({
    map: markTexture("?", "#ffd592"),
    transparent: true,
    depthWrite: false,
  });
  const checkMat = new THREE.SpriteMaterial({
    map: markTexture("✓", "#d9ffe8"),
    transparent: true,
    depthWrite: false,
  });

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.98, 1.1, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.035;
  ring.visible = false;
  scene.add(ring);

  const statusClass = window.BotStatus.statusClass;
  const stations = [];
  const workerGroups = [];
  const byId = {};

  bots.forEach((bot, index) => {
    const slot = slotFor(bot, index);
    const color = parseInt(bot.accent.slice(1), 16);
    const accentStd = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.42,
      metalness: 0.22,
      emissive: color,
      emissiveIntensity: 0.08,
    });
    const accentBasic = new THREE.MeshBasicMaterial({ color });
    const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture(bot.accent), side: THREE.DoubleSide });
    const glowMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const station = new THREE.Group();
    station.position.set(slot.x, 0, slot.z);

    const shadow = new THREE.Mesh(geo.shadow, mats.shadow);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(2.35, 1.75, 1);
    shadow.position.y = 0.02;
    station.add(shadow);

    const top = new THREE.Mesh(geo.deskTop, mats.desk);
    top.position.y = 0.76;
    station.add(top);
    [[-0.64, -0.3], [0.64, -0.3], [-0.64, 0.3], [0.64, 0.3]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(geo.deskLeg, mats.dark);
      leg.position.set(x, 0.37, z);
      station.add(leg);
    });
    const lip = new THREE.Mesh(geo.lip, accentBasic);
    lip.position.set(0, 0.805, 0.38);
    station.add(lip);

    const monitor = new THREE.Group();
    monitor.position.set(0, 1.02, -0.16);
    monitor.rotation.x = -0.95;
    const bezel = new THREE.Mesh(geo.bezel, mats.bezel);
    const screen = new THREE.Mesh(geo.screen, screenMat);
    screen.position.z = 0.04;
    const screenBack = new THREE.Mesh(geo.screen, screenMat);
    screenBack.position.z = -0.04;
    screenBack.rotation.y = Math.PI;
    const glow = new THREE.Mesh(geo.glow, glowMat);
    glow.position.z = 0.05;
    monitor.add(bezel, screen, screenBack, glow);
    station.add(monitor);
    const stand = new THREE.Mesh(geo.stand, mats.dark);
    stand.position.set(0, 0.88, -0.16);
    const foot = new THREE.Mesh(geo.standBase, mats.dark);
    foot.position.set(0, 0.785, -0.16);
    station.add(stand, foot);

    const keyboard = new THREE.Mesh(geo.keyboard, mats.dark);
    keyboard.position.set(0, 0.805, 0.08);
    const mouse = new THREE.Mesh(geo.mouse, mats.dark);
    mouse.position.set(0.28, 0.8, 0.14);
    const mug = new THREE.Mesh(geo.mug, accentStd);
    mug.position.set(-0.52, 0.83, 0.16);
    station.add(keyboard, mouse, mug);

    const chair = new THREE.Group();
    chair.position.set(0, 0, 0.46);
    const seat = new THREE.Mesh(geo.chairSeat, mats.chair);
    seat.position.y = 0.46;
    const post = new THREE.Mesh(geo.chairPost, mats.chair);
    post.position.y = 0.24;
    const back = new THREE.Mesh(geo.chairBack, mats.chair);
    back.position.set(0, 0.72, 0.16);
    chair.add(seat, post, back);
    station.add(chair);

    const worker = new THREE.Group();
    worker.position.set(0, 0, 0.46);
    worker.rotation.y = Math.PI;
    worker.scale.setScalar(1.12);
    worker.userData.botId = bot.id;
    const lean = new THREE.Group();
    lean.rotation.x = 0.12;
    worker.add(lean);

    const torso = new THREE.Mesh(geo.torso, accentStd);
    torso.position.y = 0.66;
    const neck = new THREE.Mesh(geo.neck, mats.dark);
    neck.position.y = 0.86;
    const headPivot = new THREE.Group();
    headPivot.position.y = 1.02;
    const head = new THREE.Mesh(geo.head, accentStd);
    const visor = new THREE.Mesh(geo.visor, mats.eye);
    visor.position.y = 0.01;
    const eyeL = new THREE.Mesh(geo.eye, mats.eye);
    eyeL.position.set(-0.05, 0.015, 0.11);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.05;
    head.add(visor, eyeL, eyeR);
    headPivot.add(head);
    lean.add(torso, neck, headPivot);

    function addArm(side) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.2, 0.76, 0.02);
      shoulder.rotation.z = side * 0.28;
      shoulder.rotation.x = -0.2;
      const upper = new THREE.Mesh(geo.upper, mats.dark);
      upper.position.y = -0.08;
      const elbow = new THREE.Group();
      elbow.position.y = -0.15;
      elbow.rotation.x = ELBOW_REST;
      const fore = new THREE.Mesh(geo.fore, accentStd);
      fore.position.y = -0.07;
      const hand = new THREE.Mesh(geo.hand, accentStd);
      hand.position.set(0, -0.1, 0.01);
      fore.add(hand);
      elbow.add(fore);
      shoulder.add(upper, elbow);
      lean.add(shoulder);
      return elbow;
    }

    const elbowL = addArm(-1);
    const elbowR = addArm(1);
    addMark(slot.mark, lean, { accentStd, accentBasic, mats, geo });

    const pick = new THREE.Mesh(geo.pick, mats.pick);
    pick.position.y = 0.62;
    pick.userData.botId = bot.id;
    lean.add(pick);

    const labelButton = document.createElement("button");
    labelButton.type = "button";
    labelButton.className = "bot-label";
    const labelName = document.createElement("span");
    labelName.className = "bot-label-name";
    labelName.textContent = bot.name;
    const labelBadge = document.createElement("span");
    labelBadge.className = "badge " + statusClass(bot.status);
    labelBadge.textContent = bot.status;
    labelButton.append(labelName, labelBadge);
    labelButton.addEventListener("click", (event) => {
      event.stopPropagation();
      window.BotHQ.select(bot.id);
    });
    const labelObj = new CSS2DObject(labelButton);
    labelObj.position.set(0, 1.42, 0);
    labelObj.center.set(0.5, 1);
    lean.add(labelObj);

    let question = null;
    let check = null;
    if (bot.status === "Waiting on Luke") {
      question = new THREE.Sprite(questionMat);
      question.position.set(0.32, 1.16, 0);
      question.scale.set(0.3, 0.3, 1);
      question.renderOrder = 2;
      lean.add(question);
    } else if (bot.status === "Done") {
      check = new THREE.Sprite(checkMat);
      check.position.set(0.32, 1.16, 0);
      check.scale.set(0.28, 0.28, 1);
      check.renderOrder = 2;
      lean.add(check);
    }

    station.add(worker);
    scene.add(station);
    workerGroups.push(worker);

    const phase = index * 0.85;
    const motion = motionFor(bot.status);
    if (reduceMotion) {
      headPivot.rotation.y = Math.sin(phase) * motion.headAmp;
      elbowL.rotation.x = ELBOW_REST + (motion.typeAmp > 0 ? 0.12 : 0);
      elbowR.rotation.x = ELBOW_REST - (motion.typeAmp > 0 ? 0.12 : 0);
    }

    const record = {
      id: bot.id,
      x: slot.x,
      z: slot.z,
      color,
      status: bot.status,
      phase,
      motion,
      worker,
      head: headPivot,
      elbowL,
      elbowR,
      screenMat,
      glowMat,
      question,
      check,
      labelEl: labelButton,
    };
    stations.push(record);
    byId[bot.id] = record;
  });

  function addMark(mark, lean, kit) {
    const { accentStd, accentBasic, mats: shared, geo: g } = kit;
    if (mark === "antenna") {
      const pole = new THREE.Mesh(g.antenna, accentStd);
      pole.position.set(0, 1.18, 0);
      const tip = new THREE.Mesh(g.antennaTip, accentBasic);
      tip.position.set(0, 1.28, 0);
      lean.add(pole, tip);
    } else if (mark === "mail") {
      const mail = new THREE.Mesh(g.mail, shared.paper);
      mail.position.set(0, 0.74, -0.1);
      lean.add(mail);
    } else if (mark === "nubs") {
      [-0.13, 0.13].forEach((x) => {
        const nub = new THREE.Mesh(g.nub, accentBasic);
        nub.position.set(x, 1.08, 0);
        lean.add(nub);
      });
    } else if (mark === "lamp") {
      const stalk = new THREE.Mesh(g.stalk, shared.dark);
      stalk.position.set(0, 1.16, 0);
      const bulb = new THREE.Mesh(g.bulb, shared.bulb);
      bulb.position.set(0, 1.24, 0);
      lean.add(stalk, bulb);
    } else if (mark === "bag") {
      const bag = new THREE.Mesh(g.bag, accentStd);
      bag.position.set(-0.22, 0.58, -0.02);
      lean.add(bag);
    } else if (mark === "headset") {
      const band = new THREE.Mesh(g.band, shared.dark);
      band.position.set(0, 1.1, 0);
      lean.add(band);
      [-0.12, 0.12].forEach((x) => {
        const pad = new THREE.Mesh(g.pad, accentBasic);
        pad.position.set(x, 1.02, 0);
        lean.add(pad);
      });
    } else if (mark === "radar") {
      const dish = new THREE.Mesh(g.radar, accentBasic);
      dish.position.set(0, 1.14, 0);
      lean.add(dish);
    } else if (mark === "coin") {
      const coin = new THREE.Mesh(g.coin, shared.coin);
      coin.rotation.x = Math.PI / 2;
      coin.position.set(0, 0.7, -0.1);
      lean.add(coin);
    } else if (mark === "fin") {
      const fin = new THREE.Mesh(g.fin, accentStd);
      fin.position.set(0, 1.08, -0.08);
      lean.add(fin);
    }
  }

  function highlight(id) {
    stations.forEach((station) => {
      station.labelEl.classList.toggle("is-selected", station.id === id);
    });
    const station = id ? byId[id] : null;
    if (!station) {
      ring.visible = false;
      return;
    }
    ring.position.set(station.x, 0.035, station.z);
    ring.material.color.setHex(station.color);
    ring.visible = true;
  }

  document.addEventListener("bothq:select", (event) => {
    highlight(event.detail && event.detail.id);
  });
  document.addEventListener("bothq:close", () => highlight(null));
  if (window.BotHQ.selectedId) highlight(window.BotHQ.selectedId);

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let down = null;

  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    down = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  window.addEventListener("pointerup", (event) => {
    if (!down || event.pointerId !== down.id) return;
    const dx = event.clientX - down.x;
    const dy = event.clientY - down.y;
    const at = down;
    down = null;
    if (dx * dx + dy * dy > 36) return;
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    pointerNdc.set(
      ((at.x - rect.left) / rect.width) * 2 - 1,
      -((at.y - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(workerGroups, true);
    if (!hits.length) return;
    let node = hits[0].object;
    let id = "";
    while (node) {
      if (node.userData && node.userData.botId) {
        id = node.userData.botId;
        break;
      }
      node = node.parent;
    }
    if (id && window.BotHQ) window.BotHQ.select(id);
  });
  renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());

  let resumeTimer = 0;
  controls.addEventListener("start", () => {
    controls.autoRotate = false;
    window.clearTimeout(resumeTimer);
    const hint = document.getElementById("hint");
    if (hint) hint.hidden = true;
  });
  controls.addEventListener("end", () => {
    if (reduceMotion) return;
    resumeTimer = window.setTimeout(() => {
      controls.autoRotate = true;
    }, 2400);
  });

  let framed = false;
  function resize() {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (width < 2 || height < 2) return;
    if (!framed) {
      framed = true;
      const home = width < 760 ? HOME.narrow : HOME.wide;
      camera.fov = home.fov;
      camera.position.set(home.position[0], home.position[1], home.position[2]);
      controls.target.set(home.target[0], home.target[1], home.target[2]);
    }
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
    labelRenderer.setSize(width, height);
    controls.update();
  }

  const observer = new ResizeObserver(() => resize());
  observer.observe(viewport);
  resize();

  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    showFallback("The 3D view stopped. The roster lists the same office.");
    renderer.setAnimationLoop(null);
  }, { once: true });

  const clock = new THREE.Clock();
  let announced = false;

  function tick() {
    const t = clock.getElapsedTime();
    if (!reduceMotion) {
      stations.forEach((station) => {
        const motion = station.motion;
        station.worker.position.y = Math.sin(t * motion.bob + station.phase) * motion.bobAmp;
        station.head.rotation.y = Math.sin(t * motion.head + station.phase * 1.7) * motion.headAmp;
        const swing = motion.typeAmp > 0 ? Math.sin(t * motion.type + station.phase) * motion.typeAmp : 0;
        station.elbowL.rotation.x = ELBOW_REST + swing;
        station.elbowR.rotation.x = ELBOW_REST - swing;
        const pulse = 0.8 + 0.2 * Math.sin(t * motion.glow + station.phase);
        station.screenMat.color.setScalar(pulse);
        station.glowMat.opacity = (motion.glow > 1.5 ? 0.18 : 0.08) + 0.06 * Math.sin(t * motion.glow + station.phase);
        if (station.question) {
          const q = 0.82 + 0.28 * (0.5 + 0.5 * Math.sin(t * 3.4 + station.phase));
          station.question.scale.set(0.3 * q, 0.3 * q, 1);
        }
        if (station.check) {
          const c = 0.92 + 0.08 * Math.sin(t * 1.7 + station.phase);
          station.check.scale.set(0.28 * c, 0.28 * c, 1);
        }
      });
      const qWave = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 3.4));
      questionMat.opacity = qWave;
      checkMat.opacity = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.7));
      if (ring.visible) ring.material.opacity = 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2.4));
    }
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    if (!announced) {
      announced = true;
      hideLoading();
      window.__HQ_READY__ = true;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) renderer.setAnimationLoop(null);
    else renderer.setAnimationLoop(tick);
  });
  renderer.setAnimationLoop(tick);
}

async function boot() {
  const api = await waitForRoster();
  if (!api || api.error || !api.bots || !api.bots.length) {
    showFallback(api && api.error ? api.error : "Could not load status.json.");
    return;
  }
  if (!hasWebGL()) {
    showFallback("This browser can't draw the 3D floor. The roster lists the same office.");
    return;
  }
  try {
    startScene(api.bots);
  } catch (err) {
    console.error(err);
    showFallback("The 3D view could not start. The roster lists the same office.");
  }
}

boot();
