// Cal-Jam Fencing Duel — 3D multiplayer duel game.
// Walk around, challenge a nearby opponent (F), accept (Y), then fence:
// 4-second pick window, rock-paper-scissors triangle of Thrust/Parry/Feint.
// First to 3 hits wins, gets a crown. Losing with a crown forfeits it.

import * as THREE from 'three';

// ====================================================================
// Bootstrap + DOM
// ====================================================================

const canvas        = document.getElementById('game');
const overlay       = document.getElementById('overlay');
const peersEl       = document.getElementById('peers');
const hintEl        = document.getElementById('hint');
const usernameEl    = document.getElementById('username');
const centerMsg     = document.getElementById('centerMsg');
const scorePanel    = document.getElementById('scorePanel');
const scoreMeEl     = document.getElementById('scoreMe');
const scoreOppEl    = document.getElementById('scoreOpp');
const moveHints     = document.getElementById('moveHints');
const timerEl       = document.getElementById('timer');
const portalBtnEl   = document.getElementById('portalBtn');

const incoming = Portal.readPortalParams();
usernameEl.textContent = incoming.username;
const myColorHex = '#' + (incoming.color || 'c64bff');

const nextTarget = await Portal.pickPortalTarget();
if (nextTarget) portalBtnEl.textContent = '→ ' + nextTarget.title;
portalBtnEl.addEventListener('click', () => {
  if (!nextTarget) return;
  Portal.sendPlayerThroughPortal(nextTarget.url, {
    username: incoming.username,
    color:    incoming.color,
    speed:    incoming.speed,
  });
});

// ====================================================================
// Three.js setup
// ====================================================================

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x120826);
scene.fog = new THREE.Fog(0x120826, 28, 140);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
camera.position.set(0, 6, 12);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const ambient = new THREE.AmbientLight(0xc8a0ff, 0.5);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(20, 40, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -50;
sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50;
sun.shadow.camera.bottom = -50;
scene.add(sun);

// ----- Overworld ground -----
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.MeshStandardMaterial({ color: 0x1a1133, roughness: 0.95 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(300, 60, 0xc64bff, 0x3a224a);
grid.material.transparent = true;
grid.material.opacity = 0.35;
scene.add(grid);

// Arrow signpost pointing toward the arena
const sign = new THREE.Mesh(
  new THREE.BoxGeometry(2.2, 0.9, 0.1),
  new THREE.MeshStandardMaterial({ color: 0xc64bff, emissive: 0x4a1a6a, emissiveIntensity: 0.6 })
);
sign.position.set(0, 2.8, -12);
scene.add(sign);
const signPost = new THREE.Mesh(
  new THREE.BoxGeometry(0.18, 2.8, 0.18),
  new THREE.MeshStandardMaterial({ color: 0x552277 })
);
signPost.position.set(0, 1.4, -12);
scene.add(signPost);

// ----- Arena -----
const ARENA_CENTER = new THREE.Vector3(0, 0, -60);
const arena = new THREE.Group();
arena.position.copy(ARENA_CENTER);
scene.add(arena);

const arenaFloor = new THREE.Mesh(
  new THREE.CylinderGeometry(10, 10, 0.4, 32),
  new THREE.MeshStandardMaterial({ color: 0x221a3a, metalness: 0.35, roughness: 0.55 })
);
arenaFloor.position.y = -0.2;
arenaFloor.receiveShadow = true;
arena.add(arenaFloor);

const arenaRing = new THREE.Mesh(
  new THREE.RingGeometry(9.2, 9.8, 64),
  new THREE.MeshBasicMaterial({ color: 0x4ff0ff, side: THREE.DoubleSide })
);
arenaRing.rotation.x = -Math.PI / 2;
arenaRing.position.y = 0.02;
arena.add(arenaRing);

const innerRing = new THREE.Mesh(
  new THREE.RingGeometry(3.1, 3.25, 48),
  new THREE.MeshBasicMaterial({ color: 0xff4fd8, side: THREE.DoubleSide })
);
innerRing.rotation.x = -Math.PI / 2;
innerRing.position.y = 0.03;
arena.add(innerRing);

// Pillars offset by half a step so none sits directly between the arena
// cinematic camera (+Z) and the duellists in the middle.
for (let i = 0; i < 8; i++) {
  const a = ((i + 0.5) / 8) * Math.PI * 2;
  const pillar = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 6, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x3a224a, emissive: 0x1a0a2a, metalness: 0.6, roughness: 0.4 })
  );
  pillar.position.set(Math.cos(a) * 11, 3, Math.sin(a) * 11);
  pillar.castShadow = true;
  arena.add(pillar);
  const torch = new THREE.PointLight(0xff4fd8, 1.2, 22);
  torch.position.set(Math.cos(a) * 11, 6.6, Math.sin(a) * 11);
  arena.add(torch);
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff9ff0 })
  );
  flame.position.set(Math.cos(a) * 11, 6.6, Math.sin(a) * 11);
  arena.add(flame);
}

