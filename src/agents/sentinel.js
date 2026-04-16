// Sentinel: defensive anchor. Signature ability: Barrier Wall.
//
// Barrier Wall (E, 1 charge/round, free): deploys a solid 6m wall 4m in front
// of you. Blocks bullets and movement for everyone. Lasts 20 seconds.
export const SENTINEL = {
  id: 'sentinel',
  name: 'Sentinel',
  role: 'SENTINEL',
  color: '#9cffb4',
  glyph: '▣',
  abilities: [
    {
      id: 'barrierwall',
      key: 'E',
      name: 'Barrier Wall',
      charges: 1,
      cost: 0,
      duration: 20,
      width: 6,
      height: 2.6,
      offset: 4,
      description: 'Deploy a solid 6m wall 4m in front of you. Blocks bullets and movement for 20s.',
    },
  ],
};
