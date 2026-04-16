import { ARMOR } from './weapons.js';

// Pure logic: given a health state + damage + optional armor, return new state.
export function applyDamage(state, rawDmg) {
  let hp = state.hp;
  let armor = state.armor;
  let armorType = state.armorType;
  let dmg = rawDmg;

  if (armor > 0 && armorType) {
    const red = ARMOR[armorType]?.reduce ?? 0;
    const absorbed = Math.min(armor, Math.floor(dmg * red * 2));
    armor = Math.max(0, armor - absorbed);
    dmg = Math.max(0, dmg - absorbed);
  }
  hp = Math.max(0, hp - dmg);
  return { ...state, hp, armor, armorType: armor > 0 ? armorType : null, dead: hp <= 0 };
}

export function fullHeal(state) {
  return { ...state, hp: 100, dead: false };
}

export function applyArmor(state, armorType) {
  const a = ARMOR[armorType];
  if (!a) return state;
  return { ...state, armor: a.hp, armorType: a.id };
}
