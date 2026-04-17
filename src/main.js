import * as THREE from 'three';
import { createScene, triggerFlash, triggerDamageVignette } from './world/scene.js';
import { buildMap, LOBBY_SPAWN, SPAWNS, getTeamPadAt, setBarriersActive, raycastWorld, getBombSiteAt } from './world/map.js';
import {
  unlockAudio, playGunshot, playHitMarker, playReload, playBuy,
  playExplosion, playRoundWin, playRoundLose, playDeath, playAbility,
} from './world/audio.js';
import { FPSController } from './player/controller.js';
import { Viewmodel } from './player/viewmodel.js';
import { makeAvatar, placeNameplate } from './player/avatar.js';
import { WEAPONS, defaultInventory } from './combat/weapons.js';
import { fireTracer, spawnImpactDecal, updateBulletsVfx, raycastHit } from './combat/bullets.js';
import { throwGrenade, updateGrenades } from './combat/grenades.js';
import { spawnSmoke, updateSmokes, clearAllSmokes } from './combat/smoke.js';
import { spawnBarrierWall, updateBarrierWalls, clearAllBarrierWalls } from './combat/walls.js';
import { updateBombMesh } from './combat/bomb.js';
import { connectRoom } from './net/room.js';
import { HostRuntime } from './game/host.js';
import { ClientRuntime } from './game/client.js';
import { PHASE, BOMB } from './game/state.js';
import { LobbyUI } from './ui/lobby.js';
import { AgentSelectUI } from './ui/agentSelect.js';
import { BuyMenuUI } from './ui/buyMenu.js';
import { HUD } from './ui/hud.js';
import { Scoreboard } from './ui/scoreboard.js';
import { MapPlacerUI } from './ui/mapPlacer.js';
import { AGENTS, DEFAULT_AGENT, getAbility } from './agents/index.js';

// -------- bootstrap ----------------------------------------------------------
const portal = (window.Portal && window.Portal.readPortalParams) ? window.Portal.readPortalParams() : {
  username: `guest-${Math.floor(Math.random() * 9999)}`, color: Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'),
};
const myName  = portal.username;
const myColor = '#' + portal.color.replace('#', '');

const { renderer, scene, camera } = createScene();
buildMap(scene);

const controller = new FPSController(camera, renderer.domElement);
controller.teleport(LOBBY_SPAWN.x, LOBBY_SPAWN.z);
const viewmodel = new Viewmodel(camera);
scene.add(camera);

// -------- peer avatars & ammo state -----------------------------------------
const peerAvatars = new Map(); // id → avatarObj
const peerPoses = new Map();   // id → {x,y,z,yaw,pitch,alive}

// per-weapon ammo state (local, derived from loadout changes)
const ammoState = {}; // { pistol: {mag, reserve}, ... } keyed by weapon id
function getAmmo(weaponId) {
  const w = WEAPONS[weaponId];
  if (!w) return { mag: 0, reserve: 0 };
  if (!ammoState[weaponId]) ammoState[weaponId] = { mag: w.mag, reserve: w.reserve };
  return ammoState[weaponId];
}
function resetAmmoForInventory(inv) {
  // refill both equipped weapons on round start
  for (const id of [inv.primary, inv.secondary].filter(Boolean)) {
    const w = WEAPONS[id];
    ammoState[id] = { mag: w.mag, reserve: w.reserve };
  }
}

// -------- connect ------------------------------------------------------------
const hud = new HUD();
const scoreboard = new Scoreboard();
let net = null;
let host = null;       // HostRuntime | null
let client = null;     // ClientRuntime

