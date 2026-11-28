import * as THREE from "three";

const coarse = matchMedia("(pointer: coarse)").matches;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
document.getElementById("controls-note").textContent = coarse
  ? "Joystick steers. Lamp toggles the headlight. Dive by pushing up."
  : "WASD or arrows steer. F toggles the headlight. W dives deeper.";

const renderer = new THREE.WebGLRenderer({ antialias: !coarse });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
document.getElementById("view").appendChild(renderer.domElement);
const scene = new THREE.Scene();
const fogColor = new THREE.Color(0x0b4c6e);
scene.background = fogColor;
scene.fog = new THREE.FogExp2(0x0b4c6e, 0.035);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 180);
scene.add(new THREE.HemisphereLight(0x9fd8ef, 0x042033, 0.7));
const head = new THREE.SpotLight(0xe8fbff, 0, 18, 0.5, 0.4, 1);
scene.add(head);
scene.add(head.target);
const cone = new THREE.Mesh(
  new THREE.ConeGeometry(0.45, 1.4, 8),
  new THREE.MeshBasicMaterial({ color: 0xd8fbff, transparent: true, opacity: 0.18 })
);
cone.rotation.x = Math.PI / 2;

const sub = new THREE.Group();
const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.1, 4, 8), new THREE.MeshLambertMaterial({ color: 0xf2c14e }));
hull.rotation.z = Math.PI / 2;
const sail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.3), new THREE.MeshLambertMaterial({ color: 0xd7a43a }));
sail.position.y = 0.4;
sub.add(hull, sail, cone);
sub.position.set(0, 2, 0);
scene.add(sub);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 160), new THREE.MeshLambertMaterial({ color: 0x0c3044 }));
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, -40, -20);
scene.add(floor);
for (let i = 0; i < 8; i += 1) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(3, 6 + (i % 3), 3), new THREE.MeshLambertMaterial({ color: 0x14506a }));
  wall.position.set((i % 2 ? -1 : 1) * (6 + i), -6 - i * 3.5, -8 - i * 6);
  scene.add(wall);
}

const fishCount = coarse ? 24 : 40;
const fish = new THREE.InstancedMesh(
  new THREE.ConeGeometry(0.12, 0.45, 5),
  new THREE.MeshLambertMaterial({ color: 0x7ee0ff }),
  fishCount
);
const fishData = [];
for (let i = 0; i < fishCount; i += 1) {
  fishData.push({
    x: (Math.random() - 0.5) * 24,
    y: -Math.random() * 30,
    z: -Math.random() * 40,
    s: 0.4 + Math.random(),
  });
}
scene.add(fish);

const treasures = [];
const treasureMat = new THREE.MeshBasicMaterial({ color: 0xffd56a });
for (let i = 0; i < 5; i += 1) {
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), treasureMat);
  mesh.position.set((i - 2) * 3.5, -4 - i * 6, -6 - i * 7);
  scene.add(mesh);
  treasures.push({ mesh: mesh, found: false });
}

let playing = false;
let found = 0;
let lamp = true;
const keys = {};
const joy = { x: 0, y: 0 };
let quality = "high";
let slow = 0;
let audioCtx = null;
let muted = true;
function unlock() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!audioCtx) {
    audioCtx = new AC();
    const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.15;
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 280;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.4;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    src.start();
    audioCtx.seaGain = gain;
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  audioCtx.seaGain.gain.value = muted ? 0 : 0.4;
}

addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "KeyF") lamp = !lamp;
});
addEventListener("keyup", (e) => { keys[e.code] = false; });
const stick = document.getElementById("stick");
const knob = document.getElementById("knob");
function joyAt(e) {
  const r = stick.getBoundingClientRect();
  let x = (e.clientX - (r.left + r.width / 2)) / 40;
  let y = -((e.clientY - (r.top + r.height / 2)) / 40);
  const len = Math.hypot(x, y) || 1;
  if (len > 1) { x /= len; y /= len; }
  joy.x = x;
  joy.y = y;
  knob.style.transform = "translate(" + x * 24 + "px," + (-y * 24) + "px)";
}
stick.addEventListener("pointerdown", (e) => { stick.setPointerCapture(e.pointerId); joyAt(e); });
stick.addEventListener("pointermove", (e) => { if (stick.hasPointerCapture(e.pointerId)) joyAt(e); });
function joyUp() { joy.x = 0; joy.y = 0; knob.style.transform = ""; }
stick.addEventListener("pointerup", joyUp);
if (coarse) { stick.hidden = false; document.getElementById("lamp").hidden = false; }
document.getElementById("lamp").addEventListener("click", () => { lamp = !lamp; });
document.getElementById("play").addEventListener("click", () => {
  unlock();
  document.getElementById("title").hidden = true;
  reset();
  playing = true;
});
document.getElementById("replay").addEventListener("click", () => {
  unlock();
  reset();
  playing = true;
});
document.getElementById("mute").addEventListener("click", () => {
  unlock();
  muted = !muted;
  const button = document.getElementById("mute");
  button.textContent = muted ? "Sound off" : "Sound on";
  button.setAttribute("aria-pressed", muted ? "true" : "false");
  if (audioCtx && audioCtx.seaGain) audioCtx.seaGain.gain.value = muted ? 0 : 0.4;
});
function reset() {
  sub.position.set(0, 2, 0);
  found = 0;
  treasures.forEach((item) => { item.found = false; item.mesh.visible = true; });
  document.getElementById("end").hidden = true;
  document.getElementById("found").textContent = "Found 0 / 5";
}
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
const dummy = new THREE.Object3D();
const deep = new THREE.Color(0x021018);
const shallow = new THREE.Color(0x0b4c6e);
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!reduce && playing && dt > 0.045) slow += dt;
  else slow = Math.max(0, slow - dt);
  if (quality === "high" && slow > 1.4) {
    quality = "low";
    renderer.setPixelRatio(1);
    head.intensity = 0;
  }
  if (playing) {
    let x = joy.x;
    let y = joy.y;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;
    if (keys.KeyW || keys.ArrowUp) y += 1;
    if (keys.KeyS || keys.ArrowDown) y -= 1;
    sub.position.x = Math.max(-16, Math.min(16, sub.position.x + x * 4 * dt));
    sub.position.y = Math.max(-36, Math.min(6, sub.position.y - y * 4 * dt));
    sub.position.z = Math.max(-48, Math.min(4, sub.position.z - Math.abs(y) * 2 * dt));
    const depth = Math.max(0, 2 - sub.position.y);
    document.getElementById("depth").textContent = "Depth " + Math.round(depth * 3) + " m";
    const k = Math.min(1, depth / 40);
    fogColor.copy(shallow).lerp(deep, k);
    scene.background.copy(fogColor);
    scene.fog.color.copy(fogColor);
    scene.fog.density = 0.03 + k * 0.04;
    const forward = new THREE.Vector3(0, -0.15, -1).applyQuaternion(sub.quaternion);
    head.position.copy(sub.position);
    head.target.position.copy(sub.position).add(forward.multiplyScalar(6));
    if (!head.target.parent) scene.add(head.target);
    head.intensity = lamp && quality === "high" ? 8 : 0;
    cone.material.opacity = lamp ? 0.22 : 0.02;
    treasures.forEach((item) => {
      if (item.found) return;
      item.mesh.rotation.y += dt;
      if (sub.position.distanceTo(item.mesh.position) < 1.4) {
        item.found = true;
        item.mesh.visible = false;
        found += 1;
        document.getElementById("found").textContent = "Found " + found + " / 5";
        if (found >= 5) {
          playing = false;
          document.getElementById("end-copy").textContent = "You reached " + document.getElementById("depth").textContent.toLowerCase() + " and brought every artifact home.";
          document.getElementById("end").hidden = false;
        }
      }
    });
  }
  fishData.forEach((f, i) => {
    f.x += Math.sin(clock.elapsedTime * f.s + i) * dt * 0.8;
    dummy.position.set(f.x, f.y, f.z);
    dummy.rotation.z = -Math.PI / 2;
    dummy.updateMatrix();
    fish.setMatrixAt(i, dummy.matrix);
  });
  fish.instanceMatrix.needsUpdate = true;
  camera.position.set(sub.position.x, sub.position.y + 2.2, sub.position.z + 6);
  camera.lookAt(sub.position);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
