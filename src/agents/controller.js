// Controller: map-control agent. Signature ability: Sky Smoke.
//
// Sky Smoke (E, 2 charges/round, free): opens a tactical map overlay.
// Click anywhere on the map to deploy a smoke cloud that blocks vision for 10s.
export const CONTROLLER = {
  id: 'controller',
  name: 'Controller',
  role: 'CONTROLLER',
  color: '#4ff0ff',
  glyph: '☁',
  abilities: [
    {
      id: 'skysmoke',
      key: 'E',
      name: 'Sky Smoke',
      charges: 2,
      cost: 0,
      duration: 10,
      radius: 4.5,
      description: 'Open the tactical map and click to deploy a smoke cloud anywhere — blocks vision for 10s',
    },
  ],
};
