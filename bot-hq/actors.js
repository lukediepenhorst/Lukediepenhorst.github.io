import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BRAND } from "./brand.js";

/*
  The nine bots: a simple skeleton, a walk/sit/type pose, and a to-do list.

  Each bot's to-do list is a queue of stops: "walk to the cabinet, pick up a
  folder, carry it to another desk, then sit and type." Walking uses the
  hallway graph from office.js, so they go through doors instead of walls.

  Limbs are InstancedMesh (one draw call for every thigh, and so on). We still
  pose a normal parent/child skeleton, then copy those bone positions onto the
  instances each frame. That keeps the code easy to read and the phone happy.
*/

const THIGH = 0.32;
const SHIN = 0.3;
const UPPER = 0.26;
const FORE = 0.24;
const HIP_Y = THIGH + SHIN;

// Face looks along local +Z. Negative hip X swings a foot toward +Z (forward).
// If a walk cycle ever looks backwards, flip the sign of SWING.
const SWING = 0.62;
const SIT = {
  hip: -1.25,
  knee: 1.35,
  shoulder: -0.95,
  elbow: -1.05,
  drop: 0.2,
};

const PAPER = new THREE.Color("#e7cb8c");

const HOME_FLOOR = {
  texts: 0,
  "opportunity-scout": 41,
  "personal-shopper": 41,
  "chief-of-staff": 42,
  "inbox-manager": 42,
  "content-coach": 42,
  "business-lab": 43,
  "goal-tracker": 43,
  "money-manager": 44,
};

function turnToward(current, target, dt) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const k = 1 - Math.exp(-10 * dt);
  return current + delta * k;
}

