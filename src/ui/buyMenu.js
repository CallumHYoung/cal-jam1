import { PHASE } from '../game/state.js';
import { WEAPONS, ARMOR, GRENADES } from '../combat/weapons.js';

export class BuyMenuUI {
  constructor({ onBuy, getState }) {
    this.root = document.getElementById('buyMenu');
    this.grid = document.getElementById('buyGrid');
    this.timer = document.getElementById('buyTimer');
    this.money = document.getElementById('buyMoney');
    this.onBuy = onBuy;
    this.getState = getState;

    this._open = false;
    this._built = false;
    this._lastPhase = null;

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyB') this._userToggle();
      if (e.code === 'Escape' && this._open) this._userClose();
    });
  }

  _build() {
    this.grid.innerHTML = '';
    const addSection = (title, items, kind) => {
      const header = document.createElement('div');
      header.className = 'buyHeader';
      header.textContent = title;
      this.grid.appendChild(header);
      for (const it of items) {
        const card = document.createElement('div');
        card.className = 'buyItem';
        card.dataset.id = it.id;
        card.dataset.kind = kind;
        card.innerHTML = `
          <div class="bName">${it.name}</div>
          <div class="bCost"><span class="cashIcon">$</span>${it.cost}</div>
          <div class="bHint">${hintFor(kind, it)}</div>
        `;
        card.addEventListener('click', () => this.onBuy(it.id));
        this.grid.appendChild(card);
      }
    };
    addSection('PISTOLS',      Object.values(WEAPONS).filter(w => w.slot === 'secondary' && w.cost > 0), 'weapon');
    addSection('SMG & RIFLES', Object.values(WEAPONS).filter(w => w.slot === 'primary'), 'weapon');
    addSection('ARMOR',        Object.values(ARMOR), 'armor');
    addSection('GRENADES',     Object.values(GRENADES), 'grenade');
    this._built = true;
  }

  _userToggle() {
    if (this.getState().phase !== PHASE.BUY) return;
    if (this._open) this._userClose();
    else this._show();
  }
  _userClose() { this._open = false; this._applyDOM(); }
  _show() { if (!this._built) this._build(); this._open = true; this._applyDOM(); }
  _applyDOM() { this.root.classList.toggle('hidden', !this._open); }

  render({ phase, remainingSec, money, inventory }) {
    // phase-transition: auto-open only on entering BUY; force-close leaving BUY
    if (phase !== this._lastPhase) {
      if (phase === PHASE.BUY) this._show();
      else { this._open = false; this._applyDOM(); }
      this._lastPhase = phase;
    }
    if (phase !== PHASE.BUY) return;

    this.timer.textContent = Math.max(0, remainingSec);
    this.money.textContent = money;

    for (const card of this.grid.querySelectorAll('.buyItem')) {
      const kind = card.dataset.kind;
      const id = card.dataset.id;
      let cost = 0, owned = false;
      if (kind === 'weapon') {
        cost = WEAPONS[id].cost;
        owned = inventory.primary === id || inventory.secondary === id;
      } else if (kind === 'armor') {
        cost = ARMOR[id].cost;
        owned = inventory.armorType === id;
      } else if (kind === 'grenade') {
        cost = GRENADES[id].cost;
        owned = (inventory.grenades[id] || 0) >= GRENADES[id].max;
      }
      card.classList.toggle('disabled', money < cost || owned);
      card.classList.toggle('owned', owned);
    }
  }
}

function hintFor(kind, it) {
  if (kind === 'weapon') return `${it.kind} · ${it.mag}/${it.reserve} · ${it.dmg.head} head`;
  if (kind === 'armor') return `${it.hp} shield · ${Math.round(it.reduce * 100)}% reduce`;
  if (kind === 'grenade') return `${it.radius}m · ${it.dmg} dmg`;
  return '';
}
