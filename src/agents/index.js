import { DUELIST } from './duelist.js';
import { CONTROLLER } from './controller.js';

// Registry. Drop new agents in adjacent files and register here.
export const AGENTS = {
  [DUELIST.id]: DUELIST,
  [CONTROLLER.id]: CONTROLLER,
};

export const DEFAULT_AGENT = DUELIST.id;

export function getAbility(agentId, abilityId) {
  const a = AGENTS[agentId];
  if (!a) return null;
  if (abilityId == null) return a.abilities[0] || null;
  return a.abilities.find(b => b.id === abilityId) || a.abilities[0] || null;
}
