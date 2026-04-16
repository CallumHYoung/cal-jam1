import { PHASE } from '../game/state.js';
import { AGENTS } from '../agents/index.js';

export class AgentSelectUI {
  constructor({ onPick }) {
    this.root = document.getElementById('agentSelect');
    this.grid = document.getElementById('agentGrid');
    this.timer = document.getElementById('agentTimer');
    this.previewName = document.getElementById('agentPreviewName');
    this.previewDesc = document.getElementById('agentPreviewDesc');
    this.lockBtn = document.getElementById('agentLockBtn');
    this.onPick = onPick;

    this._hoverAgent = 'duelist';

    this.lockBtn.addEventListener('click', () => {
      this._lockedIn = true;
      this.root.classList.add('hidden');
      this.onPick(this._hoverAgent);
    });

    this._built = false;
    this._lockedIn = false;
    this._initedFromMe = false;
  }

  _build() {
    this.grid.innerHTML = '';
    for (const [id, a] of Object.entries(AGENTS)) {
      const card = document.createElement('div');
      card.className = 'agentCard' + (id === this._hoverAgent ? ' selected' : '');
      card.dataset.id = id;
      card.innerHTML = `
        <div class="agentPortrait" style="background:${a.color}">${a.glyph}</div>
        <div class="agentName">${a.name}</div>
        <div class="agentRole">${a.role}</div>
      `;
      card.addEventListener('mouseenter', () => this._setHover(id));
      card.addEventListener('click', () => this._setHover(id));
      this.grid.appendChild(card);
    }
    // "coming soon" placeholders
    for (let i = Object.keys(AGENTS).length; i < 6; i++) {
      const stub = document.createElement('div');
      stub.className = 'agentCard stub';
      stub.innerHTML = `<div class="agentPortrait">?</div><div class="agentName">???</div><div class="agentRole">coming soon</div>`;
      this.grid.appendChild(stub);
    }
    this._built = true;
  }

  _setHover(id) {
    if (!AGENTS[id]) return;
    this._hoverAgent = id;
    const a = AGENTS[id];
    this.previewName.textContent = a.name.toUpperCase();
    this.previewDesc.innerHTML = `<span class="role">${a.role}</span> · <b>${a.abilities[0].name}</b> (E) — ${a.abilities[0].description}`;
    for (const card of this.grid.children) {
      card.classList.toggle('selected', card.dataset.id === id);
    }
  }

  render({ phase, remainingSec, me }) {
    if (phase !== PHASE.AGENT_SELECT) {
      this.root.classList.add('hidden');
      this._lockedIn = false;
      this._initedFromMe = false;
      return;
    }
    if (!this._built) this._build();
    if (!this._lockedIn) this.root.classList.remove('hidden');
    // Initialize hover from server-side agent ONCE when entering agent-select.
    // Never overwrite the user's in-flight selection on subsequent frames.
    if (!this._initedFromMe && me?.agent) {
      this._setHover(me.agent);
      this._initedFromMe = true;
    }
    this.timer.textContent = Math.max(0, remainingSec);
  }
}
