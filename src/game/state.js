// Match FSM constants + default state shape.
export const PHASE = {
  LOBBY:        'lobby',
  AGENT_SELECT: 'agent-select',
  BUY:          'buy',
  ROUND_LIVE:   'live',
  ROUND_END:    'round-end',
  MATCH_END:    'match-end',
};

export const PHASE_DUR = {
  [PHASE.AGENT_SELECT]: 20,
  [PHASE.BUY]:          15,
  [PHASE.ROUND_LIVE]:   120,
  [PHASE.ROUND_END]:    4,
  [PHASE.MATCH_END]:    10,
};

// Bomb/spike constants
export const BOMB = {
  PLANT_TIME: 3.5,      // seconds to plant (attacker holds USE in site)
  DEFUSE_TIME: 7,       // seconds to defuse (defender holds USE next to bomb)
  DETONATE_TIME: 45,    // seconds after plant until detonation
  DEFUSE_RADIUS: 2.5,   // defender must be within this of bomb.pos
  PICKUP_RADIUS: 1.8,   // attacker touches dropped bomb to pick up
};

export const MATCH = {
  ROUNDS_TO_WIN: 5,
  START_MONEY:   800,
  WIN_BONUS:     3000,
  LOSS_BONUS:    1900,
  KILL_BONUS:    200,
  MAX_MONEY:     9000,
};

export function initialSnapshot() {
  return {
    phase: PHASE.LOBBY,
    phaseEndsAt: 0,    // epoch ms (host clock). Clients just display a local countdown.
    round: 0,
    scoreA: 0,
    scoreB: 0,
    players: {},       // id → { name, color, team, agent, hp, armor, armorType, money, alive, weaponCurrent, inventory, abilityCharges, abilityActive, ready }
    events: [],        // small rolling buffer for killfeed (last ~10)
    startCountdown: 0, // seconds until auto-start (lobby only)
    bomb: emptyBomb(),
  };
}

export function emptyBomb() {
  return {
    carrierId: null,   // attacker currently holding the spike (null if dropped/planted)
    dropped: false,    // true when lying on ground waiting for pickup
    planted: false,
    plantedBy: null,
    site: null,        // 'A' | 'B' | null
    pos: null,         // [x, z] world coords when dropped/planted
    plantedAt: 0,      // ms epoch
    detonateAt: 0,     // ms epoch — phase timer flips to this once planted
  };
}

// Merge partial snapshot into full state (clients receive deltas if we decide to optimize later).
export function applySnapshot(existing, snap) {
  return { ...existing, ...snap, players: { ...existing.players, ...snap.players } };
}