(async function main() {
  hud.centerShow('connecting…', 99999);
  net = await connectRoom();
  hud.centerMsg.classList.add('hidden');
  client = new ClientRuntime({ selfId: net.selfId });

  net.onHostChange((iAm) => {
    if (iAm && !host) {
      host = new HostRuntime({
        selfId: net.selfId,
        broadcast: {
          // Host self-applies its own snapshots — Trystero doesn't echo to sender,
          // so without this the host's client.state would never update.
          state: (s) => { net.sendState(s); client.applySnapshot(s); },
          event: (e) => { net.sendEvent(e); handleEventLocal(e); },
        },
        getPeerPoses: () => peerPoses,
      });
      // seed host with all known players (including self)
      host.upsertPlayer(net.selfId, { name: myName, color: myColor });
      for (const id of net.peerIds()) {
        if (id === net.selfId) continue;
        const lastPres = lastPresByPeer.get(id);
        if (lastPres) host.upsertPlayer(id, lastPres);
      }
    } else if (!iAm && host) {
      host = null;
    }
  });

  net.onPeerJoin((id) => {
    if (host) host.upsertPlayer(id, { name: id.slice(0, 6) });
    ensureAvatar(id);
  });
  net.onPeerLeave((id) => {
    if (host) host.removePlayer(id);
    removeAvatar(id);
    peerPoses.delete(id);
  });

  net.onPres((d, fromId) => {
    lastPresByPeer.set(fromId, d);
    if (host) host.upsertPlayer(fromId, d);
    // color update
    const av = peerAvatars.get(fromId);
    if (av && d.color) {
      // (re-tint on next join — skip live swap for simplicity)
    }
  });

  net.onPose((d, fromId) => {
    const pose = {
      x: d.p[0], y: d.p[1], z: d.p[2],
      yaw: d.y, pitch: d.pi,
      alive: d.alive !== false,
    };
    peerPoses.set(fromId, pose);
  });

  net.onFire((d, fromId) => {
    // host validates; clients just play local fire SFX if shooter isn't me
    if (fromId !== net.selfId) {
      playGunshot(WEAPONS[d.w]?.sound || 'rifle');
      const o = new THREE.Vector3().fromArray(d.o);
      const dir = new THREE.Vector3().fromArray(d.d);
      // Clip the tracer at whichever is closer: a wall, the reported hit distance, or 80.
      const wallT = raycastWorld(o, dir, 80);
      const hitT = (typeof d.hitDist === 'number' && d.hitDist > 0) ? d.hitDist : 80;
      const tracerT = Math.min(wallT, hitT, 80);
      const end = new THREE.Vector3().copy(o).add(dir.clone().multiplyScalar(tracerT));
      fireTracer(scene, o, end, 0xff9466);
    }
    if (host) {
      host.handleFire(fromId, d);
    }
  });

  net.onNade((d, fromId) => {
    const o = new THREE.Vector3().fromArray(d.o);
    const dir = new THREE.Vector3().fromArray(d.d);
    // visually spawn for everyone; only host detonation applies damage
    throwGrenade(scene, d.type, o, dir, fromId);
  });

  net.onAbility((d, fromId) => {
    if (host) host.handleAbility(fromId, d);
  });

  net.onBuy((d, fromId) => {
    if (host) host.handleBuy(fromId, d.item);
  });

  net.onBomb((d, fromId) => {
    if (host) host.handleBomb(fromId, d);
  });

  net.onState((s) => {
    client.applySnapshot(s);
    // host ignores incoming state; others adopt it
  });

  net.onEvent((e, fromId) => {
    handleEventLocal(e);
  });

  // send initial presence
  sendPres();
  setInterval(sendPres, 500);

  // 20Hz pose broadcast
  setInterval(() => {
    const alive = clientAlive();
    net.sendPose({
      p: [controller.pos.x, controller.pos.y, controller.pos.z],
      y: controller.yaw,
      pi: controller.pitch,
      alive,
    });
    if (host) host.setSelfPose({ x: controller.pos.x, y: controller.pos.y, z: controller.pos.z });
  }, 50);

  // portal button
  wireUpPortal();

  // UI callbacks
  buyMenu = new BuyMenuUI({
    onBuy: (item) => { net.sendBuy({ item }); if (host) host.handleBuy(net.selfId, item); playBuy(); },
    getState: () => client.state,
  });
  lobby = new LobbyUI({
    onReady: toggleReady,
  });
  mapPlacer = new MapPlacerUI();
  agentSelect = new AgentSelectUI({
    onPick: (id) => {
      currentAgent = id;
      sendPres();
      if (host) host.setAgent(net.selfId, id);
    },
  });
})();

// -------- UI -----------------------------------------------------------------
let lobby = null, agentSelect = null, buyMenu = null, mapPlacer = null;
let currentAgent = DEFAULT_AGENT;
let currentTeam = null;       // 'A' | 'B' | null — derived from team-pad occupancy in lobby
let currentReady = false;
const lastPresByPeer = new Map();

function sendPres() {
  if (!net) return;
  net.sendPres({
    name: myName,
    color: myColor,
    agent: currentAgent,
    ready: currentReady,
    team: currentTeam,
  });
  // also update host record for self (host records pres from all peers, including itself)
  if (host) host.upsertPlayer(net.selfId, { name: myName, color: myColor, agent: currentAgent, ready: currentReady, team: currentTeam });
}

function toggleReady() {
  if (!client) return;
  if (client.state.phase !== PHASE.LOBBY) return;
  if (!currentTeam) return; // must be on a team pad first
  currentReady = !currentReady;
  sendPres();
}

function updateTeamFromPads() {
  // In lobby, detect which pad (if any) the player is standing on.
  if (!client || client.state.phase !== PHASE.LOBBY) return;
  const onPad = getTeamPadAt(controller.pos.x, controller.pos.z);
  if (onPad && onPad !== currentTeam) {
    currentTeam = onPad;
    sendPres();
  }
}

