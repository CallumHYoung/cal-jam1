import { PHASE, PHASE_DUR, MATCH, initialSnapshot } from './state.js';
import { defaultInventory, WEAPONS, ARMOR, GRENADES, computeDamage } from '../combat/weapons.js';
import { applyDamage, fullHeal, applyArmor } from '../combat/health.js';
import { SPAWNS, raycastWorld } from '../world/map.js';
import { AGENTS, DEFAULT_AGENT } from '../agents/index.js';

// The host authoritative runtime. Owns the match state, validates intents,
// broadcasts snapshots and events.
//
// getPeerPoses() → Map<id, {x,y,z,yaw,pitch,alive}>   (from network module)
// broadcast()    → { state(obj), event(obj) }         (bound to room.sendState/sendEvent)
export class HostRuntime {
  constructor({ selfId, broadcast, getPeerPoses }) {
    this.selfId = selfId;
    this.broadcast = broadcast;
    this.getPeerPoses = getPeerPoses;
    this.state = initialSnapshot();
    this.lastSnapshot = 0;
    this.snapshotHz = 10;

    // Local physical events (grenades exploded, etc.) get queued then flushed.
    this.eventQueue = [];
  }

  /** Called every frame. */
  tick(now /* ms */) {
    // phase timer
    const s = this.state;
    if (s.phaseEndsAt && now >= s.phaseEndsAt) {
      this._advancePhase(now);
    }

    if (s.phase === PHASE.LOBBY) this._checkAutoStart(now);
    if (s.phase === PHASE.ROUND_LIVE) this._checkRoundEnd(now);

    // broadcast @ 10Hz
    if (now - this.lastSnapshot > 1000 / this.snapshotHz) {
      this.lastSnapshot = now;
      this.broadcast.state(this._snapshotPayload(now));
      if (this.eventQueue.length) {
        for (const e of this.eventQueue) this.broadcast.event(e);
        this.eventQueue.length = 0;
      }
    }
  }

  _checkAutoStart(now) {
    const players = Object.values(this.state.players).filter(p => !p.spectator);
    if (players.length < 2) { this._startAt = 0; this.state.startCountdown = 0; return; }
    const allTeamed = players.every(p => p.team === 'A' || p.team === 'B');
    const allReady = players.every(p => p.ready);
    const countA = players.filter(p => p.team === 'A').length;
    const countB = players.filter(p => p.team === 'B').length;
    const balanced = countA > 0 && countB > 0 && Math.abs(countA - countB) <= 1;
    const ok = allTeamed && allReady && balanced;

    if (ok) {
      if (!this._startAt) this._startAt = now + 4500;
      const remain = Math.max(0, Math.ceil((this._startAt - now) / 1000));
      this.state.startCountdown = remain;
      if (now >= this._startAt) {
        this._startAt = 0;
        this.state.startCountdown = 0;
        this.startMatch(now);
      }
    } else {
      this._startAt = 0;
      this.state.startCountdown = 0;
    }
  }

  _snapshotPayload(now) {
    const s = this.state;
    return {
      phase: s.phase,
      phaseRemaining: Math.max(0, Math.ceil((s.phaseEndsAt - now) / 1000)),
      round: s.round,
      scoreA: s.scoreA,
      scoreB: s.scoreB,
      players: s.players,
      startCountdown: s.startCountdown || 0,
    };
  }

  /* ---------- lobby + presence ---------- */

  upsertPlayer(id, patch) {
    const isNew = !this.state.players[id];
    const existing = this.state.players[id] || {
      name: id.slice(0, 6), color: '#c64bff', team: null, agent: 'duelist',
      hp: 100, armor: 0, armorType: null, money: MATCH.START_MONEY, alive: true,
      ready: false, weaponCurrent: 'classic', inventory: defaultInventory(),
      abilityCharges: 1, abilityActiveUntil: 0, kills: 0, deaths: 0,
      spectator: false,
    };
    if (isNew && this.state.phase !== PHASE.LOBBY) {
      existing.spectator = true;
      existing.team = null;
      existing.alive = false;
    }
    // Spectators can't change team or ready via pres — ignore those fields until the match ends.
    const filtered = { ...patch };
    if (existing.spectator) {
      delete filtered.team;
      delete filtered.ready;
    }
    this.state.players[id] = { ...existing, ...filtered };
  }

