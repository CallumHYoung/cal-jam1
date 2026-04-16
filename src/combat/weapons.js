// Data-driven weapon table. Each gun is fully described here.
// dmg: { head, body, legs } at near range. Falloff simple linear to 0.7x at 30m.
// rpm: rounds per minute. spread: radians of random cone at hip fire.

export const WEAPONS = {
  classic: {
    id: 'classic',
    name: 'Classic',
    cost: 0, // free starter every round
    slot: 'secondary',
    kind: 'pistol',
    dmg: { head: 78, body: 26, legs: 22 },
    rpm: 380,
    mag: 12,
    reserve: 36,
    spread: 0.012,
    recoil: 1.0,
    sound: 'pistol',
  },
  sheriff: {
    id: 'sheriff',
    name: 'Sheriff',
    cost: 800,
    slot: 'secondary',
    kind: 'heavy',
    dmg: { head: 159, body: 55, legs: 47 },
    rpm: 200,
    mag: 6,
    reserve: 24,
    spread: 0.006,
    recoil: 2.0,
    sound: 'heavy',
  },
  spectre: {
    id: 'spectre',
    name: 'Spectre',
    cost: 1600,
    slot: 'primary',
    kind: 'smg',
    dmg: { head: 78, body: 26, legs: 22 },
    rpm: 800,
    mag: 30,
    reserve: 90,
    spread: 0.018,
    recoil: 0.7,
    sound: 'smg',
  },
  vandal: {
    id: 'vandal',
    name: 'Vandal',
    cost: 2900,
    slot: 'primary',
    kind: 'rifle',
    dmg: { head: 156, body: 40, legs: 34 },
    rpm: 600,
    mag: 25,
    reserve: 75,
    spread: 0.009,
    recoil: 1.3,
    sound: 'rifle',
  },
  operator: {
    id: 'operator',
    name: 'Operator',
    cost: 4700,
    slot: 'primary',
    kind: 'sniper',
    dmg: { head: 255, body: 150, legs: 120 },
    rpm: 41,
    mag: 5,
    reserve: 10,
    spread: 0.001,
    recoil: 3.5,
    sound: 'sniper',
  },
};

export const ARMOR = {
  light: { id: 'light', name: 'Light Shields', cost: 400, hp: 25, reduce: 0.15 },
  heavy: { id: 'heavy', name: 'Heavy Shields', cost: 1000, hp: 50, reduce: 0.3 },
};

export const GRENADES = {
  frag: { id: 'frag', name: 'Frag', cost: 300, max: 1, fuse: 2.2, radius: 5, dmg: 120 },
  // future: smoke, flash, etc.
};

export function defaultInventory() {
  return {
    primary: null,
    secondary: 'classic', // always free
    armor: null,
    grenades: { frag: 0 },
  };
}

// Damage falloff: full at ≤15m, linear down to 0.7x at ≥30m.
export function falloff(distance) {
  if (distance <= 15) return 1;
  if (distance >= 30) return 0.7;
  return 1 - ((distance - 15) / 15) * 0.3;
}

export function computeDamage(weaponId, hitKind, distance) {
  const w = WEAPONS[weaponId];
  if (!w) return 0;
  const base = w.dmg[hitKind] ?? w.dmg.body;
  return Math.round(base * falloff(distance));
}