// -------- avatars ------------------------------------------------------------
function ensureAvatar(id) {
  if (peerAvatars.has(id)) return peerAvatars.get(id);
  const pres = lastPresByPeer.get(id) || {};
  const p = client?.state.players[id];
  const teamColor = p?.team ? (p.team === myTeam() ? '#4aa3ff' : '#ff4d6a') : (pres.color || '#aaaaaa');
  const av = makeAvatar({ teamColor, accentColor: pres.color || '#c64bff' });
  scene.add(av.group);
  peerAvatars.set(id, av);
  av.setName(pres.name || id.slice(0, 6), false);
  return av;
}
function removeAvatar(id) {
  const av = peerAvatars.get(id);
  if (!av) return;
  scene.remove(av.group);
  av.dispose();
  peerAvatars.delete(id);
}
function myTeam() {
  return client?.state.players[net?.selfId]?.team || null;
}
function clientAlive() {
  const me = client?.state.players[net?.selfId];
  return !me || me.alive !== false;
}

// -------- input: shooting + ability + grenade + reload ----------------------
let lastShotAt = 0;
let reloading = false;
let aiming = false;     // right-mouse held
let scoped = false;     // aiming + weapon supports scope
const BASE_FOV = 78;
const SCOPE_FOV = 22;

// Bomb plant/defuse hold state (local; completion sends an intent to host).
let bombHold = null; // { kind: 'plant'|'defuse', startT, pos: {x,z}, sent }

function setAim(on) {
  aiming = !!on;
}

function weaponHasScope(id) {
  return id === 'operator';
}

// -------- fullscreen + keyboard lock (block Ctrl+W etc. during matches) -----
function isMatchPhase(phase) {
  return phase === PHASE.BUY || phase === PHASE.ROUND_LIVE || phase === PHASE.ROUND_END;
}

async function enterGameMode() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch (err) { /* user denied or not allowed from this event — pointer lock still works */ }
  try {
    // Chromium's Keyboard Lock API: captures system shortcuts (Ctrl+W, Alt+Tab, etc.)
    // when in fullscreen. No-op on Firefox/Safari.
    if (navigator.keyboard?.lock) await navigator.keyboard.lock();
  } catch (err) { /* ignore */ }
}

function exitGameMode() {
  try { navigator.keyboard?.unlock?.(); } catch {}
  try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch {}
}

// Re-assert keyboard lock when user clicks canvas during a match phase.
// (Chrome requires a user gesture to enter fullscreen.)
document.getElementById('game').addEventListener('click', () => {
  if (client && isMatchPhase(client.state.phase)) enterGameMode();
});

document.addEventListener('mousedown', (e) => {
  unlockAudio();
  if (!controller.locked) return;
  if (e.button === 0) tryFire();
  if (e.button === 2) { e.preventDefault(); setAim(true); }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 2) setAim(false);
});
document.addEventListener('contextmenu', (e) => {
  if (controller.locked) e.preventDefault();
});
window.addEventListener('blur', () => setAim(false));
// Keys that trigger browser actions (close tab, reload, etc.) — swallow them
// while we're pointer-locked so the player doesn't lose their match.
const BROWSER_SHORTCUT_KEYS = new Set([
  'KeyW', 'KeyT', 'KeyN', 'KeyR', 'KeyQ', 'KeyP', 'KeyL', 'KeyD', 'KeyJ', 'KeyH', 'KeyF',
]);
const ALWAYS_SWALLOW = new Set(['F5', 'F11', 'Tab']);

document.addEventListener('keydown', (e) => {
  unlockAudio();
  // Fallback for browsers without Keyboard Lock: we can at least preventDefault
  // page-level handlers (doesn't stop Ctrl+W in Chrome without keyboard.lock,
  // but does stop Tab focus escape, F5 reload, etc.)
  if (controller.locked) {
    if ((e.ctrlKey || e.metaKey) && BROWSER_SHORTCUT_KEYS.has(e.code)) e.preventDefault();
    if (ALWAYS_SWALLOW.has(e.code) && !e.ctrlKey && !e.altKey) e.preventDefault();
  }

  if (e.code === 'KeyR') {
    if (client?.state.phase === PHASE.LOBBY) toggleReady();
    else tryReload();
  }
  if (e.code === 'KeyE') tryAbility();
  if (e.code === 'KeyG') tryGrenade();
  if (e.code === 'KeyF' && !e.repeat) tryBombHoldStart();
  if (e.code === 'Digit1') switchWeapon('primary');
  if (e.code === 'Digit2') switchWeapon('secondary');
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'KeyF') cancelBombHold();
});
window.addEventListener('blur', () => cancelBombHold());

function switchWeapon(slot) {
  const me = client?.state.players[net?.selfId];
  if (!me) return;
  const id = me.inventory?.[slot];
  if (!id) return;
  me.weaponCurrent = id;
  viewmodel.setWeapon(id);
}