  removePlayer(id) {
    delete this.state.players[id];
  }

  setReady(id, ready) {
    if (!this.state.players[id]) return;
    this.state.players[id].ready = !!ready;
  }

  setAgent(id, agent) {
    if (!this.state.players[id]) return;
    this.state.players[id].agent = agent;
  }

  startMatch(now) {
    // teams are taken from the presence-set `team` (players pick them in the lobby)
    const ids = Object.keys(this.state.players).filter(id => !this.state.players[id].spectator);
    if (ids.length < 2) return false;
    for (const id of ids) {
      const p = this.state.players[id];
      if (p.team !== 'A' && p.team !== 'B') {
        const countA = Object.values(this.state.players).filter(q => !q.spectator && q.team === 'A').length;
        const countB = Object.values(this.state.players).filter(q => !q.spectator && q.team === 'B').length;
        p.team = countA <= countB ? 'A' : 'B';
      }
      p.money = MATCH.START_MONEY;
      p.inventory = defaultInventory();
      p.kills = 0;
      p.deaths = 0;
    }
    this.state.round = 1;
    this.state.scoreA = 0;
    this.state.scoreB = 0;
    this.state.startCountdown = 0;
    this._enter(PHASE.AGENT_SELECT, now);
    // force immediate broadcast so clients transition without waiting for next tick
    this.lastSnapshot = 0;
    return true;
  }

  /* ---------- phase transitions ---------- */

  _enter(phase, now) {
    this.state.phase = phase;
    const dur = PHASE_DUR[phase];
    this.state.phaseEndsAt = dur ? now + dur * 1000 : 0;

    if (phase === PHASE.BUY) {
      // respawn all, heal to full
      for (const p of Object.values(this.state.players)) {
        if (p.spectator || !p.team) continue; // skip spectators + unassigned
        const spawns = SPAWNS[p.team === 'A' ? 'teamA' : 'teamB'];
        const pick = spawns[Math.floor(Math.random() * spawns.length)];
        p.spawn = pick;
        Object.assign(p, fullHeal(p));
        p.alive = true;
        p.armor = p.armorType ? ARMOR[p.armorType].hp : 0; // carry over only what they still have
        const agent = AGENTS[p.agent || DEFAULT_AGENT];
        p.abilityCharges = agent?.abilities[0]?.charges ?? 1;
        p.abilityActiveUntil = 0;
        // reset inventory if they died last round — they keep weapons if they survived.
        if (p._diedLastRound) {
          p.inventory = defaultInventory();
          p.weaponCurrent = 'classic';
          p._diedLastRound = false;
        } else {
          p.weaponCurrent = p.inventory.primary || p.inventory.secondary || 'classic';
        }
      }
    }

    if (phase === PHASE.ROUND_LIVE) {
      // Defensive: re-assert alive state for every team member on round start.
      // Belt-and-braces in case _enter(BUY) was skipped for any player
      // (e.g., they joined during agent-select and the host never saw them yet).
      for (const p of Object.values(this.state.players)) {
        if (p.spectator || !p.team) continue;
        if (p.hp <= 0) { p.hp = 100; }
        p.alive = true;
      }
      this._liveStartedAt = now;
    }

    if (phase === PHASE.ROUND_END) {
      // payout
      const winner = this._lastRoundWinner || null;
      for (const p of Object.values(this.state.players)) {
        const won = (p.team === winner);
        const delta = won ? MATCH.WIN_BONUS : MATCH.LOSS_BONUS;
        p.money = Math.min(MATCH.MAX_MONEY, p.money + delta);
        if (!p.alive) p._diedLastRound = true;
      }
    }

    if (phase === PHASE.MATCH_END) {
      this.broadcast.event({ type: 'matchEnd', scoreA: this.state.scoreA, scoreB: this.state.scoreB });
    }
  }

