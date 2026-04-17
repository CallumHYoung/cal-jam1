// Tech: initiator. Signature ability: Recon Drone.
//
// Recon Drone (E, 1 charge/round, free): deploys a fast floor drone you
// remote-pilot. The agent's body stays at the deploy spot — vulnerable —
// while the camera switches to drone view. Fly around for up to 3 seconds,
// then detonate (E or LMB, or auto on timeout) for a 4.5m AoE explosion
// that hurts anyone in line-of-sight. Camera returns to the agent afterward.
export const TECH = {
  id: 'tech',
  name: 'Tech',
  role: 'INITIATOR',
  color: '#6afcff',
  glyph: '◉',
  abilities: [
    {
      id: 'recondrone',
      key: 'E',
      name: 'Recon Drone',
      charges: 1,
      cost: 0,
      duration: 3.0,   // seconds of flight
      radius: 4.5,     // explosion AoE
      damage: 110,     // AoE damage at ground zero
      speed: 14,       // drone m/s
      description: 'Deploy + pilot a floor drone for up to 3s. Detonate (E/LMB) to deal AoE damage. You stand still while piloting.',
    },
  ],
};
