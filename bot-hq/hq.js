import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { buildOffice } from "./office.js";
import { createCrew } from "./actors.js";
import { applyBrandToPage } from "./brand.js";

/*
  Scene, camera, and clicks.

  hq.js  — this file. Renderer, orbit controls, picking, labels.
  office.js — the rooms, furniture, and the hallway graph.
  actors.js — the bots, their walk cycle, and their to-do lists.
  roster.js — loads status.json and the side panel. Works even if WebGL does not.

  Performance notes for a phone (an iPhone 13 reports devicePixelRatio 3):
  - The pixel ratio is capped at 2 so we don't shade a 3x framebuffer.
  - Furniture is merged in office.js. Bot limbs are instanced in actors.js.
  - No shadow maps. Blobs under the bots are the cheap soft shadows.
  - The draw loop pauses while the tab is hidden.
*/

const MAX_PIXEL_RATIO = 2;

const HOME = {
  wide: { fov: 32, pos: [12.4, 16.2, 18.6], target: [-0.4, 0.4, 2.2] },
  narrow: { fov: 48, pos: [8.2, 19.5, 20.4], target: [0, 0.2, 2.6] },
};

const STATUS_SPEED = {
  Working: 3.4,
  Idle: 1.15,
  "Waiting on Luke": 2.2,
  Done: 0.75,
};

function showFallback(text) {
  const fallback = document.getElementById("fallback");
  const fallbackText = document.getElementById("fallback-text");
  const hint = document.getElementById("hint");
  const loading = document.getElementById("loading");
  if (fallbackText && fallback && fallback.hidden) fallbackText.textContent = text;
  if (fallback) fallback.hidden = false;
  if (hint) hint.hidden = true;
  if (loading) loading.hidden = true;
  window.__HQ_SETTLED__ = true;
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
      resolve(window.BotHQ || { ready: true, error: "The roster did not load.", bots: [] });
    };
    if (window.BotHQ && window.BotHQ.ready) {
      finish();
      return;
    }
    document.addEventListener("bothq:ready", finish, { once: true });
    window.setTimeout(finish, 12000);
  });
}

