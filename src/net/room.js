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
    if (iAmHost !== wasHost) {
      console.log('[net] host change:', iAmHost ? 'I AM HOST' : 'not host');
      for (const cb of hostListeners) cb(iAmHost);
    }
  }

  // initial self-only election (solo → I am host)
  reelect();

  function onHostChange(cb) {
    hostListeners.push(cb);
    // fire immediately with current state so callers don't miss the initial transition
    Promise.resolve().then(() => cb(iAmHost));
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
    sendChat:    (d, target) => actions.CHAT.send(d, target),

    onPres:    (cb) => actions.PRES.on(cb),
    onPose:    (cb) => actions.POSE.on(cb),
    onFire:    (cb) => actions.FIRE.on(cb),
    onNade:    (cb) => actions.NADE.on(cb),
    onAbility: (cb) => actions.ABILITY.on(cb),
    onBuy:     (cb) => actions.BUY.on(cb),
    onState:   (cb) => actions.STATE.on(cb),
    onEvent:   (cb) => actions.EVENT.on(cb),
    onChat:    (cb) => actions.CHAT.on(cb),

    onPeerJoin: (cb) => room.onPeerJoin(cb),
    onPeerLeave: (cb) => room.onPeerLeave(cb),
  };
}