// ====================================================================
// Avatar construction
// ====================================================================

function makeAvatar(colorHex) {
  const g = new THREE.Group();
  const color = new THREE.Color(colorHex);

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 1.0, 6, 14),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
  );
  body.position.y = 1.0;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 18, 14),
    new THREE.MeshStandardMaterial({ color: 0xffddb0, roughness: 0.7 })
  );
  head.position.y = 1.95;
  head.castShadow = true;
  g.add(head);

  // Armor (hidden outside arena)
  const armor = new THREE.Group();
  armor.visible = false;
  const armorMat = new THREE.MeshStandardMaterial({ color: 0xd0d6e0, metalness: 0.9, roughness: 0.22 });
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.6), armorMat);
  chest.position.y = 1.25;
  chest.castShadow = true;
  armor.add(chest);
  const shL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), armorMat);
  shL.position.set(-0.56, 1.58, 0);
  armor.add(shL);
  const shR = shL.clone();
  shR.position.set(0.56, 1.58, 0);
  armor.add(shR);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), armorMat);
  helmet.position.y = 1.95;
  helmet.castShadow = true;
  armor.add(helmet);
  const mask = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.1, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x0a0514 })
  );
  mask.position.set(0, 1.95, 0.34);
  armor.add(mask);
  g.add(armor);

  // Sword (hidden outside arena)
  const sword = new THREE.Group();
  sword.visible = false;
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, 1.3),
    new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.95, roughness: 0.08, emissive: 0x222244 })
  );
  blade.position.z = 0.65;
  sword.add(blade);
  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.05, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xaa7722, metalness: 0.7 })
  );
  sword.add(guard);
  const hilt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.2, 10),
    new THREE.MeshStandardMaterial({ color: 0x553311 })
  );
  hilt.rotation.x = Math.PI / 2;
  hilt.position.z = -0.1;
  sword.add(hilt);
  const pommel = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd166, metalness: 0.9 })
  );
  pommel.position.z = -0.2;
  sword.add(pommel);
  sword.position.set(0.6, 1.2, 0.15);
  g.add(sword);

  // Crown (hidden unless champion)
  const crown = new THREE.Group();
  crown.visible = false;
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.12, 20, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xffd166, metalness: 0.95, roughness: 0.15,
      emissive: 0x332200, emissiveIntensity: 0.6, side: THREE.DoubleSide
    })
  );
  band.position.y = 2.32;
  crown.add(band);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const sp = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.24, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffe066, metalness: 0.9, roughness: 0.15,
        emissive: 0x332200, emissiveIntensity: 0.6
      })
    );
    sp.position.set(Math.cos(a) * 0.35, 2.48, Math.sin(a) * 0.35);
    crown.add(sp);
  }
  g.add(crown);

  return { group: g, body, head, armor, sword, crown };
}

// ====================================================================
// Game state
// ====================================================================

const me = {
  username: incoming.username,
  colorHex: myColorHex,
  pos:      new THREE.Vector3(0, 0, 5),
  rot:      Math.PI, // face -z toward arena
  avatar:   makeAvatar(myColorHex),
  hasCrown: false,
  duelScore: 0,
  duelMove:  null,
};
me.avatar.group.position.copy(me.pos);
me.avatar.group.rotation.y = me.rot;
scene.add(me.avatar.group);

// Remote peers (any number). The map is keyed by Trystero peerId.
// Each entry holds the avatar, nameplate DOM node, network-synced pose,
// plus per-duel fields that are only meaningful while this peer is our
// active duel partner.
const peers = new Map();

