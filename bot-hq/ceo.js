import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

/*
  Luke's avatar. A navy blazer and a gold star, labeled "Luke (CEO)".
  Movement is fed in from the keyboard, the joystick, or a tap on the floor.
*/

export function createCeo(scene) {
  const group = new THREE.Group();
  group.name = "luke-ceo";
  const suit = new THREE.MeshLambertMaterial({ color: 0x1d3557, flatShading: true });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xf4efe6, flatShading: true });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe7c2a2, flatShading: true });
  const gold = new THREE.MeshBasicMaterial({ color: 0xffb15a });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 0.24), suit);
  torso.position.y = 0.86;
  const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.02), shirt);
  lapel.position.set(0, 0.9, 0.12);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.28), skin);
  head.position.y = 1.28;
  const star = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.02), gold);
  star.position.set(0.12, 1.05, 0.13);
  star.rotation.z = Math.PI / 4;
  const eyes = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.045),
    new THREE.MeshBasicMaterial({ color: 0xf4fbff })
  );
  eyes.position.set(0, 1.31, 0.15);
  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.02, 0.01),
    new THREE.MeshBasicMaterial({ color: 0x1c1612 })
  );
  mouth.position.set(0, 1.18, 0.15);
  group.add(torso, lapel, head, star, eyes, mouth);

  const label = document.createElement("div");
  label.className = "bot-label";
  label.textContent = "Luke (CEO)";
  const tag = new CSS2DObject(label);
  tag.position.set(0, 1.7, 0);
  group.add(tag);
  group.visible = false;
  scene.add(group);

  const state = {
    x: -1.2,
    z: 10.4,
    yaw: Math.PI,
    dest: null,
  };

  function blockedAt(blocked, x, z) {
    if (!blocked) return false;
    return !!blocked(x, z);
  }

  function tryStep(blocked, nx, nz) {
    if (!blockedAt(blocked, nx, nz)) {
      state.x = nx;
      state.z = nz;
      return;
    }
    if (!blockedAt(blocked, nx, state.z)) state.x = nx;
    else if (!blockedAt(blocked, state.x, nz)) state.z = nz;
  }

  function update(dt, input, blocked) {
    let mx = input.x;
    let mz = input.z;
    if (state.dest) {
      const dx = state.dest.x - state.x;
      const dz = state.dest.z - state.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.2) state.dest = null;
      else {
        mx += dx / dist;
        mz += dz / dist;
      }
    }
    const len = Math.hypot(mx, mz);
    if (len > 0.05) {
      const nx = mx / len;
      const nz = mz / len;
      state.yaw = Math.atan2(nx, nz);
      const step = Math.min(2.4 * dt, len);
      tryStep(blocked, state.x + nx * step, state.z + nz * step);
    }
    const now = performance.now() * 0.001;
    const bob = len > 0.05 ? Math.abs(Math.sin(now * 8)) * 0.04 : 0;
    eyes.scale.y = Math.sin(now * 0.9) > 0.97 ? 0.15 : 1;
    group.position.set(state.x, bob, state.z);
    group.rotation.y = state.yaw;
    group.visible = true;
  }

  function hide() {
    group.visible = false;
    state.dest = null;
  }

  function place(x, z) {
    state.x = x;
    state.z = z;
    state.dest = null;
    group.position.set(x, 0, z);
  }

  function goTo(x, z) {
    state.dest = { x: x, z: z };
  }

  return { group: group, state: state, update: update, hide: hide, place: place, goTo: goTo };
}
