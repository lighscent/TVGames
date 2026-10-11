import { S, UI, GAMES } from './state.js';
import { showJoinError } from './utils.js';
import { renderRooms } from './join.js';
import { renderLobby } from './lobby.js';
import { renderControls } from './play.js';

export function currentRoute() {
  const p = location.pathname.replace(/\/+$/, '');
  if (p === '/controller') return { name: 'login' };
  if (p === '/controller/game') return { name: 'lobby' };
  const m = p.match(/^\/controller\/game\/([a-z0-9-]+)$/);
  if (m) return { name: 'play', game: m[1] };
  return { name: 'unknown' };
}

export function navigate(path, replace) {
  if (location.pathname === path) { render(); return; }
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  render();
}

export function render() {
  const r = currentRoute();
  if (!S.joined) {
    if (r.name !== 'login') { navigate('/controller', true); return; }
    return showJoin();
  }
  if (r.name === 'login' || r.name === 'unknown') { navigate('/controller/game', true); return; }
  if (r.name === 'lobby') return renderLobby();
  if (!GAMES.some((g) => g.id === r.game)) { navigate('/controller/game', true); return; }
  return renderControls();
}

export function syncRoute() {
  if (!S.joined || !S.state) return;
  const r = currentRoute();
  if (r.name === 'login') return navigate('/controller/game', true);
  if (S.state.game === 'lobby') {
    if (r.name !== 'lobby') return navigate('/controller/game', true);
    return renderLobby();
  }
  const target = `/controller/game/${S.state.game}`;
  if (r.name === 'play' && r.game === S.state.game) return renderControls();
  return navigate(target, true);
}

export function hideOverlays() {
  for (const id of ['end-modal', 'rematch-modal']) {
    const m = document.getElementById(id);
    if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
  }
}

export function showJoin() {
  hideOverlays();
  UI.gameScreen.classList.add('hidden');
  UI.gameScreen.classList.remove('flex');
  UI.lobbyScreen.classList.add('hidden');
  UI.lobbyScreen.classList.remove('flex');
  UI.joinScreen.classList.remove('hidden');
}

export function showLobby() {
  hideOverlays();
  UI.joinScreen.classList.add('hidden');
  UI.gameScreen.classList.add('hidden');
  UI.gameScreen.classList.remove('flex');
  UI.lobbyScreen.classList.remove('hidden');
  UI.lobbyScreen.classList.add('flex');
  document.getElementById('lobby-room').textContent = S.myRoom || '';
}

export function showPlay() {
  hideOverlays();
  UI.joinScreen.classList.add('hidden');
  UI.lobbyScreen.classList.add('hidden');
  UI.lobbyScreen.classList.remove('flex');
  UI.gameScreen.classList.remove('hidden');
  UI.gameScreen.classList.add('flex');
  document.getElementById('room-label').textContent = S.myRoom;
  document.getElementById('name-label').textContent = sessionStorage.getItem('tvgames-player-name') || '';
}

export function initRouter() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-nav]');
    if (!a) return;
    e.preventDefault();
    navigate(a.dataset.nav);
  });
  window.addEventListener('popstate', render);
}

export function deadRoom(message) {
  sessionStorage.removeItem('tvgames-player-id');
  sessionStorage.removeItem('tvgames-room');
  sessionStorage.setItem('tvgames-join-error', message);
  backToJoin(message);
}

export function checkBoot(msg) {
  if (!msg.boot) return false;
  const prev = sessionStorage.getItem('tvgames-boot');
  if (!prev) {
    sessionStorage.setItem('tvgames-boot', msg.boot);
    return false;
  }
  if (prev !== msg.boot) {
    sessionStorage.setItem('tvgames-boot', msg.boot);
    sessionStorage.removeItem('tvgames-player-id');
    sessionStorage.removeItem('tvgames-room');
    location.reload();
    return true;
  }
  return false;
}

export function backToJoin(message) {
  S.joined = false;
  S.state = null;
  S.rematchOffer = null;
  S.myId = null;
  S.myRoom = null;
  S.storedRoom = '';
  sessionStorage.removeItem('tvgames-player-id');
  sessionStorage.removeItem('tvgames-room');
  UI.roomInput.value = '';
  UI.gameScreen.classList.add('hidden');
  UI.gameScreen.classList.remove('flex');
  UI.joinScreen.classList.remove('hidden');
  if (message) {
    showJoinError(message);
  }
  navigate('/controller', true);
  if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify({ type: 'list-rooms' }));
  else renderRooms();
}