function makePeerState(id) {
  const avatar = makeAvatar('#888888');
  scene.add(avatar.group);
  avatar.group.position.set(8, 0, 5);

  const nameplate = document.createElement('div');
  nameplate.className = 'nameplate';
  nameplate.textContent = 'opponent';
  nameplate.style.color = '#ff4fd8';
  overlay.appendChild(nameplate);

  return {
    id,
    username:  'opponent',
    colorHex:  '#888888',
    pos:       new THREE.Vector3(8, 0, 5),
    rot:       0,
    avatar,
    nameplate,
    hasCrown:  false,
    duelScore: 0,
    duelMove:  null,
  };
}

function getPeer(id) {
  let p = peers.get(id);
  if (!p) {
    p = makePeerState(id);
    peers.set(id, p);
  }
  return p;
}

function removePeer(id) {
  const p = peers.get(id);
  if (!p) return;
  scene.remove(p.avatar.group);
  p.nameplate.remove();
  peers.delete(id);
}

function duelPartner() {
  return duelPartnerId ? peers.get(duelPartnerId) || null : null;
}

// Phase FSM
//   overworld | challenge-sent | challenge-received | entering-arena
//   duel-picking | duel-revealing | duel-settle | duel-over
let phase = 'overworld';
let phaseTimer = 0;
let challengeExpiresAt = 0;
let roundIndex = 0;
let pickDeadline = 0;
let revealDeadline = 0;
let lastResult = null;    // 'me' | 'opp' | 'tie'
let lastMoves  = null;    // { me, opp }
let duelWinner = null;    // 'me' | 'opp'
let duelPartnerId = null; // peerId of the current duel opponent
let iAmHost = false;      // lower peer id drives rounds

// Rock-paper-scissors: Thrust beats Feint, Feint beats Parry, Parry beats Thrust
const MOVE_NAME     = { 1: 'Thrust', 2: 'Parry', 3: 'Feint' };
const MOVE_BEATS    = { 1: 3,        2: 1,       3: 2       };
const MOVE_LOSES_TO = { 1: 2,        2: 3,       3: 1       };
function moveResult(a, b) {
  if (a === b) return 0;
  return MOVE_BEATS[a] === b ? 1 : -1;
}

// ====================================================================
// UI helpers
// ====================================================================

function showCenterMsg(text) {
  centerMsg.textContent = text;
  centerMsg.classList.remove('hidden');
}
function hideCenterMsg() { centerMsg.classList.add('hidden'); }

let flashTimeout = 0;
function flashCenterMsg(text, ms = 1600) {
  showCenterMsg(text);
  clearTimeout(flashTimeout);
  flashTimeout = setTimeout(hideCenterMsg, ms);
}

function updateScoreUI() {
  scoreMeEl.textContent = me.duelScore;
  scoreOppEl.textContent = duelPartner()?.duelScore ?? 0;
}
function showScore(v)     { scorePanel.classList.toggle('hidden', !v); }
function showMoveHints(v) {
  moveHints.classList.toggle('hidden', !v);
  if (v) {
    moveHints.querySelectorAll('.moveKey').forEach(el => el.classList.remove('locked'));
  }
}
function lockMoveHint(n) {
  moveHints.querySelectorAll('.moveKey').forEach(el => {
    el.classList.toggle('locked', Number(el.dataset.move) === n);
  });
}
function showTimer(v) { timerEl.classList.toggle('hidden', !v); }

const HINTS = {
  'overworld':           'Click to look • WASD to move • F to challenge nearby opponent',
  'challenge-sent':      'Challenge sent — waiting for response…',
  'challenge-received':  'Press Y to accept • N to decline',
  'entering-arena':      'Entering the arena…',
  'duel-picking':        '1 Thrust · 2 Parry · 3 Feint  —  Thrust→Feint, Feint→Parry, Parry→Thrust',
  'duel-revealing':      '— clash! —',
  'duel-settle':         '— clash! —',
  'duel-over':           'Duel complete',
};

// ====================================================================
// Multiplayer (Trystero)
// ====================================================================

let room = null;
let myPeerId = null;
let sendState = null;
let sendChallenge = null;
let sendMove = null;
let sendRound = null;

function setStatus(text, isError = false) {
  peersEl.textContent = text;
  peersEl.style.color = isError ? '#ff6b6b' : '';
}

function broadcastSelf() {
  if (!sendState) return;
  sendState({
    username:  me.username,
    colorHex:  me.colorHex,
    px: me.pos.x, py: me.pos.y, pz: me.pos.z,
    rot:       me.rot,
    hasCrown:  me.hasCrown,
    phase,
  });
}

