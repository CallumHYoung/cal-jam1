import { PHASE } from '../game/state.js';

export class LobbyUI {
  constructor({ onReady }) {
    this.root = document.getElementById('lobby');
    this.count = document.getElementById('lobbyCount');
    this.listA = document.getElementById('lobbyListA');
    this.listB = document.getElementById('lobbyListB');
    this.listU = document.getElementById('lobbyListU');
    this.status = document.getElementById('lobbyStatus');
    this.readyBtn = document.getElementById('readyBtn');

    this.readyBtn.addEventListener('click', () => onReady());
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); }

  render({ phase, players, selfId, startCountdown }) {
    if (phase !== PHASE.LOBBY) { this.hide(); return; }
    this.show();

    const entries = Object.entries(players);
    this.count.textContent = entries.length;

    const rowsA = [], rowsB = [], rowsU = [];
    for (const [id, p] of entries) {
      const row = document.createElement('div');
      row.className = 'lpRow' + (p.ready ? ' ready' : '') + (id === selfId ? ' me' : '');
      row.innerHTML = `
        <span class="dot" style="background:${p.color}; color:${p.color}"></span>
        <span class="nm">${escape(p.name)}${id === selfId ? ' (you)' : ''}</span>
        <span class="rd">${p.ready ? 'READY' : 'not ready'}</span>
      `;
      if (p.team === 'A') rowsA.push(row);
      else if (p.team === 'B') rowsB.push(row);
      else rowsU.push(row);
    }
    replaceChildren(this.listA, rowsA);
    replaceChildren(this.listB, rowsB);
    replaceChildren(this.listU, rowsU);

    const me = players[selfId];
    const ready = !!me?.ready;
    this.readyBtn.classList.toggle('isReady', ready);
    this.readyBtn.textContent = ready ? '✓ READY — press R to unready' : 'READY UP (R)';
    this.readyBtn.disabled = !me?.team;

    // status line
    this._renderStatus({ players: entries, selfId, startCountdown });
  }

  _renderStatus({ players, selfId, startCountdown }) {
    const me = players.find(([id]) => id === selfId)?.[1];
    const countA = players.filter(([, p]) => p.team === 'A').length;
    const countB = players.filter(([, p]) => p.team === 'B').length;
    const countU = players.length - countA - countB;
    const allReady = players.every(([, p]) => p.ready);
    const balanced = countA > 0 && countB > 0 && Math.abs(countA - countB) <= 1;

    this.status.classList.remove('countdown', 'warn');

    if (startCountdown && startCountdown > 0) {
      this.status.textContent = `STARTING IN ${startCountdown}…`;
      this.status.classList.add('countdown');
      return;
    }
    if (!me?.team) {
      this.status.textContent = 'step onto a team pad to begin';
      return;
    }
    if (countU > 0) {
      this.status.textContent = `waiting for ${countU} player${countU > 1 ? 's' : ''} to pick a team`;
      this.status.classList.add('warn');
      return;
    }
    if (players.length < 2) {
      this.status.textContent = 'waiting for another player to join the room…';
      this.status.classList.add('warn');
      return;
    }
    if (!balanced) {
      this.status.textContent = `teams unbalanced (${countA} vs ${countB}) — step onto the other pad`;
      this.status.classList.add('warn');
      return;
    }
    if (!allReady) {
      const notReady = players.filter(([, p]) => !p.ready).length;
      this.status.textContent = `${notReady} player${notReady > 1 ? 's' : ''} not ready`;
      this.status.classList.add('warn');
      return;
    }
    this.status.textContent = 'all ready — starting soon…';
  }
}

function escape(s) { return String(s || '').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])); }

function replaceChildren(el, children) {
  while (el.firstChild) el.removeChild(el.firstChild);
  for (const c of children) el.appendChild(c);
}
