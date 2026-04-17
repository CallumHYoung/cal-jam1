import { WALLS, TEAM_PADS, SPAWNS, BOMB_SITES } from '../world/map.js';

// World extent shown on the tactical map. Map is 140x140; we render ±70.
const MAP_EXTENT = 70;

// Full-screen tactical map overlay. Controller opens it via their Sky Smoke
// ability; clicking on the map deploys a smoke there. ESC cancels.
export class MapPlacerUI {
  constructor() {
    this.root = document.getElementById('mapPlacer');
    this.canvas = document.getElementById('mapPlacerCanvas');
    this.chargesEl = document.getElementById('mpCharges');
    this.ctx = this.canvas.getContext('2d');
    this._open = false;
    this.onDeploy = null;
    this._mouseX = null;
    this._mouseY = null;

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this._mouseX = e.clientX - rect.left;
      this._mouseY = e.clientY - rect.top;
      this._draw();
    });
    this.canvas.addEventListener('mouseleave', () => { this._mouseX = null; this._draw(); });
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const world = this._canvasToWorld(cx, cy);
      if (this.onDeploy) this.onDeploy(world);
      this.close();
    });

    document.addEventListener('keydown', (e) => {
      // Only Escape closes — KeyE is the open trigger and would close it in the same event.
      if (this._open && e.code === 'Escape') {
        this.close();
      }
    });
  }

  isOpen() { return this._open; }

  open({ selfPos, teammates = [], charges = 1, onDeploy }) {
    if (charges <= 0) return false;
    this._open = true;
    this.root.classList.remove('hidden');
    this.onDeploy = onDeploy;
    this._selfPos = selfPos;
    this._teammates = teammates;
    if (this.chargesEl) this.chargesEl.textContent = charges;
    this._draw();
    return true;
  }

  close() {
    this._open = false;
    this.root.classList.add('hidden');
    this.onDeploy = null;
  }

  _worldToCanvas(x, z) {
    const cw = this.canvas.width, ch = this.canvas.height;
    const span = MAP_EXTENT * 2;
    const sx = ((x + MAP_EXTENT) / span) * cw;
    const sz = ((z + MAP_EXTENT) / span) * ch;
    return { x: sx, y: sz };
  }

  _canvasToWorld(cx, cy) {
    const cw = this.canvas.width, ch = this.canvas.height;
    const span = MAP_EXTENT * 2;
    const wx = (cx / cw) * span - MAP_EXTENT;
    const wz = (cy / ch) * span - MAP_EXTENT;
    return { x: wx, z: wz };
  }

  _draw() {
    const ctx = this.ctx;
    const cw = this.canvas.width, ch = this.canvas.height;

    // background
    ctx.fillStyle = '#07040e';
    ctx.fillRect(0, 0, cw, ch);

    // side tint bands
    const span = MAP_EXTENT * 2;
    const bandH = (10 / span) * ch;
    ctx.fillStyle = 'rgba(74,163,255,0.15)';
    ctx.fillRect(0, 0, cw, bandH);
    ctx.fillStyle = 'rgba(255,77,106,0.15)';
    ctx.fillRect(0, ch - bandH, cw, bandH);

    // bomb site labels (from BOMB_SITES)
    ctx.fillStyle = 'rgba(255,204,51,0.12)';
    for (const s of BOMB_SITES) {
      const p = this._worldToCanvas(s.x, s.z);
      const r = (s.r / span) * cw;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = '#ffcc33';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const s of BOMB_SITES) {
      const p = this._worldToCanvas(s.x, s.z);
      ctx.fillText(s.id, p.x, p.y);
    }

    // walls
    ctx.fillStyle = '#6a3d9e';
    for (const w of WALLS) {
      const p1 = this._worldToCanvas(w.x - w.w/2, w.z - w.d/2);
      const p2 = this._worldToCanvas(w.x + w.w/2, w.z + w.d/2);
      const width = Math.max(2, p2.x - p1.x);
      const height = Math.max(2, p2.y - p1.y);
      ctx.fillRect(p1.x, p1.y, width, height);
    }

    // spawn markers
    for (const s of SPAWNS.teamA) {
      const p = this._worldToCanvas(s.x, s.z);
      ctx.fillStyle = '#4aa3ff';
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
    for (const s of SPAWNS.teamB) {
      const p = this._worldToCanvas(s.x, s.z);
      ctx.fillStyle = '#ff4d6a';
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    }

    // teammates
    for (const tm of (this._teammates || [])) {
      const p = this._worldToCanvas(tm.x, tm.z);
      ctx.fillStyle = 'rgba(74,163,255,0.9)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // self
    if (this._selfPos) {
      const p = this._worldToCanvas(this._selfPos.x, this._selfPos.z);
      ctx.fillStyle = '#4ff0ff';
      ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // smoke preview at cursor
    if (this._mouseX != null) {
      const world = this._canvasToWorld(this._mouseX, this._mouseY);
      const p = this._worldToCanvas(world.x, world.z);
      const r = (4.5 / (MAP_EXTENT * 2)) * cw;
      ctx.fillStyle = 'rgba(196,192,208,0.3)';
      ctx.strokeStyle = '#c4c0d0';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();

      // crosshair lines
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, ch); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(cw, p.y); ctx.stroke();
    }
  }
}