async function loadTrystero() {
  const urls = [
    'https://esm.run/trystero@0.23',
    'https://cdn.jsdelivr.net/npm/trystero@0.23/+esm',
    'https://esm.sh/trystero@0.23',
  ];
  let lastErr;
  for (const u of urls) {
    try {
      const mod = await import(u);
      if (mod && typeof mod.joinRoom === 'function') {
        console.log('[jam] loaded trystero from', u);
        return mod;
      }
    } catch (err) {
      console.warn('[jam] cdn failed:', u, err.message);
      lastErr = err;
    }
  }
  throw lastErr || new Error('could not load trystero');
}

async function setupMultiplayer() {
  try {
    setStatus('connecting…');
    const { joinRoom, selfId } = await loadTrystero();
    myPeerId = selfId;
    room = joinRoom({ appId: 'cal-jam-fencing-duel' }, 'demo-room');

    const [s, gs] = room.makeAction('state');
    sendState = s;
    gs((data, peerId) => applyPeerState(getPeer(peerId), data));

    const [c, gc] = room.makeAction('chal');
    sendChallenge = c;
    gc((data, peerId) => handleChallenge(data, peerId));

    const [m, gm] = room.makeAction('move');
    sendMove = m;
    gm((data, peerId) => {
      if (peerId !== duelPartnerId) return;
      handleOpponentMove(data);
    });

    const [r, gr] = room.makeAction('round');
    sendRound = r;
    gr((data, peerId) => {
      if (peerId !== duelPartnerId) return;
      handleRoundSync(data);
    });

    room.onPeerJoin(id => {
      getPeer(id);
      setStatus(`${peers.size} opponent${peers.size === 1 ? '' : 's'} connected`);
      broadcastSelf();
    });

    room.onPeerLeave(id => {
      removePeer(id);
      if (id === duelPartnerId) {
        duelPartnerId = null;
        if (phase !== 'overworld') returnToOverworld();
      }
      setStatus(peers.size
        ? `${peers.size} opponent${peers.size === 1 ? '' : 's'} connected`
        : 'waiting for opponent…', peers.size === 0);
    });

    setStatus('waiting for opponent…');
    broadcastSelf();
  } catch (err) {
    console.error('[jam] mp setup failed:', err);
    setStatus('multiplayer offline', true);
  }
}
setupMultiplayer();

addEventListener('beforeunload', () => {
  if (room) { try { room.leave(); } catch {} }
});

function applyPeerState(peer, data) {
  peer.username = data.username || 'opponent';
  if (data.colorHex && data.colorHex !== peer.colorHex) {
    peer.colorHex = data.colorHex;
    peer.avatar.body.material.color.set(data.colorHex);
  }
  peer.hasCrown = !!data.hasCrown;
  peer.avatar.crown.visible = peer.hasCrown;

  // During a duel, our partner's position is fixed locally — ignore drift.
  const isActiveDuelPartner = peer.id === duelPartnerId && (
    phase === 'duel-picking' || phase === 'duel-revealing' ||
    phase === 'duel-settle'  || phase === 'duel-over'
  );
  if (isActiveDuelPartner) return;
  if (typeof data.px === 'number') {
    peer.pos.set(data.px, data.py || 0, data.pz || 0);
  }
  if (typeof data.rot === 'number') peer.rot = data.rot;
}

// ====================================================================
// Challenge logic
// ====================================================================

function findNearestPeerInRange(maxDist) {
  let best = null, bestDist = maxDist;
  for (const p of peers.values()) {
    const d = me.pos.distanceTo(p.pos);
    if (d < bestDist) { best = p; bestDist = d; }
  }
  return best;
}

function tryChallenge() {
  if (phase !== 'overworld' || !sendChallenge) return;
  if (peers.size === 0) {
    flashCenterMsg('No opponents connected');
    return;
  }
  const target = findNearestPeerInRange(5.5);
  if (!target) {
    flashCenterMsg('Get closer to challenge them');
    return;
  }
  duelPartnerId = target.id;
  phase = 'challenge-sent';
  challengeExpiresAt = performance.now() + 12000;
  showCenterMsg(`Challenge sent to ${target.username}…`);
  sendChallenge({ action: 'request' }, target.id);
  broadcastSelf();
}

function acceptChallenge() {
  if (phase !== 'challenge-received' || !sendChallenge || !duelPartnerId) return;
  sendChallenge({ action: 'accept' }, duelPartnerId);
  beginDuel();
}

