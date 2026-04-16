// Load Trystero (P2P networking via public trackers) — falls across CDNs.
export async function loadTrystero() {
  const urls = [
    'https://esm.run/trystero@0.23',
    'https://cdn.jsdelivr.net/npm/trystero@0.23/+esm',
    'https://esm.sh/trystero@0.23',
  ];
  let lastErr;
  for (const u of urls) {
    try {
      const mod = await import(u);
      if (mod && typeof mod.joinRoom === 'function') {
        console.log('[net] loaded trystero from', u);
        return mod;
      }
    } catch (err) {
      console.warn('[net] trystero CDN failed:', u, err.message);
      lastErr = err;
    }
  }
  throw lastErr || new Error('could not load trystero');
}
