import { initialSnapshot, applySnapshot } from './state.js';

// The client side of the game state: receives snapshots, smooths phase timers,
// exposes helpers for UI queries.
export class ClientRuntime {
  constructor({ selfId }) {
    this.selfId = selfId;
    this.state = initialSnapshot();
    this.phaseEndsAtLocal = 0; // derived from phaseRemaining + localTime at receipt
    this.lastUpdated = 0;
    this.recentEvents = []; // for killfeed: {text, color, t}
  }

  applySnapshot(snap) {
    // compute local-time deadline based on the server-relative remaining seconds
    const now = performance.now();
    this.phaseEndsAtLocal = now + (snap.phaseRemaining || 0) * 1000;
    this.state = applySnapshot(this.state, snap);
    this.lastUpdated = now;
  }

  phaseRemaining() {
    const now = performance.now();
    return Math.max(0, Math.ceil((this.phaseEndsAtLocal - now) / 1000));
  }

  me() {
    return this.state.players[this.selfId] || null;
  }

  teammates() {
    const me = this.me();
    if (!me || !me.team) return [];
    return Object.entries(this.state.players)
      .filter(([, p]) => p.team === me.team)
      .map(([id, p]) => ({ id, ...p }));
  }

  enemies() {
    const me = this.me();
    if (!me || !me.team) return [];
    return Object.entries(this.state.players)
      .filter(([, p]) => p.team && p.team !== me.team)
      .map(([id, p]) => ({ id, ...p }));
  }

  pushEvent(ev) {
    const t = performance.now();
    this.recentEvents.push({ ...ev, t });
    // trim to last 12 and last 6s
    while (this.recentEvents.length && (this.recentEvents.length > 12 || t - this.recentEvents[0].t > 6000)) {
      this.recentEvents.shift();
    }
  }
}