function tryFire() {
  if (!net || !client) return;
  const me = client.state.players[net.selfId];
  if (!me || !me.alive || me.spectator) return;
  if (client.state.phase !== PHASE.ROUND_LIVE) return;

  const wId = me.weaponCurrent || 'classic';
  const w = WEAPONS[wId];
  if (!w) return;
  const now = performance.now();
  const cd = 60_000 / w.rpm;
  if (now - lastShotAt < cd) return;
  const ammo = getAmmo(wId);
  if (ammo.mag <= 0) { tryReload(); return; }
  if (reloading) return;

  lastShotAt = now;
  ammo.mag -= 1;

  // ray from camera
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const dir = controller.getForwardVec().clone();
  // small spread
  dir.x += (Math.random() - 0.5) * w.spread;
  dir.y += (Math.random() - 0.5) * w.spread;
  dir.z += (Math.random() - 0.5) * w.spread;
  dir.normalize();

  // local hit test vs peer hitboxes
  const hitboxes = [];
  for (const [id, av] of peerAvatars) {
    const p = client.state.players[id];
    if (!p || !p.alive || p.spectator) continue;
    if (p.team && p.team === me.team) continue;
    for (const hb of av.getHitboxes(av.group.position)) {
      hitboxes.push({ ...hb, ownerId: id });
    }
  }
  const result = raycastHit(origin, dir, hitboxes, 200);

  // tracer visual
  const end = new THREE.Vector3().copy(origin).add(dir.clone().multiplyScalar(result.t || result.wallT || 200));
  fireTracer(scene, origin, end, 0xfff0a0);
  viewmodel.flashMuzzle();
  viewmodel.fireKick(w.recoil);
  playGunshot(w.sound);

  // recoil bump
  controller.pitch = Math.max(-Math.PI / 2 + 0.05, controller.pitch + (Math.random() * 0.015 + 0.01) * w.recoil);
  controller.yaw += (Math.random() - 0.5) * 0.008 * w.recoil;

  let hitKind = null, hitOwnerId = null, hitDist = 0;
  if (result && result.t !== undefined && result.kind) {
    hitKind = result.kind;
    hitOwnerId = result.ownerId;
    hitDist = result.t;
    hud.pingHit(hitKind === 'head');
    playHitMarker(hitKind === 'head');
    spawnImpactDecal(scene, result.point, new THREE.Vector3(0, 1, 0), 0xff4a4a);
  } else {
    // wall hit decal if we have wallT
    const wallT = result?.wallT ?? null;
    if (wallT && wallT < 200) {
      const p = new THREE.Vector3().copy(origin).add(dir.clone().multiplyScalar(wallT - 0.02));
      spawnImpactDecal(scene, p, new THREE.Vector3(0, 0, 1), 0xc64bff);
    }
  }

  // tell host (may be self)
  const firePayload = {
    o: [origin.x, origin.y, origin.z],
    d: [dir.x, dir.y, dir.z],
    w: wId,
    hitOwnerId, hitKind, hitDist,
  };
  net.sendFire(firePayload);
  if (host) host.handleFire(net.selfId, firePayload);
}

function tryReload() {
  const me = client?.state.players[net?.selfId];
  if (!me) return;
  const wId = me.weaponCurrent;
  const w = WEAPONS[wId];
  if (!w) return;
  const ammo = getAmmo(wId);
  if (ammo.reserve <= 0 || ammo.mag >= w.mag) return;
  if (reloading) return;
  reloading = true;
  playReload();
  setTimeout(() => {
    const need = w.mag - ammo.mag;
    const take = Math.min(need, ammo.reserve);
    ammo.mag += take;
    ammo.reserve -= take;
    reloading = false;
  }, 1500);
}

