export class Scoreboard {
  constructor() {
    this.root = document.getElementById('scoreboard');
    this.allyList = document.getElementById('sbAllyList');
    this.enemyList = document.getElementById('sbEnemyList');
    this.allyScore = document.getElementById('sbAlly');
    this.enemyScore = document.getElementById('sbEnemy');
    this._open = false;

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') { e.preventDefault(); this.show(); }
    });
    document.addEventListener('keyup', (e) => {
      if (e.code === 'Tab') this.hide();
    });
  }
  show() { this.root.classList.remove('hidden'); this._open = true; }
  hide() { this.root.classList.add('hidden'); this._open = false; }

  render({ players, me, scoreA, scoreB }) {
    if (!this._open || !me?.team) return;
    const myTeam = me.team;
    const ally = [], enemy = [];
    for (const [id, p] of Object.entries(players)) {
      if (!p.team) continue;
      const r = { id, ...p };
      (p.team === myTeam ? ally : enemy).push(r);
    }
    const row = (p) => `
      <div class="sbRow${p.alive ? '' : ' dead'}">
        <span class="nm">${escape(p.name)}</span>
        <span class="kd">${p.kills}/${p.deaths}</span>
        <span class="hp">${p.hp}</span>
        <span class="money">$${p.money}</span>
      </div>`;
    this.allyList.innerHTML = ally.map(row).join('');
    this.enemyList.innerHTML = enemy.map(row).join('');
    this.allyScore.textContent = myTeam === 'A' ? scoreA : scoreB;
    this.enemyScore.textContent = myTeam === 'A' ? scoreB : scoreA;
  }
}

function escape(s) { return String(s || '').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])); }
