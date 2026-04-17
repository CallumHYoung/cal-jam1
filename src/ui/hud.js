import { PHASE } from '../game/state.js';
import { WEAPONS } from '../combat/weapons.js';
import { AGENTS, DEFAULT_AGENT } from '../agents/index.js';

export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.scoreTeam = document.getElementById('scoreTeam');
    this.scoreEnemy = document.getElementById('scoreEnemy');
    this.roundNum = document.getElementById('roundNum');
    this.roundTimer = document.getElementById('roundTimer');
    this.hudTop = document.getElementById('hudTop');
    this.bigTimerWrap = document.getElementById('bigTimerWrap');
    this.bigTimerLabel = document.getElementById('bigTimerLabel');
    this.bigTimerClock = document.getElementById('bigTimerClock');
    this.hpVal = document.getElementById('hpVal');
    this.armorVal = document.getElementById('armorVal');
    this.moneyVal = document.getElementById('moneyVal');
    this.weaponName = document.getElementById('weaponName');
    this.ammoMag = document.getElementById('ammoMag');
    this.ammoReserve = document.getElementById('ammoReserve');
    this.abName = document.getElementById('abName');
    this.abCharges = document.getElementById('abCharges');
    this.killfeed = document.getElementById('killfeed');
    this.centerMsg = document.getElementById('centerMsg');
    this.hitMarker = document.getElementById('hitMarker');
    this._hitT = 0;
  }

  pingHit(headshot = false) {
    this.hitMarker.style.opacity = '1';
    this.hitMarker.style.color = headshot ? '#ff6a4a' : '#fff';
    this._hitT = performance.now();
  }

  centerShow(text, ms = 2000) {
    this.centerMsg.textContent = text;
    this.centerMsg.classList.remove('hidden');
    clearTimeout(this._centerT);
    this._centerT = setTimeout(() => this.centerMsg.classList.add('hidden'), ms);
  }

  update(dt) {
    if (performance.now() - this._hitT > 180) this.hitMarker.style.opacity = '0';
  }

  render({ phase, round, scoreA, scoreB, remainingSec, me, ammo, team, events, bomb }) {
    const showHud = (phase === PHASE.ROUND_LIVE || phase === PHASE.BUY || phase === PHASE.ROUND_END);
    this.root.classList.toggle('hidden', !showHud || !me);

    // Big center timer: visible during buy + live. Bomb timer takes over when planted.
    const showBig = (phase === PHASE.BUY || phase === PHASE.ROUND_LIVE) && !!me;
    const planted = !!(bomb && bomb.planted);
    this.bigTimerWrap.classList.toggle('hidden', !showBig || planted);
    this.hudTop?.classList.toggle('bigTimer', showBig && !planted);

    if (!me) return;

    // scores (own team first)
    const myScore = team === 'A' ? scoreA : scoreB;
    const oppScore = team === 'A' ? scoreB : scoreA;
    this.scoreTeam.textContent = myScore;
    this.scoreEnemy.textContent = oppScore;
    this.roundNum.textContent = `ROUND ${round || 1}`;
    const m = Math.floor(remainingSec / 60);
    const s = Math.floor(remainingSec % 60);
    this.roundTimer.textContent = `${m}:${s.toString().padStart(2, '0')}`;

    if (showBig) {
      const label = phase === PHASE.BUY ? 'BUY PHASE' : `ROUND ${round || 1}`;
      this.bigTimerLabel.textContent = label;
      this.bigTimerClock.textContent = `${m}:${s.toString().padStart(2, '0')}`;
      this.bigTimerWrap.classList.toggle('urgent', phase === PHASE.ROUND_LIVE && remainingSec <= 10);
      this.bigTimerWrap.classList.toggle('low', phase === PHASE.ROUND_LIVE && remainingSec > 10 && remainingSec <= 30);
    }

    this.hpVal.textContent = me.hp;
    this.armorVal.textContent = me.armor;
    this.moneyVal.textContent = me.money;

    const w = WEAPONS[me.weaponCurrent] || WEAPONS.classic;
    this.weaponName.textContent = w.name.toUpperCase();
    this.ammoMag.textContent = ammo?.mag ?? w.mag;
    this.ammoReserve.textContent = ammo?.reserve ?? w.reserve;

    const agent = AGENTS[me.agent || DEFAULT_AGENT];
    this.abName.textContent = agent?.abilities[0]?.name || 'Ability';
    this.abCharges.textContent = me.abilityCharges;
    // killfeed
    this.killfeed.innerHTML = '';
    for (const ev of events.slice(-6)) {
      if (ev.type !== 'kill') continue;
      const row = document.createElement('div');
      row.className = 'kf';
      const km = `<span class="n">${shortName(ev.killerName || ev.killer)}</span>`;
      const vm = `<span class="n">${shortName(ev.victimName || ev.victim)}</span>`;
      row.innerHTML = `${km} <span class="w">${ev.weapon}${ev.headshot ? ' ◉' : ''}</span> ${vm}`;
      this.killfeed.appendChild(row);
    }
  }
}

function shortName(s) { return String(s || '').slice(0, 12); }