function declineChallenge() {
  if (phase !== 'challenge-received' || !sendChallenge || !duelPartnerId) return;
  sendChallenge({ action: 'decline' }, duelPartnerId);
  duelPartnerId = null;
  phase = 'overworld';
  hideCenterMsg();
  broadcastSelf();
}

function handleChallenge(data, peerId) {
  const sender = peers.get(peerId);
  if (!sender) return;
  if (data.action === 'request') {
    if (phase !== 'overworld') {
      if (sendChallenge) sendChallenge({ action: 'decline' }, peerId);
      return;
    }
    duelPartnerId = peerId;
    phase = 'challenge-received';
    challengeExpiresAt = performance.now() + 12000;
    showCenterMsg(`${sender.username || 'opponent'} challenges you to a duel!\nY to accept · N to decline`);
    broadcastSelf();
  } else if (data.action === 'accept') {
    if (phase !== 'challenge-sent' || peerId !== duelPartnerId) return;
    beginDuel();
  } else if (data.action === 'decline') {
    if (phase !== 'challenge-sent' || peerId !== duelPartnerId) return;
    phase = 'overworld';
    duelPartnerId = null;
    flashCenterMsg(`${sender.username || 'opponent'} declined`);
    broadcastSelf();
  }
}

// ====================================================================
// Duel state machine
// ====================================================================

function beginDuel() {
  const partner = duelPartner();
  if (!partner) return;
  // Lower peer id drives rounds between us.
  iAmHost = myPeerId < partner.id;
  // Release the mouse so the arena cinematic cam isn't fighting pointer-lock input.
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  phase = 'entering-arena';
  phaseTimer = performance.now() + 2000;
  me.duelScore = 0;
  partner.duelScore = 0;
  roundIndex = 0;
  lastResult = null;
  lastMoves = null;
  duelWinner = null;
  me.duelMove = null;
  partner.duelMove = null;

  // Host on the west side, non-host on the east.
  const mySide  = iAmHost ? -1 : 1;
  const oppSide = -mySide;
  me.pos.set(ARENA_CENTER.x + mySide * 3.2, 0, ARENA_CENTER.z);
  me.rot = mySide < 0 ? Math.PI / 2 : -Math.PI / 2; // face the center
  partner.pos.set(ARENA_CENTER.x + oppSide * 3.2, 0, ARENA_CENTER.z);
  partner.rot = oppSide < 0 ? Math.PI / 2 : -Math.PI / 2;

  // Snap avatars so we don't see a lerp from the overworld.
  me.avatar.group.position.copy(me.pos);
  me.avatar.group.rotation.y = me.rot;
  partner.avatar.group.position.copy(partner.pos);
  partner.avatar.group.rotation.y = partner.rot;
  resetDuelPose(me.avatar);
  resetDuelPose(partner.avatar);

  me.avatar.armor.visible = true;
  me.avatar.sword.visible = true;
  partner.avatar.armor.visible = true;
  partner.avatar.sword.visible = true;

  updateScoreUI();
  showScore(true);
  showCenterMsg('To the arena!');
  broadcastSelf();
}

function hostAdvanceRound() {
  if (!iAmHost || !sendRound || !duelPartnerId) return;
  const next = roundIndex + 1;
  sendRound({ action: 'start', roundIndex: next }, duelPartnerId);
  startRound(next);
}

function handleRoundSync(data) {
  if (data.action === 'start' && !iAmHost) {
    startRound(data.roundIndex);
  }
}

function startRound(idx) {
  const partner = duelPartner();
  if (!partner) return;
  roundIndex = idx;
  phase = 'duel-picking';
  me.duelMove = null;
  partner.duelMove = null;
  pickDeadline = performance.now() + 4000;
  resetDuelPose(me.avatar);
  resetDuelPose(partner.avatar);
  showCenterMsg(`Round ${roundIndex} — lock in your move!`);
  showMoveHints(true);
  showTimer(true);
}

function pickMove(n) {
  if (phase !== 'duel-picking') return;
  if (me.duelMove != null) return;
  me.duelMove = n;
  lockMoveHint(n);
  const beats  = MOVE_NAME[MOVE_BEATS[n]];
  const losesTo = MOVE_NAME[MOVE_LOSES_TO[n]];
  showCenterMsg(`You picked ${MOVE_NAME[n]} — beats ${beats}, loses to ${losesTo}\nWaiting for opponent…`);
  if (sendMove && duelPartnerId) sendMove({ roundIndex, move: n }, duelPartnerId);
  checkBothMovesReady();
}