function iconTexture(text, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(24, 18, 14, 0.9)";
  ctx.beginPath();
  ctx.arc(64, 64, 56, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "700 72px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function eyeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f5fbff";
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = "#1c2430";
  ctx.beginPath();
  ctx.arc(40, 34, 11, 0, Math.PI * 2);
  ctx.arc(88, 34, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(36, 28, 5, 5);
  ctx.fillRect(84, 28, 5, 5);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function shadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, "rgba(40, 24, 16, 0.5)");
  g.addColorStop(1, "rgba(40, 24, 16, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function paintGeo(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geo;
}

function bubbleTexture(glyph, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(247, 241, 232, 0.95)";
  ctx.beginPath();
  ctx.arc(64, 58, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(48, 96);
  ctx.lineTo(58, 78);
  ctx.lineTo(72, 96);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = "700 42px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, 64, 60);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * @param {THREE.Scene} scene
 * @param {ReturnType<import("./office.js").buildOffice>} office
 * @param {Array} bots
 * @param {{reduceMotion?: boolean}} [options]
 */
export function createCrew(scene, office, bots, options) {
  const reduce = !!(options && options.reduceMotion);
  const count = bots.length;

  const limbMat = new THREE.MeshLambertMaterial({ color: 0x2a3038, flatShading: true });
  const paperMat = new THREE.MeshLambertMaterial({ color: PAPER, flatShading: true });
  const coinMat = new THREE.MeshLambertMaterial({
    color: 0xf0d48a,
    emissive: 0xf0d48a,
    emissiveIntensity: 0.25,
    flatShading: true,
  });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff3cc });
  const eyeMat = new THREE.MeshBasicMaterial({ map: eyeTexture() });
  const pickMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });

  const geos = {
    torso: new THREE.BoxGeometry(0.36, 0.4, 0.22),
    head: new THREE.BoxGeometry(0.32, 0.3, 0.3),
    eye: new THREE.PlaneGeometry(0.22, 0.09),
    thigh: new THREE.BoxGeometry(0.11, THIGH, 0.11),
    shin: new THREE.BoxGeometry(0.1, SHIN, 0.1),
    upper: new THREE.BoxGeometry(0.09, UPPER, 0.09),
    fore: new THREE.BoxGeometry(0.08, FORE, 0.08),
    folder: new THREE.BoxGeometry(0.2, 0.035, 0.26),
    tab: new THREE.BoxGeometry(0.1, 0.028, 0.07),
    pick: new THREE.BoxGeometry(0.7, 1.7, 0.7),
  };

  function makeBucket(geometry) {
    const mesh = new THREE.InstancedMesh(geometry, limbMat, count * 2);
    // The mesh sits at the origin; the copies are on the bots. Culling the
    // origin would hide every leg as soon as you pan away from the middle.
    mesh.frustumCulled = false;
    mesh.raycast = function () {};
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    return { mesh: mesh, anchors: [] };
  }

  const thighs = makeBucket(geos.thigh);
  const shins = makeBucket(geos.shin);
  const uppers = makeBucket(geos.upper);
  const fores = makeBucket(geos.fore);

  const questionMat = new THREE.SpriteMaterial({
    map: iconTexture("?", "#ffd592"),
    transparent: true,
    depthWrite: false,
  });
  const checkMat = new THREE.SpriteMaterial({
    map: iconTexture("✓", "#d9ffe8"),
    transparent: true,
    depthWrite: false,
  });

  const shadowMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: shadowTexture(),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
    count
  );
  shadowMesh.frustumCulled = false;
  shadowMesh.raycast = function () {};
  shadowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(shadowMesh);
  const shadowDummy = new THREE.Object3D();

  const emoteMats = {
    chat: new THREE.SpriteMaterial({ map: bubbleTexture("hi", BRAND.colors.teal), transparent: true, depthWrite: false }),
    meet: new THREE.SpriteMaterial({ map: bubbleTexture("…", BRAND.colors.ink), transparent: true, depthWrite: false }),
    mail: new THREE.SpriteMaterial({ map: bubbleTexture("✉", BRAND.colors.amber), transparent: true, depthWrite: false }),
    five: new THREE.SpriteMaterial({ map: bubbleTexture("yo", BRAND.colors.amber), transparent: true, depthWrite: false }),
    yes: new THREE.SpriteMaterial({ map: bubbleTexture("yes", "#3ddc8a"), transparent: true, depthWrite: false }),
    cheer: new THREE.SpriteMaterial({ map: bubbleTexture("Woo!", "#ffb15a"), transparent: true, depthWrite: false }),
  };
  const PHRASES = [
    "Hey boss!",
    "Great call, boss",
    "Thanks for the direction, Luke",
    "On it, Luke!",
    "Morning, CEO!",
  ];
  function phraseTexture(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(247, 241, 232, 0.96)";
    ctx.fillRect(8, 16, 496, 96);
    ctx.fillStyle = "#1c1612";
    ctx.font = "700 42px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const phraseMats = PHRASES.map((text) => new THREE.SpriteMaterial({
    map: phraseTexture(text),
    transparent: true,
    depthWrite: false,
  }));
  const phraseSprites = [0, 1].map(() => {
    const sprite = new THREE.Sprite(phraseMats[0]);
    sprite.visible = false;
    sprite.scale.set(1.5, 0.38, 1);
    sprite.raycast = function () {};
    scene.add(sprite);
    return sprite;
  });
  let lastPhrase = "";
  let groupVisible = true;
  let cheering = false;
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xf7f3ea })
  );
  ball.position.set(2.35, 0.86, 5.55);
  ball.raycast = function () {};
  scene.add(ball);
  const bubbles = [0, 1, 2].map(() => {
    const sprite = new THREE.Sprite(emoteMats.chat);
    sprite.visible = false;
    sprite.scale.setScalar(0.38);
    sprite.raycast = function () {};
    scene.add(sprite);
    return sprite;
  });

  const crew = [];

  function addBone(parent, x, y, z, length, bucket) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    parent.add(pivot);
    const anchor = new THREE.Object3D();
    anchor.position.y = -length / 2;
    pivot.add(anchor);
    bucket.anchors.push(anchor);
    return pivot;
  }

  const propMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

  // One mesh per bot, so a prop is a single draw instead of a handful of parts.
  function makeProp(parts) {
    const list = parts.map((part) => {
      const geo = part.geo.clone();
      if (part.rx) geo.rotateX(part.rx);
      if (part.ry) geo.rotateY(part.ry);
      geo.translate(part.x || 0, part.y || 0, part.z || 0);
      paintGeo(geo, part.color);
      return geo;
    });
    const merged = mergeGeometries(list, false);
    list.forEach((geo) => geo.dispose());
    const mesh = new THREE.Mesh(merged, propMat);
    mesh.raycast = function () {};
    return mesh;
  }

  function propFor(id, accent) {
    const ink = BRAND.colors.ink;
    const cream = BRAND.colors.cream;
    const wood = BRAND.colors.wood;
    if (id === "chief-of-staff") {
      return makeProp([
        { geo: new THREE.BoxGeometry(0.16, 0.22, 0.02), color: ink, x: 0.02, y: 0.02, z: 0.13 },
        { geo: new THREE.BoxGeometry(0.13, 0.16, 0.01), color: accent, x: 0.02, y: 0.02, z: 0.145 },
      ]);
    }
    if (id === "inbox-manager") {
      return makeProp([
        { geo: new THREE.BoxGeometry(0.2, 0.13, 0.025), color: cream, y: 0.04, z: 0.14 },
        { geo: new THREE.BoxGeometry(0.2, 0.015, 0.01), color: accent, y: 0.0, z: 0.155 },
      ]);
    }
    if (id === "texts") {
      return makeProp([
        { geo: new THREE.BoxGeometry(0.07, 0.13, 0.015), color: ink, x: 0.16, y: 0.12, z: 0.08 },
        { geo: new THREE.BoxGeometry(0.055, 0.09, 0.01), color: accent, x: 0.16, y: 0.12, z: 0.09 },
      ]);
    }
    if (id === "business-lab") {
      return makeProp([
        { geo: new THREE.BoxGeometry(0.025, 0.1, 0.025), color: ink, y: 0.22, z: 0 },
        { geo: new THREE.SphereGeometry(0.055, 6, 5), color: "#fff3cc", y: 0.3, z: 0 },
      ]);
    }
    if (id === "personal-shopper") {
      return makeProp([
        { geo: new THREE.BoxGeometry(0.14, 0.15, 0.08), color: accent, x: -0.24, y: -0.02, z: 0.02 },
        { geo: new THREE.BoxGeometry(0.1, 0.02, 0.02), color: wood, x: -0.24, y: 0.08, z: 0.02 },
      ]);
    }
    if (id === "content-coach") {
      return makeProp([
        { geo: new THREE.BoxGeometry(0.16, 0.1, 0.08), color: ink, y: 0.02, z: 0.14 },
        { geo: new THREE.CylinderGeometry(0.035, 0.035, 0.04, 8), color: accent, y: 0.02, z: 0.18, rx: Math.PI / 2 },
      ]);
    }
    if (id === "opportunity-scout") {
      return makeProp([
        { geo: new THREE.CylinderGeometry(0.035, 0.04, 0.1, 7), color: ink, x: -0.05, y: 0.08, z: 0.16, rx: Math.PI / 2 },
        { geo: new THREE.CylinderGeometry(0.035, 0.04, 0.1, 7), color: ink, x: 0.05, y: 0.08, z: 0.16, rx: Math.PI / 2 },
        { geo: new THREE.BoxGeometry(0.12, 0.02, 0.02), color: accent, y: 0.08, z: 0.14 },
      ]);
    }
    if (id === "money-manager") {
      return makeProp([
        { geo: new THREE.BoxGeometry(0.14, 0.18, 0.02), color: ink, y: 0.02, z: 0.13 },
        { geo: new THREE.CylinderGeometry(0.045, 0.045, 0.02, 8), color: "#f0d48a", x: 0.1, y: 0.08, z: 0.15, rx: Math.PI / 2 },
      ]);
    }
    return makeProp([
      { geo: new THREE.BoxGeometry(0.14, 0.18, 0.02), color: wood, x: 0.16, y: 0.02, z: 0.08 },
      { geo: new THREE.BoxGeometry(0.1, 0.1, 0.01), color: cream, x: 0.16, y: 0.02, z: 0.095 },
      { geo: new THREE.BoxGeometry(0.04, 0.06, 0.02), color: accent, x: 0.16, y: 0.16, z: 0.08 },
    ]);
  }

  bots.forEach((info, index) => {
    const desk = office.desks[info.id];
    const mat = new THREE.MeshLambertMaterial({
      color: info.accent,
      emissive: info.accent,
      emissiveIntensity: 0.12,
      flatShading: true,
    });

    const group = new THREE.Group();
    group.name = info.id;
    const pelvis = new THREE.Group();
    group.add(pelvis);

    const torso = new THREE.Mesh(geos.torso, mat);
    torso.position.y = HIP_Y + 0.22;
    pelvis.add(torso);

    const head = new THREE.Group();
    head.position.y = HIP_Y + 0.58;
    const headMesh = new THREE.Mesh(geos.head, mat);
    const eyes = new THREE.Mesh(geos.eye, eyeMat);
    eyes.position.set(0, 0.04, 0.16);
    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.025, 0.01),
      new THREE.MeshBasicMaterial({ color: 0x1c1612 })
    );
    mouth.position.set(0, -0.07, 0.16);
    head.add(headMesh, eyes, mouth);
    pelvis.add(head);
    const prop = propFor(info.id, info.accent);
    const propOnHead = info.id === "business-lab" || info.id === "opportunity-scout" || info.id === "texts";
    (propOnHead ? head : torso).add(prop);

    const hipL = addBone(pelvis, -0.1, HIP_Y, 0, THIGH, thighs);
    const kneeL = addBone(hipL, 0, -THIGH, 0, SHIN, shins);
    const hipR = addBone(pelvis, 0.1, HIP_Y, 0, THIGH, thighs);
    const kneeR = addBone(hipR, 0, -THIGH, 0, SHIN, shins);
    const shoulderL = addBone(pelvis, -0.24, HIP_Y + 0.36, 0, UPPER, uppers);
    const elbowL = addBone(shoulderL, 0, -UPPER, 0, FORE, fores);
    const shoulderR = addBone(pelvis, 0.24, HIP_Y + 0.36, 0, UPPER, uppers);
    const elbowR = addBone(shoulderR, 0, -UPPER, 0, FORE, fores);
    shoulderL.rotation.z = 0.22;
    shoulderR.rotation.z = -0.22;

    const hand = new THREE.Group();
    hand.position.y = -FORE;
    elbowR.add(hand);
    const folder = new THREE.Group();
    const folderBody = new THREE.Mesh(geos.folder, paperMat);
    const folderTab = new THREE.Mesh(geos.tab, mat);
    folderTab.position.set(0, 0.03, -0.09);
    folder.add(folderBody, folderTab);
    folder.position.set(0, 0, 0.08);
    folder.rotation.x = -0.5;
    folder.visible = false;
    hand.add(folder);

    // Invisible tap target. Layer 1 is not drawn (the camera only shows layer 0)
    // but the click test looks at layer 1, which makes phone taps forgiving.
    const pick = new THREE.Mesh(geos.pick, pickMat);
    pick.position.y = 0.9;
    pick.layers.set(1);
    pick.userData.botId = info.id;
    group.add(pick);

    let badge = null;
    if (info.status === "Waiting on Luke") {
      badge = new THREE.Sprite(questionMat);
      badge.position.set(0.28, 1.45, 0);
      badge.scale.setScalar(0.34);
      group.add(badge);
    } else if (info.status === "Done") {
      badge = new THREE.Sprite(checkMat);
      badge.position.set(0.28, 1.45, 0);
      badge.scale.setScalar(0.32);
      group.add(badge);
    }

    const wrap = document.createElement("div");
    wrap.className = "bot-label-wrap";
    const labelEl = document.createElement("button");
    labelEl.type = "button";
    labelEl.className = "bot-label";
    const nameEl = document.createElement("span");
    nameEl.className = "bot-label-name";
    nameEl.textContent = info.name;
    const badgeEl = document.createElement("span");
    badgeEl.className = "badge " + (window.BotStatus ? window.BotStatus.statusClass(info.status) : "");
    badgeEl.textContent = info.status;
    labelEl.append(nameEl, badgeEl);
    labelEl.addEventListener("click", (event) => {
      event.stopPropagation();
      if (window.BotHQ) window.BotHQ.select(info.id);
    });
    wrap.append(labelEl);
    const labelObj = new CSS2DObject(wrap);
    labelObj.position.set(0, 1.68, 0);
    labelObj.center.set(0.5, 1);
    group.add(labelObj);

    scene.add(group);

    const seatId = desk ? desk.seat : "ln-seat";
    const frontId = desk ? desk.front : "ln-seat";
    const bot = {
      id: info.id,
      name: info.name,
      status: info.status,
      accent: info.accent,
      index: index,
      group: group,
      pelvis: pelvis,
      head: head,
      hipL: hipL,
      hipR: hipR,
      kneeL: kneeL,
      kneeR: kneeR,
      shoulderL: shoulderL,
      shoulderR: shoulderR,
      elbowL: elbowL,
      elbowR: elbowR,
      folder: folder,
      folderNow: 0,
      prop: prop,
      emote: "",
      badge: badge,
      labelEl: labelEl,
      seatId: seatId,
      frontId: frontId,
      nodeId: seatId,
      x: 0,
      z: 0,
      path: [],
      queue: [],
      mode: "act",
      action: null,
      timer: 1,
      face: Math.PI,
      carrying: false,
      sit: 0,
      reach: 0,
      gait: 0,
      phase: index * 0.8,
      phase0: index * 1.3,
      speed: 1.55 + (index % 4) * 0.1,
      lane: (index % 3 - 1) * 0.12,
      laneNow: 0,
      hi: 0,
      hiCool: 0,
      wave: 0,
      greetYaw: 0,
      greetCool: 0,
      phrase: "",
      eyes: eyes,
      mouth: mouth,
      nod: 0,
      homeFloor: HOME_FLOOR[info.id] || 42,
      parked: false,
    };
    crew.push(bot);
  });

  function pathPoints(ids) {
    const out = [];
    for (let i = 0; i < ids.length; i += 1) {
      const n = office.nodes[ids[i]];
      if (n) out.push({ id: ids[i], x: n.x, z: n.z });
    }
    return out;
  }

  function placeAlong(bot, ids, fraction) {
    if (!ids || ids.length < 2) return false;
    const pts = pathPoints(ids);
    let total = 0;
    const lens = [];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
      lens.push(len);
      total += len;
    }
    let remain = total * Math.min(0.9, Math.max(0.12, fraction));
    for (let i = 0; i < lens.length; i += 1) {
      if (remain <= lens[i] || i === lens.length - 1) {
        const u = lens[i] === 0 ? 0 : Math.min(1, remain / lens[i]);
        bot.x = pts[i].x + (pts[i + 1].x - pts[i].x) * u;
        bot.z = pts[i].z + (pts[i + 1].z - pts[i].z) * u;
        bot.nodeId = pts[i].id;
        bot.path = pts.slice(i + 1);
        bot.mode = "walk";
        return bot.path.length > 0;
      }
      remain -= lens[i];
    }
    return false;
  }

  function faceTravel(bot) {
    const target = bot.path[0];
    if (!target) return;
    bot.group.rotation.y = Math.atan2(target.x - bot.x, target.z - bot.z);
  }

  function standAt(bot, nodeId, pose, seconds) {
    const n = office.nodes[nodeId];
    bot.x = n.x;
    bot.z = n.z;
    bot.nodeId = nodeId;
    bot.path = [];
    bot.mode = "act";
    bot.action = { node: nodeId, pose: pose, seconds: seconds };
    bot.timer = seconds;
    bot.face = n.face !== undefined ? n.face : Math.PI;
    bot.group.rotation.y = bot.face;
    bot.sit = pose === "sit" ? 1 : 0;
    bot.gait = 0;
  }

  function beginWalk(bot, nodeId) {
    if (bot.nodeId === nodeId) return false;
    const ids = office.findPath(bot.nodeId, nodeId);
    if (!ids || ids.length < 2) {
      const n = office.nodes[nodeId];
      if (n) {
        bot.nodeId = nodeId;
        bot.x = n.x;
        bot.z = n.z;
      }
      return false;
    }
    bot.path = pathPoints(ids).slice(1);
    bot.mode = "walk";
    return true;
  }

  function beginAct(bot) {
    const item = bot.queue[0];
    if (!item) {
      fillQueue(bot);
    }
    const next = bot.queue[0];
    bot.mode = "act";
    bot.action = next;
    bot.timer = next.seconds;
    bot.emote = next.emote || "";
    if (next.carry === "start") bot.carrying = true;
    const n = office.nodes[next.node];
    bot.face = n && n.face !== undefined ? n.face : bot.group.rotation.y;
  }

  function startNext(bot) {
    if (reduce) {
      standAt(bot, bot.seatId, "sit", 999);
      bot.queue = [{ node: bot.seatId, pose: "sit", seconds: 999 }];
      bot.action = bot.queue[0];
      return;
    }
    if (!bot.queue.length) fillQueue(bot);
    const walking = beginWalk(bot, bot.queue[0].node);
    if (!walking) beginAct(bot);
  }

  function finishAct(bot) {
    const item = bot.queue.shift();
    if (item && item.carry === "end") bot.carrying = false;
    startNext(bot);
  }

  function arrive(bot) {
    const item = bot.queue[0];
    if (item && item.node === bot.nodeId) beginAct(bot);
    else startNext(bot);
  }

  function fillQueue(bot) {
    // Odds for the next chore. Change these if you want more coffee breaks.
    const roll = Math.random();
    const home = bot.seatId;
    if (bot.status === "Done" && roll < 0.22) {
      bot.queue = [
        { node: home, pose: "celebrate", seconds: 1.6, emote: "yes" },
        { node: home, pose: "sit", seconds: rand(5, 9) },
      ];
      return;
    }
    if (roll < 0.34) {
      const pickups = [bot.frontId, "sv-files", "cab-east"];
      const drops = ["sv-files", "cab-east", "sv-rack"];
      crew.forEach((other) => {
        if (other.id !== bot.id) drops.push(other.frontId);
      });
      const from = pick(pickups);
      let to = pick(drops);
      let guard = 0;
      while (to === from && guard < 6) {
        to = pick(drops);
        guard += 1;
      }
      bot.queue = [
        { node: from, pose: "reach", seconds: 0.65, carry: "start" },
        { node: to, pose: "reach", seconds: 0.75, carry: "end" },
        { node: home, pose: "sit", seconds: rand(5, 10) },
      ];
    } else if (roll < 0.48) {
      const spot = Math.random() < 0.6 ? "br-coffee" : "br-hang";
      bot.queue = [
        { node: spot, pose: spot === "br-coffee" ? "sip" : "stand", seconds: rand(2.8, 5), emote: "chat" },
        { node: home, pose: "sit", seconds: rand(5, 9) },
      ];
    } else if (roll < 0.6) {
      const present = Math.random() < 0.45;
      bot.queue = [
        {
          node: present ? "mt-north" : "mt-s-mid",
          pose: present ? "present" : "stand",
          seconds: rand(3.2, 5.5),
          emote: "meet",
        },
        { node: home, pose: "sit", seconds: rand(4.5, 9) },
      ];
    } else if (roll < 0.72) {
      const game = Math.random() < 0.5 ? "gm-arcade" : Math.random() < 0.5 ? "pp-n" : "pp-s";
      bot.queue = [
        { node: game, pose: game === "gm-arcade" ? "arcade" : "play", seconds: rand(3.5, 6), emote: "chat" },
        { node: home, pose: "sit", seconds: rand(4.5, 8) },
      ];
    } else if (roll < 0.82) {
      bot.queue = [
        { node: "ln-seat", pose: "lounge", seconds: rand(3.5, 6.5) },
        { node: home, pose: "sit", seconds: rand(4.5, 8) },
      ];
    } else if (roll < 0.9) {
      bot.queue = [
        { node: bot.frontId, pose: "stretch", seconds: rand(1.8, 2.8) },
        { node: home, pose: "sit", seconds: rand(4.5, 8) },
      ];
    } else {
      const spot = Math.random() < 0.5 ? "lb-wait" : "ex-view";
      bot.queue = [
        { node: spot, pose: "stand", seconds: rand(2.4, 4.5) },
        { node: home, pose: "sit", seconds: rand(4.5, 8) },
      ];
    }
  }

  // Drop whatever they were doing and walk somewhere new. Used for group meetings.
  function sendTo(bot, queue) {
    bot.queue = queue;
    bot.carrying = false;
    bot.emote = (queue[0] && queue[0].emote) || "";
    const walking = beginWalk(bot, queue[0].node);
    if (!walking) beginAct(bot);
  }

  let gameIn = 8;
  function maybeGame(dt) {
    if (reduce) return;
    gameIn -= dt;
    if (gameIn > 0) return;
    gameIn = 16 + Math.random() * 10;
    const free = crew.filter((bot) => bot.mode === "act" && bot.action && bot.action.pose === "sit" && !bot.carrying);
    if (free.length < 2) return;
    const a = free.splice(Math.floor(Math.random() * free.length), 1)[0];
    const b = free.splice(Math.floor(Math.random() * free.length), 1)[0];
    sendTo(a, [
      { node: "pp-n", pose: "play", seconds: rand(5, 7), emote: "chat" },
      { node: a.seatId, pose: "sit", seconds: rand(4, 7) },
    ]);
    sendTo(b, [
      { node: "pp-s", pose: "play", seconds: rand(5, 7), emote: "chat" },
      { node: b.seatId, pose: "sit", seconds: rand(4, 7) },
    ]);
  }

  let meetingIn = 9;
  function maybeMeeting(dt) {
    if (reduce) return;
    meetingIn -= dt;
    if (meetingIn > 0) return;
    meetingIn = 26 + Math.random() * 14;
    const free = crew.filter((bot) => bot.mode === "act" && bot.action && bot.action.pose === "sit" && !bot.carrying);
    if (free.length < 3) return;
    const spots = ["mt-s-mid", "mt-west", "mt-east"];
    for (let i = 0; i < 3; i += 1) {
      const bot = free.splice(Math.floor(Math.random() * free.length), 1)[0];
      sendTo(bot, [
        { node: spots[i], pose: "stand", seconds: rand(5, 8), emote: "meet" },
        { node: bot.seatId, pose: "sit", seconds: rand(5, 9) },
      ]);
    }
  }

  function scriptStart(bot) {
    if (reduce || !office.desks[bot.id]) {
      standAt(bot, bot.seatId, "sit", 999);
      bot.queue = [{ node: bot.seatId, pose: "sit", seconds: 999 }];
      return;
    }
    const seat = bot.seatId;
    const front = bot.frontId;
    if (bot.id === "inbox-manager") {
      const ids = office.findPath(front, office.desks["chief-of-staff"].front);
      if (placeAlong(bot, ids, 0.38)) {
        bot.carrying = true;
        bot.folderNow = 1;
        bot.folder.visible = true;
        bot.gait = 1;
        bot.phase = 2.1;
        faceTravel(bot);
        bot.queue = [
          { node: office.desks["chief-of-staff"].front, pose: "reach", seconds: 0.8, carry: "end" },
          { node: seat, pose: "sit", seconds: 7 },
        ];
        return;
      }
    }
    if (bot.id === "content-coach") {
      const ids = office.findPath("mt-door", "mt-north");
      if (placeAlong(bot, ids, 0.4)) {
        bot.gait = 1;
        bot.phase = 1.2;
        faceTravel(bot);
        bot.queue = [
          { node: "mt-north", pose: "present", seconds: 5.5, emote: "meet" },
          { node: seat, pose: "sit", seconds: 6.5 },
        ];
        return;
      }
    }
    if (bot.id === "opportunity-scout") {
      const ids = office.findPath("sv-door", "sv-files");
      if (placeAlong(bot, ids, 0.48)) {
        bot.gait = 1;
        bot.phase = 0.6;
        faceTravel(bot);
        bot.queue = [
          { node: "sv-files", pose: "reach", seconds: 0.7, carry: "start" },
          { node: office.desks["goal-tracker"].front, pose: "reach", seconds: 0.8, carry: "end" },
          { node: seat, pose: "sit", seconds: 6 },
        ];
        return;
      }
    }
    if (bot.id === "business-lab") {
      standAt(bot, "br-hang", "stand", 6);
      bot.emote = "chat";
      bot.face = Math.atan2(8.35 - 6.45, 6.45 - 3.25);
      bot.group.rotation.y = bot.face;
      bot.queue = [
        { node: "br-hang", pose: "stand", seconds: 6, emote: "chat" },
        { node: seat, pose: "sit", seconds: 7 },
      ];
      return;
    }
    if (bot.id === "money-manager") {
      standAt(bot, "br-coffee", "sip", 6);
      bot.emote = "chat";
      bot.face = Math.atan2(6.45 - 8.35, 3.25 - 6.45);
      bot.group.rotation.y = bot.face;
      bot.queue = [
        { node: "br-coffee", pose: "sip", seconds: 6, emote: "chat" },
        { node: seat, pose: "sit", seconds: 7 },
      ];
      return;
    }
    if (bot.id === "goal-tracker") {
      standAt(bot, "ln-seat", "lounge", 8);
      bot.queue = [
        { node: "ln-seat", pose: "lounge", seconds: 8 },
        { node: seat, pose: "sit", seconds: 7 },
      ];
      return;
    }
    if (bot.id === "personal-shopper") {
      standAt(bot, seat, "celebrate", 2.2);
      bot.emote = "yes";
      bot.queue = [
        { node: seat, pose: "celebrate", seconds: 2.2, emote: "yes" },
        { node: seat, pose: "sit", seconds: 8 },
      ];
      return;
    }
    if (bot.id === "texts") {
      standAt(bot, "gm-arcade", "arcade", 7);
      bot.queue = [
        { node: "gm-arcade", pose: "arcade", seconds: 7, emote: "chat" },
        { node: seat, pose: "sit", seconds: 7 },
      ];
      return;
    }
    const timers = {
      "chief-of-staff": 6.5,
    };
    const seconds = timers[bot.id] || 7;
    standAt(bot, seat, "sit", seconds);
    bot.queue = [{ node: seat, pose: "sit", seconds: seconds }];
  }

  crew.forEach(scriptStart);

  function stepWalk(bot, dt) {
    if (bot.wave > 0) {
      bot.group.rotation.y = turnToward(bot.group.rotation.y, bot.greetYaw, dt);
      return;
    }
    const target = bot.path[0];
    if (!target) {
      arrive(bot);
      return;
    }
    const dx = target.x - bot.x;
    const dz = target.z - bot.z;
    const dist = Math.hypot(dx, dz) || 0.0001;
    if (dist < 0.07) {
      bot.x = target.x;
      bot.z = target.z;
      bot.nodeId = target.id;
      bot.path.shift();
      if (!bot.path.length) arrive(bot);
      return;
    }
    const step = Math.min(dist, bot.speed * dt);
    bot.x += (dx / dist) * step;
    bot.z += (dz / dist) * step;
    bot.phase += step * 8.5;
    const yaw = Math.atan2(dx, dz);
    bot.group.rotation.y = turnToward(bot.group.rotation.y, yaw, dt);
  }

  function stepAct(bot, dt) {
    if (bot.face !== undefined) {
      bot.group.rotation.y = turnToward(bot.group.rotation.y, bot.face, dt);
    }
    bot.timer -= dt;
    if (bot.timer <= 0) finishAct(bot);
  }

  function applyPose(bot, t, dt) {
    const pose = bot.mode === "act" && bot.action ? bot.action.pose : "";
    let sitTarget = pose === "sit" || pose === "lounge" ? 1 : 0;
    if (bot.wave > 0) sitTarget = 0;
    const reachTarget = pose === "reach" || pose === "sip" ? 1 : 0;
    const gaitTarget = bot.mode === "walk" ? 1 : 0;
    const blend = Math.min(1, dt * 6);
    bot.sit += (sitTarget - bot.sit) * blend;
    bot.reach += (reachTarget - bot.reach) * blend;
    bot.gait += (gaitTarget - bot.gait) * blend;

    const swing = Math.sin(bot.phase) * SWING * bot.gait * (1 - bot.sit);
    bot.hipL.rotation.x = -swing + SIT.hip * bot.sit;
    bot.hipR.rotation.x = swing + SIT.hip * bot.sit;
    bot.kneeL.rotation.x = Math.max(0, -swing) * 1.15 * (1 - bot.sit) + SIT.knee * bot.sit;
    bot.kneeR.rotation.x = Math.max(0, swing) * 1.15 * (1 - bot.sit) + SIT.knee * bot.sit;

    const arm = swing * 0.85;
    let shL = 0.1 + arm;
    let shR = 0.1 - arm;
    let elL = -0.35;
    let elR = -0.35;
    shL += (SIT.shoulder - shL) * bot.sit;
    shR += (SIT.shoulder - shR) * bot.sit;
    elL += (SIT.elbow - elL) * bot.sit;
    elR += (SIT.elbow - elR) * bot.sit;

    if (bot.carrying && bot.sit < 0.4) {
      shR = -1.05;
      elR = -0.7;
    }
    if (bot.reach > 0.01) {
      shL = shL * (1 - bot.reach) + -1.05 * bot.reach;
      shR = shR * (1 - bot.reach) + -1.1 * bot.reach;
      elL = elL * (1 - bot.reach) + -0.95 * bot.reach;
      elR = elR * (1 - bot.reach) + -0.9 * bot.reach;
    }
    const typing = pose === "sit" && bot.status === "Working" && bot.reach < 0.15 && !reduce;
    if (typing) {
      const wiggle = Math.sin(t * 9.5 + bot.phase0) * 0.14;
      shL = SIT.shoulder + wiggle;
      shR = SIT.shoulder - wiggle;
      elL = SIT.elbow;
      elR = SIT.elbow + 0.05;
    } else if (pose === "sit" && bot.status !== "Working" && !reduce) {
      const wiggle = Math.sin(t * 1.4 + bot.phase0) * 0.1;
      shL = -0.35 + wiggle;
      shR = -0.35 - wiggle;
      elL = -0.4;
      elR = -0.45 + wiggle * 0.2;
    }
    if (pose === "stretch") {
      shL = -2.5;
      shR = -2.45;
      elL = -0.25;
      elR = -0.3;
    } else if (pose === "sip") {
      shR = -1.85;
      elR = -1.35;
      shL = -0.4;
    } else if (pose === "present") {
      shR = -1.35;
      elR = -0.25;
      shL = -0.35;
      elL = -0.5;
    } else if (pose === "thumb") {
      shR = -1.6;
      elR = -0.15;
      shL = -0.2;
    } else if (pose === "play") {
      const swingArm = Math.sin(t * 6 + bot.phase0);
      shR = -0.9 + swingArm * 0.8;
      elR = -0.7;
      shL = -0.4;
    } else if (pose === "arcade") {
      shL = -1.15;
      shR = -1.2;
      elL = -1.05;
      elR = -1.1;
    } else if (pose === "lounge") {
      shL = -0.45;
      shR = -0.55;
      elL = -0.7;
      elR = -0.85;
    } else if (pose === "celebrate" || (bot.status === "Done" && pose === "stand" && !reduce)) {
      shL = -2.15;
      shR = -2.15;
      elL = -0.35;
      elR = -0.35;
    }
    if (bot.hi > 0) {
      shR = -1.75;
      elR = -0.15;
      bot.hi = Math.max(0, bot.hi - dt);
      if (!bot.carrying) bot.emote = "five";
    }
    if (bot.wave > 0) {
      shR = -2.2;
      elR = -0.2;
      shL = -0.4;
      bot.wave = Math.max(0, bot.wave - dt);
      if (bot.wave <= 0) bot.phrase = "";
      bot.group.rotation.y = turnToward(bot.group.rotation.y, bot.greetYaw, dt);
    }
    bot.shoulderL.rotation.x = shL;
    bot.shoulderR.rotation.x = shR;
    bot.elbowL.rotation.x = elL;
    bot.elbowR.rotation.x = elR;
    if (!reduce && pose === "sit" && bot.status !== "Working") {
      const shrug = Math.sin(t * 1.1 + bot.phase0) * 0.06;
      bot.shoulderL.rotation.z = 0.22 + shrug;
      bot.shoulderR.rotation.z = -0.22 - shrug;
    }

    const bob = reduce ? 0 : Math.abs(Math.sin(bot.phase)) * 0.05 * bot.gait;
    const breathe = reduce ? 0 : Math.sin(t * 1.5 + bot.phase0) * 0.008;
    const party = !reduce && (pose === "celebrate" || (bot.status === "Done" && pose === "stand"))
      ? Math.abs(Math.sin(t * 9 + bot.phase0)) * 0.1
      : 0;
    const drop = pose === "lounge" ? 0.04 : SIT.drop;
    bot.pelvis.position.y = -drop * bot.sit + bob + breathe + party;

    let lookY = 0;
    let lookX = 0;
    if (!reduce && bot.mode === "act" && bot.sit > 0.45) {
      if (bot.status === "Waiting on Luke") {
        lookX = -0.32;
        lookY = Math.sin(t * 0.7 + bot.phase0) * 0.18;
      } else if (bot.status === "Done") {
        lookY = Math.sin(t * 0.55 + bot.phase0) * 0.22;
      } else if (bot.status === "Idle") {
        lookY = Math.sin(t * 0.45 + bot.phase0) * 0.4;
      } else {
        lookX = Math.sin(t * 2.4 + bot.phase0) * 0.05;
      }
    }
    if (bot.nod > 0) {
      lookX = Math.sin(t * 7) * 0.35;
      bot.nod = Math.max(0, bot.nod - dt);
    }
    bot.head.rotation.y += (lookY - bot.head.rotation.y) * Math.min(1, dt * 4);
    bot.head.rotation.x += (lookX - bot.head.rotation.x) * Math.min(1, dt * 4);
    if (bot.eyes && !reduce) {
      const blink = Math.sin(t * 0.85 + bot.phase0) > 0.96 ? 0.12 : 1;
      bot.eyes.scale.y = blink;
      bot.eyes.position.x = Math.sin(t * 0.35 + bot.phase0) * 0.03;
    }
    if (bot.mouth) {
      const happy = bot.status === "Done" || bot.wave > 0 || pose === "celebrate";
      const focused = bot.status === "Working";
      bot.mouth.scale.x = happy ? 1.25 : focused ? 0.55 : 0.8;
      bot.mouth.position.y = happy ? -0.055 : -0.075;
    }

    if (bot.badge && !reduce) {
      const pulse = 1 + 0.08 * Math.sin(t * 3 + bot.phase0);
      bot.badge.scale.setScalar(0.34 * pulse);
    }
    if (bot.prop && !reduce) {
      bot.prop.rotation.z = Math.sin(t * 1.6 + bot.phase0) * 0.06 * (1 - bot.gait);
    }
    if (bot.carrying) bot.emote = "mail";
    else if (bot.mode === "walk" && bot.emote === "mail") bot.emote = "";

    const folderTarget = bot.carrying ? 1 : 0;
    bot.folderNow += (folderTarget - bot.folderNow) * Math.min(1, dt * 8);
    bot.folder.visible = bot.folderNow > 0.05;
    if (bot.folder.visible) bot.folder.scale.setScalar(0.2 + 0.8 * bot.folderNow);

    const laneTarget = bot.mode === "walk" ? bot.lane : 0;
    bot.laneNow += (laneTarget - bot.laneNow) * Math.min(1, dt * 5);
    const yaw = bot.group.rotation.y;
    bot.group.position.set(
      bot.x + Math.cos(yaw) * bot.laneNow,
      0.035,
      bot.z - Math.sin(yaw) * bot.laneNow
    );
    bot.group.updateMatrixWorld(true);
  }

  function sync(bucket) {
    for (let i = 0; i < bucket.anchors.length; i += 1) {
      bucket.mesh.setMatrixAt(i, bucket.anchors[i].matrixWorld);
    }
    bucket.mesh.instanceMatrix.needsUpdate = true;
  }

  function update(dt, t) {
    maybeMeeting(dt);
    maybeGame(dt);
    const coffee = crew.filter((bot) => bot.mode === "act" && (bot.nodeId === "br-coffee" || bot.nodeId === "br-hang"));
    if (coffee.length >= 2) coffee.forEach((bot) => { bot.emote = "chat"; });
    for (let i = 0; i < crew.length; i += 1) {
      const a = crew[i];
      if (a.mode !== "walk" || t < a.hiCool) continue;
      for (let j = i + 1; j < crew.length; j += 1) {
        const b = crew[j];
        if (b.mode !== "walk" || t < b.hiCool) continue;
        const dist = Math.hypot(a.x - b.x, a.z - b.z);
        if (dist < 0.85) {
          a.hi = 0.45;
          b.hi = 0.45;
          a.hiCool = t + 3.2;
          b.hiCool = t + 3.2;
        }
      }
    }
    const playing = crew.some((bot) => bot.mode === "act" && bot.action && bot.action.pose === "play");
    if (playing) {
      const swing = Math.sin(t * 3.2);
      ball.position.set(2.35, 0.95 + Math.abs(Math.cos(t * 6.4)) * 0.35, 5.55 + swing * 0.7);
    } else {
      ball.position.set(2.35, 0.86, 5.55);
    }
    let bubble = 0;
    let phraseSlot = 0;
    bubbles.forEach((sprite) => { sprite.visible = false; });
    phraseSprites.forEach((sprite) => { sprite.visible = false; });
    for (let i = 0; i < crew.length; i += 1) {
      const bot = crew[i];
      if (!bot.group.visible) {
        shadowDummy.position.set(0, -20, 0);
        shadowDummy.scale.set(0.01, 0.01, 1);
        shadowDummy.updateMatrix();
        shadowMesh.setMatrixAt(i, shadowDummy.matrix);
        continue;
      }
      if (bot.mode === "walk") stepWalk(bot, dt);
      else stepAct(bot, dt);
      applyPose(bot, t, dt);
      shadowDummy.position.set(bot.group.position.x, 0.05, bot.group.position.z);
      shadowDummy.rotation.x = -Math.PI / 2;
      shadowDummy.scale.set(0.7, 0.55, 1);
      shadowDummy.updateMatrix();
      shadowMesh.setMatrixAt(i, shadowDummy.matrix);
      if (bot.phrase && phraseSlot < phraseSprites.length) {
        const sprite = phraseSprites[phraseSlot];
        const mat = phraseMats[PHRASES.indexOf(bot.phrase)];
        sprite.material = mat || phraseMats[0];
        sprite.position.set(bot.group.position.x, 1.9, bot.group.position.z);
        sprite.visible = groupVisible;
        lastPhrase = bot.phrase;
        phraseSlot += 1;
      } else if (bot.emote && emoteMats[bot.emote] && bubble < bubbles.length && !reduce) {
        const sprite = bubbles[bubble];
        sprite.material = emoteMats[bot.emote];
        sprite.position.set(bot.group.position.x + 0.22, 1.72, bot.group.position.z);
        sprite.visible = groupVisible;
        bubble += 1;
      }
    }
    shadowMesh.instanceMatrix.needsUpdate = true;
    sync(thighs);
    sync(shins);
    sync(uppers);
    sync(fores);
  }

  const BOARD = { x0: 1.2, z0: -7.8, x1: 9.6, z1: -2.6 };

  let activeFloor = 42;

  function setActiveFloor(id, stations) {
    activeFloor = id;
    crew.forEach((bot) => {
      const here = bot.homeFloor === id;
      bot.group.visible = here;
      if (!here) return;
      if (id === 42) {
        if (bot.parked) {
          bot.parked = false;
          standAt(bot, bot.seatId, "sit", 5);
        }
        return;
      }
      const spot = stations && stations[bot.id];
      if (!spot) return;
      bot.parked = true;
      bot.x = spot.x;
      bot.z = spot.z;
      bot.path = [];
      bot.mode = "act";
      bot.action = { pose: spot.pose, seconds: 9999 };
      bot.timer = 9999;
      bot.face = spot.face;
      bot.sit = spot.pose === "sit" ? 1 : 0;
      bot.group.rotation.y = spot.face;
      bot.group.position.set(spot.x, 0.035, spot.z);
    });
    const any = crew.some((bot) => bot.group.visible);
    groupVisible = any;
    ball.visible = id === 42;
    shadowMesh.visible = any;
    if (!any) {
      bubbles.forEach((sprite) => { sprite.visible = false; });
      phraseSprites.forEach((sprite) => { sprite.visible = false; });
    }
  }

  function setVisible(on) {
    setActiveFloor(on ? 42 : 0, null);
  }

  function playTask(id) {
    const bot = get(id);
    if (!bot || !bot.group.visible) return;
    bot.wave = 1.1;
    bot.nod = 1.1;
    bot.greetYaw = bot.group.rotation.y;
  }

  function greet(x, z, time) {
    if (!groupVisible) return { phrase: "", cheer: false };
    let phrase = "";
    let cheer = false;
    const inside = x > BOARD.x0 && x < BOARD.x1 && z > BOARD.z0 && z < BOARD.z1;
    if (inside && !cheering) {
      cheering = true;
      cheer = true;
      crew.forEach((bot) => {
        if (!bot.group.visible) return;
        const inRoom = bot.x > BOARD.x0 && bot.x < BOARD.x1 && bot.z > BOARD.z0 && bot.z < BOARD.z1;
        if (!inRoom) return;
        bot.wave = 1.8;
        bot.greetYaw = Math.atan2(x - bot.x, z - bot.z);
        bot.phrase = "";
        bot.emote = "cheer";
      });
      lastPhrase = "Woo!";
    }
    if (!inside) cheering = false;
    crew.forEach((bot, i) => {
      if (!bot.group.visible) return;
      const dist = Math.hypot(bot.x - x, bot.z - z);
      if (dist < 2.5 && time > bot.greetCool) {
        bot.greetCool = time + 9;
        bot.wave = 1.5;
        bot.greetYaw = Math.atan2(x - bot.x, z - bot.z);
        bot.phrase = PHRASES[i % PHRASES.length];
        bot.emote = "";
        phrase = bot.phrase;
        lastPhrase = phrase;
      }
    });
    return { phrase: phrase, cheer: cheer };
  }

  function get(id) {
    for (let i = 0; i < crew.length; i += 1) {
      if (crew[i].id === id) return crew[i];
    }
    return null;
  }

  function snapshot() {
    return crew.map((bot) => ({
      id: bot.id,
      x: bot.x,
      z: bot.z,
      renderX: bot.group.position.x,
      renderZ: bot.group.position.z,
      mode: bot.mode,
      carrying: bot.carrying,
      nodeId: bot.nodeId,
    }));
  }

  // Pose once so the first painted frame is not a T-pose.
  update(0.016, 0.016);
  setActiveFloor(42, null);

  return {
    bots: crew,
    update: update,
    get: get,
    snapshot: snapshot,
    setVisible: setVisible,
    setActiveFloor: setActiveFloor,
    playTask: playTask,
    greet: greet,
    lastPhrase: function () { return lastPhrase; },
  };
}