  _advancePhase(now) {
    const cur = this.state.phase;
    if (cur === PHASE.AGENT_SELECT) {
      this.state.round = Math.max(1, this.state.round);
      this._enter(PHASE.BUY, now);
    } else if (cur === PHASE.BUY) {
      this._enter(PHASE.ROUND_LIVE, now);
    } else if (cur === PHASE.ROUND_LIVE) {
      // timer ran out with no wipe → defenders (team B, arbitrarily) win
      this._resolveRound('B', now);
    } else if (cur === PHASE.ROUND_END) {
      // next round or match end
      if (this.state.scoreA >= MATCH.ROUNDS_TO_WIN || this.state.scoreB >= MATCH.ROUNDS_TO_WIN) {
        this._enter(PHASE.MATCH_END, now);
      } else {
        this.state.round += 1;
        this._enter(PHASE.BUY, now);
      }
    } else if (cur === PHASE.MATCH_END) {
      // back to lobby — spectators rejoin as regular players
      for (const p of Object.values(this.state.players)) {
        p.team = null;
        p.money = MATCH.START_MONEY;
        p.ready = false;
        p.inventory = defaultInventory();
        p.spectator = false;
        p.alive = true;
      }
      this.state.round = 0;
      this.state.scoreA = 0;
      this.state.scoreB = 0;
      this._enter(PHASE.LOBBY, now);
      this.state.phaseEndsAt = 0;
    }
  }

  _checkRoundEnd(now) {
    // Grace window so round doesn't insta-resolve on the tick we enter ROUND_LIVE.
    if (this._liveStartedAt && now - this._liveStartedAt < 1500) return;

    const teamA = Object.values(this.state.players).filter(p => !p.spectator && p.team === 'A');
    const teamB = Object.values(this.state.players).filter(p => !p.spectator && p.team === 'B');
    // If a team has no members at all (e.g., everyone left), don't use that as a win condition.
    if (teamA.length === 0 || teamB.length === 0) return;
    const aliveA = teamA.filter(p => p.alive).length;
    const aliveB = teamB.filter(p => p.alive).length;

    if (aliveA === 0 && aliveB > 0) { this._logWipe('A', teamA, teamB); this._resolveRound('B', now); }
    else if (aliveB === 0 && aliveA > 0) { this._logWipe('B', teamA, teamB); this._resolveRound('A', now); }
    else if (aliveA === 0 && aliveB === 0) { this._logWipe('draw', teamA, teamB); this._resolveRound(null, now); }
  }

  _logWipe(side, teamA, teamB) {
    const dump = arr => arr.map(p => `${p.name}(alive=${p.alive}, hp=${p.hp})`).join(', ');
    console.log(`[host] round resolve (${side} wiped):  A=[${dump(teamA)}]  B=[${dump(teamB)}]`);
  }

  _resolveRound(winner, now) {
    this._lastRoundWinner = winner;
    if (winner === 'A') this.state.scoreA += 1;
    else if (winner === 'B') this.state.scoreB += 1;
    this.broadcast.event({ type: 'roundEnd', winner, scoreA: this.state.scoreA, scoreB: this.state.scoreB });
    this._enter(PHASE.ROUND_END, now);
  }

  /* ---------- validated intents from peers ---------- */

  handleBuy(id, item) {
    const s = this.state;
    if (s.phase !== PHASE.BUY) return;
    const p = s.players[id];
    if (!p || p.spectator) return;

    if (WEAPONS[item]) {
      const w = WEAPONS[item];
      if (p.money < w.cost) return;
      p.money -= w.cost;
      if (w.slot === 'primary') p.inventory.primary = w.id;
      else p.inventory.secondary = w.id;
      p.weaponCurrent = w.id;
      this.broadcast.event({ type: 'buy', id, item: w.id });
      return;
    }
    if (ARMOR[item]) {
      const a = ARMOR[item];
      if (p.money < a.cost) return;
      p.money -= a.cost;
      Object.assign(p, applyArmor(p, a.id));
      this.broadcast.event({ type: 'buy', id, item: a.id });
      return;
    }
    if (GRENADES[item]) {
      const g = GRENADES[item];
      if (p.money < g.cost) return;
      if ((p.inventory.grenades[g.id] || 0) >= g.max) return;
      p.money -= g.cost;
      p.inventory.grenades[g.id] = (p.inventory.grenades[g.id] || 0) + 1;
      this.broadcast.event({ type: 'buy', id, item: g.id });
      return;
    }
  }