function tryAbility() {
  const me = client?.state.players[net?.selfId];
  if (!me || !me.alive || me.spectator) return;
  if (client.state.phase !== PHASE.ROUND_LIVE) return;
  if (me.abilityCharges <= 0) return;
  const ability = getAbility(me.agent || DEFAULT_AGENT);
  if (!ability) return;

  if (ability.id === 'riposte') {
    net.sendAbility({ type: 'riposte' });
    if (host) host.handleAbility(net.selfId, { type: 'riposte' });
    controller.speedMul = ability.speedMul;
    setTimeout(() => { controller.speedMul = 1; }, ability.duration * 1000);
    triggerFlash('#ff3b7a', 220);
    playAbility();
  } else if (ability.id === 'skysmoke') {
    // Collect teammate positions for the tactical map
    const selfPos = { x: controller.pos.x, z: controller.pos.z };
    const myTeam = me.team;
    const teammates = [];
    for (const [id, pose] of peerPoses) {
      if (id === net.selfId) continue;
      const op = client.state.players[id];
      if (op?.team === myTeam) teammates.push({ x: pose.x, z: pose.z });
    }
    controller.releasePointer();
    mapPlacer.open({
      selfPos, teammates, charges: me.abilityCharges,
      onDeploy: (worldPos) => {
        const payload = { type: 'skysmoke', pos: [worldPos.x, 0, worldPos.z] };
        net.sendAbility(payload);
        if (host) host.handleAbility(net.selfId, payload);
        playAbility();
        controller.requestPointer();
      },
    });
  } else if (ability.id === 'barrierwall') {
    // Place a wall in front of the player, axis-aligned by dominant look direction.
    const fwd = controller.getMoveForward();
    const offset = ability.offset || 4;
    const cx = controller.pos.x + fwd.x * offset;
    const cz = controller.pos.z + fwd.z * offset;
    // Axis convention: 'x' means wall runs along X (blocks N/S), 'z' means along Z (blocks E/W).
    const axis = Math.abs(fwd.x) > Math.abs(fwd.z) ? 'z' : 'x';
    const payload = {
      type: 'barrierwall',
      pos: [cx, 0, cz],
      axis,
      width: ability.width,
      height: ability.height,
      duration: ability.duration,
    };
    net.sendAbility(payload);
    if (host) host.handleAbility(net.selfId, payload);
    playAbility();
    triggerFlash('#9cffb4', 180);
  }
}

function tryBombHoldStart() {
  if (!net || !client) return;
  const me = client.state.players[net.selfId];
  if (!me || !me.alive || me.spectator) return;
  if (client.state.phase !== PHASE.ROUND_LIVE) return;
  const b = client.state.bomb;
  if (!b) return;

  if (me.team === 'B' && b.carrierId === net.selfId && !b.planted) {
    // Plant: must be inside a site zone.
    const site = getBombSiteAt(controller.pos.x, controller.pos.z);
    if (!site) { hud.centerShow('MOVE TO SITE A OR B TO PLANT', 1400); return; }
    bombHold = { kind: 'plant', startT: performance.now(), pos: { x: controller.pos.x, z: controller.pos.z }, sent: false };
    return;
  }
  if (me.team === 'A' && b.planted && Array.isArray(b.pos)) {
    const dx = controller.pos.x - b.pos[0], dz = controller.pos.z - b.pos[1];
    if (dx*dx + dz*dz > BOMB.DEFUSE_RADIUS * BOMB.DEFUSE_RADIUS) {
      hud.centerShow('GET CLOSER TO THE SPIKE', 1400);
      return;
    }
    bombHold = { kind: 'defuse', startT: performance.now(), pos: { x: controller.pos.x, z: controller.pos.z }, sent: false };
  }
}

function cancelBombHold() {
  if (bombHold && !bombHold.sent) {
    const el = document.getElementById('bombProgress');
    if (el) el.classList.add('hidden');
  }
  bombHold = null;
}

function tickBombHold() {
  const el = document.getElementById('bombProgress');
  if (!bombHold) { if (el) el.classList.add('hidden'); return; }
  const me = client?.state.players[net?.selfId];
  if (!me || !me.alive || client?.state.phase !== PHASE.ROUND_LIVE) { cancelBombHold(); return; }

  // Cancel if the player strays too far from the start spot.
  const dx = controller.pos.x - bombHold.pos.x;
  const dz = controller.pos.z - bombHold.pos.z;
  if (dx*dx + dz*dz > 0.35 * 0.35) { cancelBombHold(); return; }

  const b = client.state.bomb;
  if (bombHold.kind === 'plant') {
    // Still carrier, still in a site, bomb still not planted.
    if (b?.planted || b?.carrierId !== net.selfId || !getBombSiteAt(controller.pos.x, controller.pos.z)) {
      cancelBombHold();
      return;
    }
  } else if (bombHold.kind === 'defuse') {
    if (!b?.planted || !Array.isArray(b.pos)) { cancelBombHold(); return; }
    const bx = controller.pos.x - b.pos[0], bz = controller.pos.z - b.pos[1];
    if (bx*bx + bz*bz > BOMB.DEFUSE_RADIUS * BOMB.DEFUSE_RADIUS) { cancelBombHold(); return; }
  }

  const dur = bombHold.kind === 'plant' ? BOMB.PLANT_TIME : BOMB.DEFUSE_TIME;
  const elapsed = (performance.now() - bombHold.startT) / 1000;
  const t = Math.min(1, elapsed / dur);

  if (el) {
    el.classList.remove('hidden');
    el.classList.toggle('defuse', bombHold.kind === 'defuse');
    document.getElementById('bombProgressLabel').textContent =
      bombHold.kind === 'plant' ? 'PLANTING SPIKE…' : 'DEFUSING SPIKE…';
    document.getElementById('bombProgressFill').style.width = `${(t * 100).toFixed(0)}%`;
  }

  if (t >= 1 && !bombHold.sent) {
    bombHold.sent = true;
    const payload = bombHold.kind === 'plant'
      ? { kind: 'plant', x: controller.pos.x, z: controller.pos.z }
      : { kind: 'defuse' };
    net.sendBomb(payload);
    if (host) host.handleBomb(net.selfId, payload);
    bombHold = null;
    if (el) el.classList.add('hidden');
  }
}

