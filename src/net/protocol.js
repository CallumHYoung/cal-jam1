// Message schemas and channel names shared between host and client code.
// All channels created via Trystero's makeAction().

export const PROTOCOL_VERSION = 1;
export const APP_ID = 'cal-jam-tac-ops';
export const ROOM_NAME = 'tac-ops-main';

// Channel names (kept short — Trystero limits to 12 chars).
export const CH = {
  PRES:    'pres',    // lobby presence: {u, color, ready, agent, team}
  POSE:    'pose',    // {p, y, pi, anim} — 20Hz broadcast
  FIRE:    'fire',    // {o, d, w, seq} — to host
  NADE:    'nade',    // {o, d, type, seq} — to host
  ABILITY: 'abil',    // {type, seq} — to host
  BUY:     'buy',     // {item} — to host
  STATE:   'state',   // host → all, 10Hz authoritative snapshot
  EVENT:   'event',   // one-shot: {type, ...} — host → all
  CHAT:    'chat',    // {msg}
};
