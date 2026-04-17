import { loadTrystero } from './trystero.js';
import { CH, APP_ID, ROOM_NAME } from './protocol.js';

// Wraps Trystero. Exposes:
//  - selfId
//  - isHost() — deterministic (lowest peerId among self + all peers)
//  - send{Pres,Pose,Fire,Nade,Ability,Buy,State,Event}
//  - on{Pres,Pose,Fire,Nade,Ability,Buy,State,Event}(cb)
//  - peerIds() → [selfId, ...others]
//  - onHostChange(cb(isHost))
export async function connectRoom() {
  const ts = await loadTrystero();
  const selfId = ts.selfId;
  const room = ts.joinRoom({ appId: APP_ID }, ROOM_NAME);

  const peers = new Set();
  let iAmHost = null; // null triggers first-render on registration
  const hostListeners = [];

  // Trystero discovers peers via the tracker over ~500-1500ms. Before
  // discovery settles we'd wrongly think we're solo host and broadcast a
  // stale initial snapshot, thrashing the real host's state. Gate all
  // host-change notifications behind this discovery window so the election
  // result we fire is based on the actual peer set.
  const DISCOVERY_DELAY_MS = 1800;
  let discoverySettled = false;

  const actions = {};
  for (const [k, name] of Object.entries(CH)) {
    const [send, on] = room.makeAction(name);
    actions[k] = { send, on };
  }

  room.onPeerJoin((id) => {
    peers.add(id);
    reelect();
  });
  room.onPeerLeave((id) => {
    peers.delete(id);
    reelect();
  });

  function reelect() {
    const ids = [selfId, ...peers];
    ids.sort();
    const wasHost = iAmHost;
    iAmHost = ids[0] === selfId;
    if (!discoverySettled) return; // silent until the window closes
    if (iAmHost !== wasHost) {
      console.log('[net] host change:', iAmHost ? 'I AM HOST' : 'not host');
      for (const cb of hostListeners) cb(iAmHost);
    }
  }

  // initial self-only election (solo → I am host). Don't fire listeners yet
  // — wait for the discovery window so new joiners don't transiently broadcast.
  reelect();

  setTimeout(() => {
    discoverySettled = true;
    console.log('[net] discovery settled:', iAmHost ? 'I AM HOST' : 'not host', `peers=${peers.size}`);
    for (const cb of hostListeners) cb(iAmHost);
  }, DISCOVERY_DELAY_MS);

  function onHostChange(cb) {
    hostListeners.push(cb);
    // Only fire immediately if discovery has already finished. Otherwise
    // the gated setTimeout above will fire every listener with the real
    // election result.
    if (discoverySettled) {
      Promise.resolve().then(() => cb(iAmHost));
    }
  }

  return {
    selfId,
    room,
    peerIds: () => [selfId, ...peers],
    isHost: () => iAmHost,
    onHostChange,

    sendPres:    (d, target) => actions.PRES.send(d, target),
    sendPose:    (d, target) => actions.POSE.send(d, target),
    sendFire:    (d, target) => actions.FIRE.send(d, target),
    sendNade:    (d, target) => actions.NADE.send(d, target),
    sendAbility: (d, target) => actions.ABILITY.send(d, target),
    sendBuy:     (d, target) => actions.BUY.send(d, target),
    sendState:   (d, target) => actions.STATE.send(d, target),
    sendEvent:   (d, target) => actions.EVENT.send(d, target),
    sendBomb:    (d, target) => actions.BOMB.send(d, target),
    sendChat:    (d, target) => actions.CHAT.send(d, target),

    onPres:    (cb) => actions.PRES.on(cb),
    onPose:    (cb) => actions.POSE.on(cb),
    onFire:    (cb) => actions.FIRE.on(cb),
    onNade:    (cb) => actions.NADE.on(cb),
    onAbility: (cb) => actions.ABILITY.on(cb),
    onBuy:     (cb) => actions.BUY.on(cb),
    onState:   (cb) => actions.STATE.on(cb),
    onEvent:   (cb) => actions.EVENT.on(cb),
    onBomb:    (cb) => actions.BOMB.on(cb),
    onChat:    (cb) => actions.CHAT.on(cb),

    onPeerJoin: (cb) => room.onPeerJoin(cb),
    onPeerLeave: (cb) => room.onPeerLeave(cb),
  };
}