function updateBombHud() {
  if (!client || !net) return;
  const me = client.state.players[net.selfId];
  const s = client.state;
  const b = s.bomb;
  const live = (s.phase === PHASE.ROUND_LIVE);

  const carrierEl = document.getElementById('bombCarrierHud');
  const plantedEl = document.getElementById('bombPlantedHud');
  const defuseEl = document.getElementById('defusePromptHud');

  const showCarrier = !!(live && me && me.alive && !me.spectator
    && b?.carrierId === net.selfId && !b?.planted);
  carrierEl?.classList.toggle('hidden', !showCarrier);

  const showPlanted = !!(live && b?.planted);
  plantedEl?.classList.toggle('hidden', !showPlanted);
  if (showPlanted) {
    const siteEl = document.getElementById('bombSiteLabel');
    const timerEl = document.getElementById('bombPlantedTimer');
    if (siteEl) siteEl.textContent = b.site || '?';
    if (timerEl) timerEl.textContent = client.phaseRemaining();
  }

  // Defuse prompt: defender within range of planted spike, alive, not already
  // holding a plant/defuse action.
  let showDefuse = false;
  if (live && me?.alive && !me.spectator && me.team === 'A' && b?.planted && Array.isArray(b.pos) && !bombHold) {
    const dx = controller.pos.x - b.pos[0];
    const dz = controller.pos.z - b.pos[1];
    if (dx*dx + dz*dz <= BOMB.DEFUSE_RADIUS * BOMB.DEFUSE_RADIUS) showDefuse = true;
  }
  defuseEl?.classList.toggle('hidden', !showDefuse);
}

function tryGrenade() {
  const me = client?.state.players[net?.selfId];
  if (!me || !me.alive || me.spectator) return;
  if (client.state.phase !== PHASE.ROUND_LIVE) return;
  if ((me.inventory?.grenades?.frag || 0) <= 0) return;
  me.inventory.grenades.frag -= 1;

  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const dir = controller.getForwardVec();
  net.sendNade({ o: [origin.x, origin.y, origin.z], d: [dir.x, dir.y, dir.z], type: 'frag' });
  throwGrenade(scene, 'frag', origin, dir, net.selfId);
}

