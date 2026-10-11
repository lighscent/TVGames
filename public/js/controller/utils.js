import { S, UI } from './state.js';
import { render } from './router.js';

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function playerNameOf(id) {
  return (S.state?.players || []).find((p) => p.id === id)?.name || '?';
}

export function setStatus(text, color) {
  UI.statusEl.textContent = text;
  UI.dotEl.className = `mr-1 inline-block h-2 w-2 rounded-full ${color}`;
}

export function setLastError(msg) {
  S.lastError = msg;
  clearTimeout(S.lastErrT);
  if (msg) S.lastErrT = setTimeout(() => { S.lastError = null; render(); }, 5000);
}

export function showJoinError(msg) {
  UI.joinError.textContent = msg;
  UI.joinError.classList.remove('hidden');
  clearTimeout(S.joinErrT);
  S.joinErrT = setTimeout(() => UI.joinError.classList.add('hidden'), 5000);
}