function handleOpponentMove(data) {
  const partner = duelPartner();
  if (!partner) return;
  if (data.roundIndex !== roundIndex) return;
  if (partner.duelMove != null) return;
  partner.duelMove = data.move;
  checkBothMovesReady();
}

function checkBothMovesReady() {
  if (phase !== 'duel-picking') return;
  const partner = duelPartner();
  if (!partner) return;
  if (me.duelMove != null && partner.duelMove != null) revealRound();
}

function revealRound() {
  const partner = duelPartner();
  if (!partner) return;
  phase = 'duel-revealing';
  revealDeadline = performance.now() + 2000;
  showMoveHints(false);
  showTimer(false);

  const mv = me.duelMove || 1;
  const ov = partner.duelMove || 1;
  const r = moveResult(mv, ov);
  lastMoves = { me: mv, opp: ov };

  if (r === 1) {
    me.duelScore++;
    lastResult = 'me';
    showCenterMsg(`${MOVE_NAME[mv]} beats ${MOVE_NAME[ov]} — TOUCHÉ!`);
  } else if (r === -1) {
    partner.duelScore++;
    lastResult = 'opp';
    showCenterMsg(`${MOVE_NAME[ov]} beats ${MOVE_NAME[mv]} — you're hit!`);
  } else {
    lastResult = 'tie';
    showCenterMsg(`Both ${MOVE_NAME[mv]} — blades clash!`);
  }
  updateScoreUI();
}

function afterReveal() {
  const partner = duelPartner();
  resetDuelPose(me.avatar);
  if (partner) resetDuelPose(partner.avatar);
  if (me.duelScore >= 3 || (partner && partner.duelScore >= 3)) {
    endDuel();
    return;
  }
  phase = 'duel-settle';
  phaseTimer = performance.now() + 900;
}

function endDuel() {
  const partner = duelPartner();
  phase = 'duel-over';
  phaseTimer = performance.now() + 5500;
  duelWinner = me.duelScore >= 3 ? 'me' : 'opp';

  if (duelWinner === 'me') {
    if (partner && partner.hasCrown) {
      partner.hasCrown = false;
      partner.avatar.crown.visible = false;
    }
    me.hasCrown = true;
    me.avatar.crown.visible = true;
    showCenterMsg('★ VICTORY ★\nThe crown is yours!');
  } else {
    if (me.hasCrown) {
      me.hasCrown = false;
      me.avatar.crown.visible = false;
      showCenterMsg('DEFEAT\nYou lost your crown…');
    } else {
      showCenterMsg('DEFEAT');
    }
  }
  broadcastSelf();
}

function returnToOverworld() {
  const partner = duelPartner();
  phase = 'overworld';
  phaseTimer = 0;
  roundIndex = 0;
  me.duelMove = null;
  me.duelScore = 0;
  lastResult = null;
  lastMoves = null;
  duelWinner = null;

  me.avatar.armor.visible = false;
  me.avatar.sword.visible = false;
  resetDuelPose(me.avatar);
  if (partner) {
    partner.duelMove = null;
    partner.duelScore = 0;
    partner.avatar.armor.visible = false;
    partner.avatar.sword.visible = false;
    resetDuelPose(partner.avatar);
  }

  duelPartnerId = null;

  me.pos.set(0, 0, 5);
  me.rot = Math.PI;
  me.avatar.group.position.copy(me.pos);
  me.avatar.group.rotation.y = me.rot;

  hideCenterMsg();
  showScore(false);
  showMoveHints(false);
  showTimer(false);
  broadcastSelf();
}

// ====================================================================
// Input
// ====================================================================

const keys = new Set();
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === 'f') tryChallenge();
  else if (k === 'y') acceptChallenge();
  else if (k === 'n') declineChallenge();
  else if (k === '1') pickMove(1);
  else if (k === '2') pickMove(2);
  else if (k === '3') pickMove(3);
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

// Mouse look (pointer lock). Click the canvas to capture; Esc to release.
// camYaw is the angle such that the camera sits at
//   player + (sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)) * dist.
// camYaw = 0 puts the camera on the +Z side of the player looking toward -Z.
let camYaw = 0;
let camPitch = 0.28;
const CAM_DIST = 9;