  // Hit validation using host's own peer pose cache.
  handleFire(fromId, { o, d, w, hitOwnerId, hitKind, hitDist }) {
    const s = this.state;
    if (s.phase !== PHASE.ROUND_LIVE) return;
    const shooter = s.players[fromId];
    if (!shooter || !shooter.alive || shooter.spectator) return;
    if (!hitOwnerId) return;
    const victim = s.players[hitOwnerId];
    if (!victim || !victim.alive || victim.spectator) return;
    if (victim.team === shooter.team) return; // no friendly fire

    // Anti-cheat: re-raycast against the host's own wall data. If a wall is
    // closer than the reported hit distance, the shot was blocked — reject.
    if (Array.isArray(o) && Array.isArray(d) && typeof hitDist === 'number') {
      const origin = { x: o[0], y: o[1], z: o[2] };
      const dir = { x: d[0], y: d[1], z: d[2] };
      const wallT = raycastWorld(origin, dir, 300);
      if (wallT + 0.05 < hitDist) return;
    }

    const dmg = computeDamage(w, hitKind || 'body', hitDist || 0);
    const next = applyDamage(victim, dmg);
    Object.assign(victim, next);

    this.broadcast.event({
      type: 'damage',
      from: fromId, to: hitOwnerId, kind: hitKind, dmg,
      weapon: w,
    });

    if (next.dead) {
      victim.alive = false;
      victim.deaths += 1;
      shooter.kills += 1;
      shooter.money = Math.min(MATCH.MAX_MONEY, shooter.money + MATCH.KILL_BONUS);
      this.broadcast.event({
        type: 'kill',
        killer: fromId, victim: hitOwnerId, weapon: w, headshot: hitKind === 'head',
      });
    }
  }

  // Grenade AoE — called when a grenade detonates (simulated locally on host too).
  handleGrenadeExplosion({ pos, radius, dmg, ownerId }) {
    if (this.state.phase !== PHASE.ROUND_LIVE) return;
    const poses = this.getPeerPoses();
    for (const [id, p] of Object.entries(this.state.players)) {
      if (!p.alive || p.spectator) continue;
      const pose = poses.get(id) || (id === this.selfId ? this._selfPose : null);
      if (!pose) continue;
      const dx = pose.x - pos.x;
      const dz = pose.z - pos.z;
      const dy = (pose.y ?? 1) - pos.y;
      const d2 = dx*dx + dz*dz + dy*dy;
      if (d2 >= radius * radius) continue;
      const distF = Math.sqrt(d2) / radius;
      const finalDmg = Math.round(dmg * (1 - distF));
      if (finalDmg <= 0) continue;
      const next = applyDamage(p, finalDmg);
      Object.assign(p, next);
      this.broadcast.event({ type: 'damage', from: ownerId, to: id, kind: 'aoe', dmg: finalDmg, weapon: 'frag' });
      if (next.dead) {
        p.alive = false;
        p.deaths += 1;
        const attacker = this.state.players[ownerId];
        if (attacker && attacker !== p) {
          attacker.kills += 1;
          attacker.money = Math.min(MATCH.MAX_MONEY, attacker.money + MATCH.KILL_BONUS);
        }
        this.broadcast.event({ type: 'kill', killer: ownerId, victim: id, weapon: 'frag', headshot: false });
      }
    }
  }

  handleAbility(id, { type, pos }) {
    const s = this.state;
    if (s.phase !== PHASE.ROUND_LIVE) return;
    const p = s.players[id];
    if (!p || !p.alive || p.spectator) return;
    if (p.abilityCharges <= 0) return;
    p.abilityCharges -= 1;

    if (type === 'riposte') {
      p.abilityActiveUntil = performance.now() + 2500;
      this.broadcast.event({ type: 'ability', from: id, kind: 'riposte' });
    } else if (type === 'skysmoke' && pos) {
      this.broadcast.event({
        type: 'ability', from: id, kind: 'skysmoke',
        pos, radius: 4.5, duration: 10,
      });
    }
  }

  // Host must know about its own pose too, for grenade AoE. Set by main.js.
  setSelfPose(pose) { this._selfPose = pose; }
}
