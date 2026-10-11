const init = window.__TV_INIT__;

export const games = init.games;

export const S = {
  room: init.room || '',
  qr: init.qr || '',
  tvId: localStorage.getItem('tvgames-tv-id') || sessionStorage.getItem('tvgames-tv-id') || null,
  tvName: '',
  state: null,
  ws: null,
  boot: init.boot || null,
};

if (S.boot && !localStorage.getItem('tvgames-boot')) localStorage.setItem('tvgames-boot', S.boot);

export function checkBoot(msg) {
  if (!msg.boot) return false;
  const prev = localStorage.getItem('tvgames-boot');
  if (!prev) { localStorage.setItem('tvgames-boot', msg.boot); return false; }
  if (prev !== msg.boot) {
    localStorage.setItem('tvgames-boot', msg.boot);
    location.reload();
    return true;
  }
  return false;
}

export const stage = document.getElementById('stage');
export const playersEl = document.getElementById('players');
export const countEl = document.getElementById('player-count');
export const statusEl = document.getElementById('ws-status');
export const currentGameEl = document.getElementById('current-game');
export const hostNameEl = document.getElementById('host-name');
export const roomCodeEl = document.getElementById('room-code');
