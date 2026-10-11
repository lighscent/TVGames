const { room: prefilledRoom, games, boot: serverBoot } = window.__CTRL_INIT__;

export const GAMES = games;
export const PREFILLED_ROOM = prefilledRoom;

if (serverBoot && !sessionStorage.getItem('tvgames-boot')) sessionStorage.setItem('tvgames-boot', serverBoot);

export const PALETTE = [
  { id: 'red', name: 'Rouge', bg: 'bg-red-500' },
  { id: 'yellow', name: 'Jaune', bg: 'bg-yellow-400' },
  { id: 'blue', name: 'Bleu', bg: 'bg-blue-500' },
  { id: 'green', name: 'Vert', bg: 'bg-green-500' },
  { id: 'purple', name: 'Violet', bg: 'bg-purple-500' },
  { id: 'orange', name: 'Orange', bg: 'bg-orange-500' },
  { id: 'pink', name: 'Rose', bg: 'bg-pink-500' },
  { id: 'cyan', name: 'Cyan', bg: 'bg-cyan-400' },
  { id: 'lime', name: 'Citron', bg: 'bg-lime-400' },
  { id: 'teal', name: 'Turquoise', bg: 'bg-teal-400' },
  { id: 'indigo', name: 'Indigo', bg: 'bg-indigo-500' },
  { id: 'brown', name: 'Marron', bg: 'bg-amber-800' },
];

export const SYMBOLS = [
  { id: 'x', glyph: 'X', icon: 'fa-solid fa-xmark', name: 'Croix' },
  { id: 'o', glyph: 'O', icon: 'fa-solid fa-o', name: 'Rond' },
  { id: 'star', glyph: '★', icon: 'fa-solid fa-star', name: 'Étoile' },
  { id: 'heart', glyph: '♥', icon: 'fa-solid fa-heart', name: 'Cœur' },
  { id: 'tri', glyph: '▲', icon: 'fa-solid fa-play', name: 'Triangle' },
  { id: 'dot', glyph: '●', icon: 'fa-solid fa-circle', name: 'Point' },
  { id: 'moon', glyph: '☾', icon: 'fa-solid fa-moon', name: 'Lune' },
  { id: 'bolt', glyph: '⚡', icon: 'fa-solid fa-bolt', name: 'Éclair' },
  { id: 'diamond', glyph: '◆', icon: 'fa-solid fa-diamond', name: 'Carreau' },
];

export const S = {
  ws: null,
  state: null,
  joined: false,
  myId: sessionStorage.getItem('tvgames-player-id') || null,
  myRoom: null,
  myName: sessionStorage.getItem('tvgames-player-name') || '',
  storedRoom: sessionStorage.getItem('tvgames-room') || '',
  tvsIdle: [],
  openRooms: [],
  pendingCol: null,
  prevGridM: null,
  duelCache: { key: null, data: null },
  rematchOffer: null,
  catalogCache: null,
  lastError: null,
  lastErrT: null,
  joinErrT: null,
};

export const UI = {
  joinScreen: document.getElementById('join-screen'),
  lobbyScreen: document.getElementById('lobby-screen'),
  gameScreen: document.getElementById('game-screen'),
  nameInput: document.getElementById('input-name'),
  roomInput: document.getElementById('input-room'),
  joinBtn: document.getElementById('btn-join'),
  createBtn: document.getElementById('btn-create'),
  joinError: document.getElementById('join-error'),
  statusEl: document.getElementById('ws-status'),
  dotEl: document.getElementById('ws-dot'),
  controlsEl: document.getElementById('controls'),
  gameLabel: document.getElementById('game-label'),
};
