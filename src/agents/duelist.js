// Duelist: aggressive flanker. Signature ability: Riposte.
//
// Riposte (E, 1 charge/round, free): 2.5s of +30% move speed and +15% dmg output.
// Character glows in agent accent color and has a small crosshair flourish.
export const DUELIST = {
  id: 'duelist',
  name: 'Duelist',
  role: 'DUELIST',
  color: '#ff3b7a',
  glyph: '⚔',
  abilities: [
    {
      id: 'riposte',
      key: 'E',
      name: 'Riposte',
      charges: 1,
      cost: 0,
      duration: 2.5,
      description: '2.5s surge: faster movement, +15% damage output',
      damageMul: 1.15,
      speedMul: 1.3,
    },
  ],
};
