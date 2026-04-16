import { DUELIST } from './duelist.js';
import { CONTROLLER } from './controller.js';
import { SENTINEL } from './sentinel.js';

// Registry. Drop new agents in adjacent files and register here.
export const AGENTS = {
  [DUELIST.id]: DUELIST,
  [CONTROLLER.id]: CONTROLLER,
  [SENTINEL.id]: SENTINEL,
};

export const DEFAULT_AGENT = DUELIST.id;

export function getAbility(agentId, abilityId) {
  const a = AGENTS[agentId];
  if (!a) return null;
  if (abilityId == null) return a.abilities[0] || null;
  return a.abilities.find(b => b.id === abilityId) || a.abilities[0] || null;
}