function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function startScene(botInfos) {
  applyBrandToPage();
  const viewport = document.getElementById("viewport");
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const debug = new URLSearchParams(window.location.search).has("debug");

  const renderer = new THREE.WebGLRenderer({
    antialias: !coarse,
    alpha: false,
    stencil: false,
    powerPreference: coarse ? "default" : "high-performance",
    failIfMajorPerformanceCaveat: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(0xa9cbe4, 1);
  viewport.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9cbe4);
  scene.fog = new THREE.Fog(0xa9cbe4, 42, 110);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.08, 180);
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = "labels";
  viewport.appendChild(labelRenderer.domElement);

  // One finger / left mouse orbits. Two fingers pinch-zoom and pan.
  // Right mouse (or two fingers) pans. Wheel zooms on desktop.
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.screenSpacePanning = false;
  controls.rotateSpeed = coarse ? 0.7 : 0.85;
  controls.zoomSpeed = 0.85;
  controls.panSpeed = 0.7;
  controls.minDistance = 3.2;
  controls.maxDistance = 48;
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.08;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };

  const hemi = new THREE.HemisphereLight(0xfff6ea, 0xb89a78, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff8f0, 1.35);
  sun.position.set(9, 16, 11);
  scene.add(sun);
  const warm = new THREE.PointLight(0xffb26b, 7, 22, 2);
  warm.position.set(-1.2, 2.4, 1.4);
  const cool = new THREE.PointLight(0xc5e6ff, 4, 16, 2);
  cool.position.set(6.2, 2.3, -5);
  scene.add(warm, cool);

  const office = buildOffice(scene, botInfos, { debug: debug });
  office.screens.forEach((screen) => {
    const bot = botInfos.find((item) => item.id === screen.id);
    screen.speed = bot ? STATUS_SPEED[bot.status] || 1.6 : 1.6;
  });
  const crew = createCrew(scene, office, botInfos, { reduceMotion: reduce });

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.54, 28),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.visible = false;
  ring.raycast = function () {};
  scene.add(ring);

  const narrowQuery = window.matchMedia("(max-width: 760px)");
  function narrow() {
    return narrowQuery.matches || viewport.clientWidth < 760;
  }
  function homeView() {
    return narrow() ? HOME.narrow : HOME.wide;
  }

  let quality = "high";
  let framed = false;
  function frameHome() {
    const home = homeView();
    camera.fov = home.fov;
    camera.position.set(home.pos[0], home.pos[1], home.pos[2]);
    controls.target.set(home.target[0], home.target[1], home.target[2]);
    camera.updateProjectionMatrix();
    framed = true;
  }

  let followId = null;
  let pullDist = 0;
  let tween = null;
  const focus = new THREE.Vector3();

  const followButtons = [
    document.getElementById("btn-follow"),
    document.getElementById("panel-follow"),
  ];
  const labelButton = document.getElementById("btn-labels");
  let labelsOn = true;

  function syncFollowButtons() {
    const selected = window.BotHQ && window.BotHQ.selectedId;
    followButtons.forEach((button) => {
      if (!button) return;
      if (!selected) {
        button.hidden = true;
        return;
      }
      button.hidden = false;
      const following = followId === selected;
      button.textContent = following ? "Stop following" : "Follow";
      button.setAttribute("aria-pressed", following ? "true" : "false");
    });
  }

  function stopFollow() {
    followId = null;
    pullDist = 0;
    syncFollowButtons();
  }

  function startFollow(id) {
    followId = id;
    tween = null;
    const dist = camera.position.distanceTo(controls.target);
    pullDist = dist > 11 ? 8.2 : 0;
    syncFollowButtons();
  }

  function resetView() {
    stopFollow();
    const home = homeView();
    if (reduce) {
      frameHome();
      controls.update();
      return;
    }
    tween = {
      t: 0,
      fromPos: camera.position.clone(),
      toPos: new THREE.Vector3(home.pos[0], home.pos[1], home.pos[2]),
      fromTgt: controls.target.clone(),
      toTgt: new THREE.Vector3(home.target[0], home.target[1], home.target[2]),
      fromFov: camera.fov,
      toFov: home.fov,
    };
  }

  document.getElementById("btn-reset").addEventListener("click", resetView);
  const timeButton = document.getElementById("btn-time");
  let night = false;
  function applyTimeOfDay() {
    if (night) {
      scene.background.set(0x070b16);
      scene.fog.color.set(0x070b16);
      renderer.setClearColor(0x070b16, 1);
      hemi.intensity = 0.28;
      sun.intensity = 0.22;
      warm.intensity = 11;
      cool.intensity = 7;
      renderer.toneMappingExposure = 0.92;
    } else {
      scene.background.set(0xa9cbe4);
      scene.fog.color.set(0xa9cbe4);
      renderer.setClearColor(0xa9cbe4, 1);
      hemi.intensity = 0.95;
      sun.intensity = 1.35;
      warm.intensity = 7;
      cool.intensity = 4;
      renderer.toneMappingExposure = 1.05;
    }
    office.setNight(night);
    if (timeButton) {
      timeButton.textContent = night ? "Day" : "Night";
      timeButton.setAttribute("aria-pressed", night ? "true" : "false");
    }
  }
  if (timeButton) {
    timeButton.addEventListener("click", () => {
      night = !night;
      applyTimeOfDay();
    });
  }
  followButtons.forEach((button) => {
    if (!button) return;
    button.addEventListener("click", () => {
      const selected = window.BotHQ && window.BotHQ.selectedId;
      if (!selected) return;
      if (followId === selected) stopFollow();
      else startFollow(selected);
    });
  });
  if (labelButton) {
    labelButton.addEventListener("click", () => {
      labelsOn = !labelsOn;
      labelButton.setAttribute("aria-pressed", labelsOn ? "true" : "false");
    });
  }

  const rosterButton = document.getElementById("btn-roster");
  const rosterClose = document.getElementById("roster-close");
  function rosterOpen() {
    return document.body.classList.contains("is-roster-open");
  }
  function syncRosterButton() {
    if (!rosterButton) return;
    rosterButton.setAttribute("aria-expanded", rosterOpen() ? "true" : "false");
  }
  function setRoster(open) {
    document.body.classList.toggle("is-roster-open", open);
    syncRosterButton();
  }
  if (window.matchMedia("(min-width: 960px)").matches) setRoster(true);
  else syncRosterButton();
  if (rosterButton) {
    rosterButton.addEventListener("click", () => setRoster(!rosterOpen()));
  }
  if (rosterClose) rosterClose.addEventListener("click", () => setRoster(false));

  document.addEventListener("bothq:select", (event) => {
    const id = event.detail && event.detail.id;
    if (id) startFollow(id);
    if (narrow()) setRoster(false);
  });
  document.addEventListener("bothq:close", () => stopFollow());

  const raycaster = new THREE.Raycaster();
  raycaster.layers.set(1);
  const pointerNdc = new THREE.Vector2();
  let down = null;

  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (intro) endIntro();
    down = { x: event.clientX, y: event.clientY, id: event.pointerId, type: event.pointerType };
  });
  window.addEventListener("pointerup", (event) => {
    if (!down || event.pointerId !== down.id) return;
    const dx = event.clientX - down.x;
    const dy = event.clientY - down.y;
    const slop = down.type === "touch" ? 22 : 6;
    const at = down;
    down = null;
    if (dx * dx + dy * dy > slop * slop) return;
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    pointerNdc.set(
      ((at.x - rect.left) / rect.width) * 2 - 1,
      -((at.y - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(crew.bots.map((bot) => bot.group), true);
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
  renderer.domElement.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointerNdc, camera);
    const hit = raycaster.intersectObjects(crew.bots.map((bot) => bot.group), true);
    renderer.domElement.style.cursor = hit.length ? "pointer" : "grab";
  });
  renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());
  renderer.domElement.addEventListener(
    "touchmove",
    (event) => {
      if (event.cancelable) event.preventDefault();
    },
    { passive: false }
  );

  const hint = document.getElementById("hint");
  function hideHint() {
    if (hint) hint.classList.add("is-gone");
  }
  controls.addEventListener("start", () => {
    tween = null;
    hideHint();
  });
  window.setTimeout(hideHint, 7000);

  function resize() {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (width < 2 || height < 2) return;
    if (!framed) frameHome();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const cap = quality === "low" ? 1 : MAX_PIXEL_RATIO;
    const ratio = Math.min(window.devicePixelRatio || 1, cap);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    labelRenderer.setSize(width, height);
  }
  const observer = new ResizeObserver(() => resize());
  observer.observe(viewport);
  resize();

  // A short move from outside the tower into the floor. Tap skips it.
  // Slow devices that have already dropped quality never play it.
  let intro = null;
  const introSkip = document.getElementById("intro-skip");
  if (!reduce && !debug) {
    const home = homeView();
    intro = {
      t: 0,
      fromPos: new THREE.Vector3(2, 5.5, 22),
      toPos: new THREE.Vector3(home.pos[0], home.pos[1], home.pos[2]),
      fromTgt: new THREE.Vector3(0, 1.6, 4),
      toTgt: new THREE.Vector3(home.target[0], home.target[1], home.target[2]),
    };
    camera.position.copy(intro.fromPos);
    controls.target.copy(intro.fromTgt);
    if (introSkip) introSkip.hidden = false;
  }
  function endIntro() {
    if (!intro) return;
    intro = null;
    frameHome();
    if (introSkip) introSkip.hidden = true;
  }

  function clampTarget() {
    const target = controls.target;
    const x = THREE.MathUtils.clamp(target.x, -8.5, 8.5);
    const y = THREE.MathUtils.clamp(target.y, 0.25, 2.4);
    const z = THREE.MathUtils.clamp(target.z, -6.8, 12);
    if (x !== target.x || y !== target.y || z !== target.z) {
      const dx = x - target.x;
      const dy = y - target.y;
      const dz = z - target.z;
      target.set(x, y, z);
      camera.position.x += dx;
      camera.position.y += dy;
      camera.position.z += dz;
    }
    if (camera.position.y < 0.45) camera.position.y = 0.45;
  }

  const project = new THREE.Vector3();
  function updateLabels(t) {
    const selected = window.BotHQ ? window.BotHQ.selectedId : null;
    const small = narrow();
    for (let i = 0; i < crew.bots.length; i += 1) {
      const bot = crew.bots[i];
      const el = bot.labelEl;
      const dist = camera.position.distanceTo(bot.group.position);
      project.copy(bot.group.position);
      project.y += 1.5;
      project.project(camera);
      const behind = project.z > 1;
      // On a phone, or whenever someone is selected, only that bot's name is shown
      // so the labels don't pile up. Otherwise names appear when you move in close.
      let show = labelsOn && !behind;
      if (show && (small || selected)) show = bot.id === selected;
      else if (show && dist > 12) show = false;
      el.classList.toggle("is-hidden", !show);
      el.classList.toggle("is-selected", bot.id === selected);
      if (show) {
        const scale = Math.max(0.62, Math.min(1, 10 / Math.max(dist, 0.01)));
        el.style.transform = "scale(" + scale.toFixed(3) + ")";
      }
    }
    void t;
  }

  let debugEl = null;
  if (debug) {
    debugEl = document.createElement("div");
    debugEl.id = "debug-readout";
    document.body.appendChild(debugEl);
  }

  renderer.domElement.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault();
      showFallback("The 3D view stopped. The roster still lists every bot.");
      renderer.setAnimationLoop(null);
    },
    { once: true }
  );

  let slowTime = 0;
  let smoothTime = 0;
  const clock = new THREE.Clock();
  const followDelta = new THREE.Vector3();
  let announced = false;
  let frames = 0;
  let fpsAccum = 0;

  function tick() {
    const raw = clock.getDelta();
    // Cap the simulation step so a tab hitch cannot fling a bot across the room.
    // The camera reset uses the real elapsed time so it still finishes.
    const dt = Math.min(raw, 0.05);
    const t = clock.elapsedTime;
    // Drop pixel ratio if the frame time stays over ~40ms. The first second is ignored
    // so a slow startup does not immediately switch the whole office to low quality.
    if (t > 1.2 && raw < 0.5) {
      if (raw > 0.04) {
        slowTime += raw;
        smoothTime = 0;
      } else {
        smoothTime += raw;
        slowTime = Math.max(0, slowTime - raw);
      }
      if (quality === "high" && slowTime > 1.6) {
        quality = "low";
        office.setQuality("low");
        if (intro) endIntro();
        resize();
      } else if (quality === "low" && smoothTime > 2.5) {
        quality = "high";
        office.setQuality("high");
        slowTime = 0;
        resize();
      }
    }
    office.update(t);
    crew.update(dt, t);

    if (intro) {
      intro.t += Math.min(raw, 0.05);
      const k = smoothstep(Math.min(1, intro.t / 2.4));
      camera.position.lerpVectors(intro.fromPos, intro.toPos, k);
      controls.target.lerpVectors(intro.fromTgt, intro.toTgt, k);
      if (intro.t >= 2.4) endIntro();
    } else if (tween) {
      tween.t += raw / 0.7;
      const k = smoothstep(Math.min(1, tween.t));
      camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
      controls.target.lerpVectors(tween.fromTgt, tween.toTgt, k);
      camera.fov = tween.fromFov + (tween.toFov - tween.fromFov) * k;
      camera.updateProjectionMatrix();
      if (tween.t >= 1) {
        camera.position.copy(tween.toPos);
        controls.target.copy(tween.toTgt);
        camera.fov = tween.toFov;
        camera.updateProjectionMatrix();
        // Burn off leftover orbit momentum without letting it move the camera.
        for (let i = 0; i < 80; i += 1) {
          controls.update();
          camera.position.copy(tween.toPos);
          controls.target.copy(tween.toTgt);
        }
        tween = null;
      }
    } else if (followId) {
      const bot = crew.get(followId);
      if (!bot) {
        stopFollow();
      } else {
        focus.set(bot.group.position.x, 1.05, bot.group.position.z);
        followDelta.subVectors(focus, controls.target);
        controls.target.add(followDelta);
        camera.position.add(followDelta);
        if (pullDist) {
          const offset = camera.position.clone().sub(controls.target);
          const dist = offset.length();
          const next = THREE.MathUtils.damp(dist, pullDist, 2.6, dt);
          if (Math.abs(next - pullDist) < 0.08) pullDist = 0;
          offset.setLength(Math.max(next, 0.2));
          camera.position.copy(controls.target).add(offset);
        }
      }
    }

    if (!tween && !intro) controls.update();
    clampTarget();

    const selected = window.BotHQ ? window.BotHQ.selectedId : null;
    const selectedBot = selected ? crew.get(selected) : null;
    if (selectedBot) {
      ring.visible = true;
      ring.position.x = selectedBot.group.position.x;
      ring.position.z = selectedBot.group.position.z;
      ring.material.color.set(selectedBot.accent);
      ring.material.opacity = 0.55 + 0.3 * (0.5 + 0.5 * Math.sin(t * 3));
    } else {
      ring.visible = false;
    }

    updateLabels(t);
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);

    if (debugEl) {
      frames += 1;
      fpsAccum += dt;
      if (fpsAccum > 0.4) {
        const fps = frames / fpsAccum;
        debugEl.textContent =
          fps.toFixed(0) +
          " fps · " +
          renderer.info.render.calls +
          " draws · " +
          renderer.info.render.triangles +
          " tris · paths " +
          (office.pathsOk ? "ok" : "BROKEN") +
          " · " +
          quality;
        frames = 0;
        fpsAccum = 0;
      }
    }

    if (!announced) {
      announced = true;
      hideLoading();
      window.__HQ_READY__ = true;
      window.__HQ_SETTLED__ = true;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) renderer.setAnimationLoop(null);
    else renderer.setAnimationLoop(tick);
  });

  window.__HQ = {
    ready: true,
    pathsOk: office.pathsOk,
    pathErrors: office.pathErrors,
    stats: function () {
      return {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        pathsOk: office.pathsOk,
        pathErrors: office.pathErrors,
        quality: quality,
      };
    },
    bots: function () {
      return crew.snapshot();
    },
    blocked: function (x, z) {
      return office.pointBlocked(x, z);
    },
    screenPos: function (id) {
      const bot = crew.get(id);
      if (!bot) return null;
      project.copy(bot.group.position);
      project.y += 1.05;
      project.project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: rect.left + (project.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-project.y * 0.5 + 0.5) * rect.height,
        behind: project.z > 1,
      };
    },
    isFollowing: function () {
      return followId;
    },
    isIntro: function () {
      return !!intro;
    },
    camera: function () {
      return {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        tx: controls.target.x,
        ty: controls.target.y,
        tz: controls.target.z,
      };
    },
  };

  renderer.setAnimationLoop(tick);
}

async function boot() {
  const api = await waitForRoster();
  if (!api || api.error || !api.bots || !api.bots.length) {
    showFallback(api && api.error ? api.error : "Could not load status.json.");
    return;
  }
  if (!hasWebGL()) {
    showFallback("This browser can't draw the 3D office. The roster still lists every bot.");
    return;
  }
  try {
    startScene(api.bots);
  } catch (err) {
    console.error(err);
    showFallback("The 3D office couldn't start. The roster still lists every bot.");
  }
}

window.setTimeout(() => {
  if (!window.__HQ_SETTLED__) {
    showFallback("The 3D office is taking too long. Check your connection and refresh. The roster still lists every bot.");
  }
}, 18000);

boot();