canvas.addEventListener('click', () => {
  if (phase !== 'overworld' && phase !== 'challenge-sent' && phase !== 'challenge-received') return;
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
});
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas) return;
  camYaw   -= e.movementX * 0.0025;
  camPitch -= e.movementY * 0.0025;
  // Clamp pitch: don't cross the horizon or look straight down.
  camPitch = Math.max(-0.15, Math.min(0.95, camPitch));
});

// ====================================================================
// Update + animation
// ====================================================================

function resetDuelPose(av) {
  av.group.position.y = 0;
  av.sword.position.set(0.6, 1.2, 0.15);
  av.sword.rotation.set(0, 0, 0);
  av.body.rotation.set(0, 0, 0);
  av.body.position.set(0, 1.0, 0);
  av.body.material.emissive.setHex(0x000000);
}

function applyMoveAnim(av, move, t, won, lost) {
  // t is a sin-shaped 0..1..0 curve over the reveal window
  if (move === 1) {
    // Thrust: sword extends forward, body lunges slightly
    av.sword.position.z = 0.15 + t * 1.1;
    av.sword.rotation.x = -0.18 * t;
    av.body.position.z = t * 0.4;
  } else if (move === 2) {
    // Parry: sword swings up and across
    av.sword.rotation.z = -Math.PI * 0.35 * t;
    av.sword.rotation.y = Math.PI * 0.2 * t;
    av.sword.position.y = t * 0.3;
  } else if (move === 3) {
    // Feint: sword weaves, body dips
    av.sword.position.x = 0.6 + Math.sin(t * Math.PI * 3) * 0.35;
    av.sword.position.z = 0.15 + t * 0.5;
    av.body.rotation.z = Math.sin(t * Math.PI * 2) * 0.22;
  }
  if (won) {
    av.body.position.y = 1.0 + Math.sin(t * Math.PI) * 0.15;
  }
  if (lost) {
    av.body.material.emissive.setRGB(t * 0.7, 0, 0);
    av.body.rotation.x = t * 0.4;
  } else {
    av.body.material.emissive.setHex(0x000000);
  }
}

function animateDuelReveal() {
  const partner = duelPartner();
  if (!partner) return;
  const now = performance.now();
  const total = 2000;
  const elapsed = total - Math.max(0, revealDeadline - now);
  const t = Math.max(0, Math.min(1, elapsed / total));
  const curve = Math.sin(t * Math.PI); // 0 -> 1 -> 0
  const mv = lastMoves?.me ?? 1;
  const ov = lastMoves?.opp ?? 1;
  applyMoveAnim(me.avatar,      mv, curve, lastResult === 'me',  lastResult === 'opp');
  applyMoveAnim(partner.avatar, ov, curve, lastResult === 'opp', lastResult === 'me');
}

function updateMovement(dt) {
  if (phase !== 'overworld') return;
  let fwd = 0, str = 0;
  if (keys.has('w') || keys.has('arrowup'))    fwd += 1;
  if (keys.has('s') || keys.has('arrowdown'))  fwd -= 1;
  if (keys.has('d') || keys.has('arrowright')) str += 1;
  if (keys.has('a') || keys.has('arrowleft'))  str -= 1;
  if (fwd || str) {
    const len = Math.hypot(fwd, str);
    fwd /= len; str /= len;
    // Forward direction (away from the camera, horizontal only).
    const sY = Math.sin(camYaw), cY = Math.cos(camYaw);
    const mvx = -sY * fwd + cY * str;
    const mvz = -cY * fwd - sY * str;
    const speed = Math.max(3, incoming.speed || 6);
    me.pos.x += mvx * speed * dt;
    me.pos.z += mvz * speed * dt;
    me.rot = Math.atan2(mvx, mvz) + Math.PI;
  }
  me.pos.x = Math.max(-120, Math.min(120, me.pos.x));
  me.pos.z = Math.max(-25, Math.min(120, me.pos.z));
}