// -------- events (kills, damage, round transitions) -------------------------
function handleEventLocal(e) {
  if (!client) return;
  if (e.type === 'kill') {
    // enrich with names
    e.killerName = client.state.players[e.killer]?.name || e.killer;
    e.victimName = client.state.players[e.victim]?.name || e.victim;
    client.pushEvent(e);
    if (e.victim === net.selfId) {
      triggerFlash('#ff1030', 280);
      playDeath();
    }
  }
  if (e.type === 'damage') {
    if (e.to === net.selfId) triggerDamageVignette();
  }
  if (e.type === 'bombAssigned') {
    if (e.to === net.selfId) hud.centerShow('YOU HAVE THE SPIKE · plant it in site A or B', 3500);
  }
  if (e.type === 'bombPlanted') {
    hud.centerShow(`SPIKE PLANTED · SITE ${e.site}`, 3200);
    triggerFlash('#ff4a4a', 280);
    playAbility();
  }
  if (e.type === 'bombDefused') {
    hud.centerShow('SPIKE DEFUSED', 2400);
    triggerFlash('#4aa3ff', 240);
  }
  if (e.type === 'bombDetonated') {
    hud.centerShow('SPIKE DETONATED', 2400);
    triggerFlash('#ff1030', 380);
    playExplosion();
  }
  if (e.type === 'bombDropped' || e.type === 'bombPickup') {
    // Visuals update via snapshot; nothing extra needed here.
  }
  if (e.type === 'roundEnd') {
    const myT = myTeam();
    const won = (myT === e.winner);
    hud.centerShow(won ? `ROUND WON · ${e.scoreA} — ${e.scoreB}` : (e.winner ? `ROUND LOST · ${e.scoreA} — ${e.scoreB}` : `DRAW · ${e.scoreA} — ${e.scoreB}`), 3500);
    if (won) playRoundWin(); else if (e.winner) playRoundLose();
  }
  if (e.type === 'matchEnd') {
    const myT = myTeam();
    const myS = myT === 'A' ? e.scoreA : e.scoreB;
    const opS = myT === 'A' ? e.scoreB : e.scoreA;
    const el = document.getElementById('matchEnd');
    document.getElementById('matchEndTitle').textContent = myS > opS ? 'VICTORY' : 'DEFEAT';
    document.getElementById('matchEndTitle').style.color = myS > opS ? '#9cffb4' : '#ff6a8a';
    document.getElementById('matchEndScore').textContent = `${myS} — ${opS}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 8500);
    if (myS > opS) playRoundWin(); else playRoundLose();
  }
  if (e.type === 'ability') {
    if (e.kind === 'riposte' && e.from !== net.selfId) {
      const av = peerAvatars.get(e.from);
      if (av) {
        av.setAbilityGlow(true);
        setTimeout(() => av.setAbilityGlow(false), 2500);
      }
    }
    if (e.kind === 'skysmoke' && e.pos) {
      const worldPos = new THREE.Vector3(e.pos[0], e.pos[1] || 0, e.pos[2]);
      spawnSmoke(scene, worldPos, e.radius || 4.5, e.duration || 10);
    }
    if (e.kind === 'barrierwall' && e.pos) {
      spawnBarrierWall(scene, {
        cx: e.pos[0], cz: e.pos[2],
        axis: e.axis || 'x',
        width: e.width || 6,
        height: e.height || 2.6,
        duration: e.duration || 20,
      });
    }
  }
}

// -------- portal button ------------------------------------------------------
function wireUpPortal() {
  const btn = document.getElementById('portalBtn');
  if (!btn || !window.Portal) return;
  (async () => {
    const target = await window.Portal.pickPortalTarget();
    if (!target) { btn.textContent = 'no portal'; btn.disabled = true; return; }
    btn.textContent = `↗ ${target.title}`;
    btn.addEventListener('click', () => {
      window.Portal.sendPlayerThroughPortal(target.url, {
        username: myName, color: myColor.replace('#', ''), speed: 5,
      });
    });
  })();
}

// -------- main loop ----------------------------------------------------------
let lastT = performance.now();
let lastPhase = null;
function loop() {
  const now = performance.now();
  const dt = Math.min(0.08, (now - lastT) / 1000);
  lastT = now;

  // phase-aware input lock
  const phase = client?.state.phase || PHASE.LOBBY;
  controller.canLook = true;
  controller.canMove = phase !== PHASE.MATCH_END;

  // phase change side-effects
  if (phase !== lastPhase) {
    onPhaseEnter(phase, lastPhase);
    lastPhase = phase;
  }

  controller.update(dt);

  // In lobby, track which team pad we're standing on
  updateTeamFromPads();

  // Scope / ADS: only while holding RMB, weapon supports it, alive, live round.
  const meNow = client?.state.players[net?.selfId];
  const wantScope = aiming && controller.locked
    && meNow && meNow.alive && !meNow.spectator
    && weaponHasScope(meNow.weaponCurrent)
    && phase === PHASE.ROUND_LIVE;
  if (wantScope !== scoped) {
    scoped = wantScope;
    viewmodel.setScoped(scoped);
    const overlay = document.getElementById('scopeOverlay');
    if (overlay) overlay.classList.toggle('hidden', !scoped);
    const crosshair = document.getElementById('crosshair');
    if (crosshair) crosshair.classList.toggle('hidden', scoped);
    controller.mouseSens = scoped ? 0.0009 : 0.0022;
  }
  const targetFov = scoped ? SCOPE_FOV : BASE_FOV;
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 16);
    camera.updateProjectionMatrix();
  }

  const moving = controller.keys['KeyW'] || controller.keys['KeyA'] || controller.keys['KeyS'] || controller.keys['KeyD'];
  viewmodel.update(dt, !!moving, controller.crouching);

  // apply snapshots → avatars
  if (client) {
    for (const [id, p] of Object.entries(client.state.players)) {
      if (id === net.selfId) continue;
      let av = peerAvatars.get(id);
      if (!av) av = ensureAvatar(id);
      const pose = peerPoses.get(id);
      if (pose) {
        av.group.position.lerp(new THREE.Vector3(pose.x, 0, pose.z), Math.min(1, dt * 10));
        av.group.rotation.y = pose.yaw + Math.PI; // face their forward
        av.setDead(!p.spectator && !p.alive);
      }
      av.setSpectator(!!p.spectator);
      // Nameplates only visible in the lobby (tactical shooter — no wallhacks in-match).
      const me = client.state.players[net.selfId];
      const enemy = me && me.team && p.team && p.team !== me.team;
      av.setName(p.name, enemy);
      if (client.state.phase === PHASE.LOBBY) {
        placeNameplate(av, camera, renderer);
      } else {
        av.nameplate.style.display = 'none';
      }
    }
  }

  // host tick
  if (host) host.tick(Date.now());

  // bullets/grenades/smokes/walls
  updateBulletsVfx(dt, scene);
  updateGrenades(dt, scene, host ? (info) => host.handleGrenadeExplosion(info) : null);
  updateSmokes(dt);
  updateBarrierWalls(dt, scene);
  updateBombMesh(scene, client?.state.bomb, dt);
  tickBombHold();
  updateBombHud();

  // UI render
  if (client) {
    const s = client.state;
    const rem = client.phaseRemaining();
    const me = client.state.players[net.selfId];
    const isSpectator = !!me?.spectator;
    lobby?.render({ phase: s.phase, players: s.players, selfId: net.selfId, startCountdown: s.startCountdown || 0 });
    agentSelect?.render({ phase: s.phase, remainingSec: rem, me });
    buyMenu?.render({ phase: s.phase, remainingSec: rem, money: me?.money ?? 0, inventory: me?.inventory ?? defaultInventory(), spectator: isSpectator });
    const ammo = me ? getAmmo(me.weaponCurrent || 'classic') : null;
    hud.render({
      phase: s.phase, round: s.round, scoreA: s.scoreA, scoreB: s.scoreB,
      remainingSec: rem, me: isSpectator ? null : me, ammo, team: me?.team, events: client.recentEvents,
      bomb: s.bomb,
    });
    hud.update(dt);
    scoreboard.render({ players: s.players, me, scoreA: s.scoreA, scoreB: s.scoreB });
    // spectator overlay: visible when spectating any non-lobby phase
    const specEl = document.getElementById('spectatorHud');
    if (specEl) specEl.classList.toggle('hidden', !(isSpectator && s.phase !== PHASE.LOBBY));

    // Phase banner: show during agent-select & round-end (other phases have their own UI).
    const banner = document.getElementById('phaseBanner');
    if (banner) {
      const bannerPhases = {
        [PHASE.AGENT_SELECT]: 'AGENT SELECT',
        [PHASE.ROUND_END]:    'ROUND END',
        [PHASE.MATCH_END]:    'MATCH END',
      };
      const label = bannerPhases[s.phase];
      banner.classList.toggle('hidden', !label);
      if (label) {
        document.getElementById('phaseBannerLabel').textContent = label;
        document.getElementById('phaseBannerTimer').textContent = rem;
      }
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function onPhaseEnter(phase, prev) {
  if (!client) return;
  const me = client.state.players[net.selfId];

  if (phase === PHASE.BUY) {
    // respawn camera at team spawn, refill ammo, update viewmodel
    if (me?.team) {
      const sp = SPAWNS[me.team === 'A' ? 'teamA' : 'teamB'];
      const pick = sp[Math.floor(Math.random() * sp.length)];
      controller.teleport(pick.x, pick.z, me.team === 'A' ? 0 : Math.PI);
      if (me.inventory) resetAmmoForInventory(me.inventory);
      if (me.weaponCurrent) viewmodel.setWeapon(me.weaponCurrent);
    }
    controller.releasePointer(); // release so buy menu clicks register
    setBarriersActive(true);     // attackers can't leave spawn yet
    clearAllSmokes();
    clearAllBarrierWalls(scene);
    hud.centerShow(`BUY PHASE · Round ${client.state.round} · press B to close shop`, 3000);
  }
  if (phase === PHASE.ROUND_LIVE) {
    controller.requestPointer();
    setBarriersActive(false);    // barriers drop
    hud.centerShow('BARRIERS DOWN · GO!', 1600);
  }
  if (phase === PHASE.MATCH_END) {
    controller.releasePointer();
    exitGameMode();
  }
  if (phase === PHASE.AGENT_SELECT) {
    controller.releasePointer();
    exitGameMode();
    // Teleport to team's spawn area so you can see your team while picking an agent.
    if (me?.team) {
      const sp = SPAWNS[me.team === 'A' ? 'teamA' : 'teamB'];
      const pick = sp[Math.floor(Math.random() * sp.length)];
      controller.teleport(pick.x, pick.z, me.team === 'A' ? 0 : Math.PI);
    }
    setBarriersActive(true);
  }
  if (phase === PHASE.LOBBY) {
    currentTeam = null;
    currentReady = false;
    controller.releasePointer(); // want cursor for ready button
    exitGameMode();
    setBarriersActive(false);
    clearAllSmokes();
    clearAllBarrierWalls(scene);
    if (prev) {
      // returning from match-end: teleport back to lobby spawn and reset
      controller.teleport(LOBBY_SPAWN.x, LOBBY_SPAWN.z);
      sendPres();
    } else {
      // initial spawn at lobby
      controller.teleport(LOBBY_SPAWN.x, LOBBY_SPAWN.z);
    }
    viewmodel.setWeapon('classic');
  }
}