function updatePhase(dt) {
  const now = performance.now();

  if (phase === 'challenge-sent' || phase === 'challenge-received') {
    if (now >= challengeExpiresAt) {
      phase = 'overworld';
      hideCenterMsg();
      broadcastSelf();
    }
  } else if (phase === 'entering-arena') {
    if (now >= phaseTimer) {
      hideCenterMsg();
      if (iAmHost) {
        hostAdvanceRound();
      } else {
        showCenterMsg('Waiting for opponent…');
      }
    }
  } else if (phase === 'duel-picking') {
    const partner = duelPartner();
    const remain = Math.max(0, pickDeadline - now);
    timerEl.textContent = Math.ceil(remain / 1000);
    if (remain <= 0 && me.duelMove == null) {
      pickMove(1); // auto-thrust on timeout
    }
    // Grace period for a missing opponent move, then force-resolve.
    if (partner && remain <= 0 && partner.duelMove == null && now - pickDeadline > 1500) {
      partner.duelMove = 1;
      revealRound();
    }
  } else if (phase === 'duel-revealing') {
    if (now >= revealDeadline) afterReveal();
  } else if (phase === 'duel-settle') {
    if (now >= phaseTimer) {
      if (iAmHost) hostAdvanceRound();
    }
  } else if (phase === 'duel-over') {
    const partner = duelPartner();
    if (duelWinner === 'me') {
      me.avatar.group.rotation.y += dt * 3;
      me.avatar.group.position.y = Math.abs(Math.sin(now * 0.007)) * 0.7;
      me.avatar.crown.rotation.y += dt * 4;
    } else if (duelWinner === 'opp' && partner) {
      partner.avatar.group.rotation.y += dt * 3;
      partner.avatar.group.position.y = Math.abs(Math.sin(now * 0.007)) * 0.7;
      partner.avatar.crown.rotation.y += dt * 4;
    }
    if (now >= phaseTimer) returnToOverworld();
  }

  hintEl.textContent = HINTS[phase] || '';
}

function updateAvatars() {
  // During the reveal animation and victory dance we drive transforms directly.
  if (phase === 'duel-revealing' || phase === 'duel-over') return;

  me.avatar.group.position.copy(me.pos);
  me.avatar.group.rotation.y = me.rot;
  for (const p of peers.values()) {
    p.avatar.group.position.lerp(p.pos, 0.25);
    p.avatar.group.rotation.y = p.rot;
  }
}

function updateCamera() {
  let targetPos, lookAt;
  const isArena = (
    phase === 'entering-arena' || phase === 'duel-picking' ||
    phase === 'duel-revealing' || phase === 'duel-settle' ||
    phase === 'duel-over'
  );
  if (isArena) {
    // Cinematic side view of the arena
    targetPos = ARENA_CENTER.clone().add(new THREE.Vector3(0, 5.5, 12));
    lookAt    = ARENA_CENTER.clone().add(new THREE.Vector3(0, 1.4, 0));
  } else {
    // Mouse-look orbit: camera sits behind the player at spherical offset.
    const cp = Math.cos(camPitch);
    const offset = new THREE.Vector3(
      Math.sin(camYaw) * cp * CAM_DIST,
      Math.sin(camPitch) * CAM_DIST + 2.2,
      Math.cos(camYaw) * cp * CAM_DIST,
    );
    targetPos = me.pos.clone().add(offset);
    lookAt    = me.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
  }
  camera.position.lerp(targetPos, 0.18);
  camera.lookAt(lookAt);
}

// ----- Nameplates -----
const myLabel = document.createElement('div');
myLabel.className = 'nameplate';
myLabel.textContent = me.username;
overlay.appendChild(myLabel);

const _proj = new THREE.Vector3();
function projectLabel(el, worldPos) {
  _proj.copy(worldPos);
  _proj.y += 2.8;
  _proj.project(camera);
  if (_proj.z < -1 || _proj.z > 1) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.style.left = ((_proj.x * 0.5 + 0.5) * window.innerWidth) + 'px';
  el.style.top  = ((-_proj.y * 0.5 + 0.5) * window.innerHeight) + 'px';
}
function updateNameplates() {
  myLabel.textContent = me.username;
  projectLabel(myLabel, me.avatar.group.position);
  for (const p of peers.values()) {
    p.nameplate.textContent = p.username || 'opponent';
    projectLabel(p.nameplate, p.avatar.group.position);
  }
}

// ====================================================================
// Main loop
// ====================================================================

const clock = new THREE.Clock();
let lastBroadcast = 0;

function tick() {
  const dt = Math.min(0.05, clock.getDelta());

  updateMovement(dt);
  updatePhase(dt);
  updateAvatars();
  if (phase === 'duel-revealing') animateDuelReveal();
  updateCamera();
  updateNameplates();

  const now = performance.now();
  if (now - lastBroadcast > 100) {
    lastBroadcast = now;
    broadcastSelf();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
