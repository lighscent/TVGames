const { isValidGame } = require('./games');
const log = require('./logger');

const COLORS = [
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

function bgOfColor(colorId) {
  return (COLORS.find((c) => c.id === colorId) || {}).bg || 'bg-zinc-500';
}

const rooms = new Map();
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function createRoom() {
  const code = generateRoomCode();
  const room = {
    code,
    game: 'lobby',
    players: new Map(),
    hostId: null,
    creatorId: null,
    tvId: null,
    ready: {},
    started: false,
    lastLoser: {},
    connect4: freshBoard(),
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  log.debug(`Room ${code} created`);
  return room;
}

function deleteRoom(code) {
  code = (code || '').toUpperCase().trim();
  if (rooms.delete(code)) log.debug(`Room ${code} deleted`);
}

function getRoom(code) {
  return rooms.get((code || '').toUpperCase().trim()) || null;
}

function resetRound(room) {
  room.connect4 = freshBoard();
  room.started = false;
  log.debug(`Room ${room.code} round reset (ready kept)`);
}

function freshBoard() {
  return {
    grid: Array.from({ length: 6 }, () => Array(7).fill(null)),
    turn: null,
    winnerId: null,
    isDraw: false,
    winCells: [],
  };
}

function contestants(room) {
  const ids = [...room.players.keys()];
  return { red: ids[0] || null, yellow: ids[1] || null };
}

function checkWin(grid, row, col, id) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    const cells = [[row, col]];
    for (const s of [1, -1]) {
      let r = row + dr * s;
      let c = col + dc * s;
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && grid[r][c] === id) {
        cells.push([r, c]);
        r += dr * s;
        c += dc * s;
      }
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}

function firstTurn(room, red, yellow) {
  const ll = (room.lastLoser || {})[room.game];
  if (ll === red || ll === yellow) return ll;
  return Math.random() < 0.5 ? red : yellow;
}

function dropToken(room, playerId, col) {
  room.connect4 = room.connect4 || freshBoard();
  const c4 = room.connect4;
  const { red, yellow } = contestants(room);
  if (!room.started || !red || !yellow || c4.winnerId || c4.isDraw) return { accepted: false };
  col = Number(col);
  if (!Number.isInteger(col) || col < 0 || col > 6) return { accepted: false };
  if (playerId !== red && playerId !== yellow) return { accepted: false };
  if (!c4.turn) c4.turn = firstTurn(room, red, yellow);
  if (c4.turn !== playerId) return { accepted: false };
  let row = -1;
  for (let r = 5; r >= 0; r--) {
    if (!c4.grid[r][col]) { row = r; break; }
  }
  if (row === -1) return { accepted: false };
  c4.grid[row][col] = playerId;
  const win = checkWin(c4.grid, row, col, playerId);
  if (win) {
    c4.winnerId = playerId;
    c4.winCells = win;
    room.lastLoser = room.lastLoser || {};
    room.lastLoser[room.game] = playerId === red ? yellow : red;
    log.debug(`Room ${room.code} winner=${playerId} loser starts next`);
  } else if (c4.grid.flat().every(Boolean)) {
    c4.isDraw = true;
    if (room.lastLoser) delete room.lastLoser[room.game];
    log.debug(`Room ${room.code} draw`);
  } else {
    c4.turn = playerId === red ? yellow : red;
  }
  return { accepted: true };
}

function setGame(room, gameId) {
  if (!isValidGame(gameId)) return false;
  room.game = gameId;
  room.ready = {};
  room.started = false;
  resetRound(room);
  log.debug(`Room ${room.code} game=${gameId} (ready+started reset)`);
  return true;
}

function setReady(room, id, ready) {
  if (!room.players.has(id)) return false;
  if (ready) room.ready[id] = true;
  else delete room.ready[id];
  return true;
}

function tryStart(room) {
  if (room.started) return 'already';
  if (room.game === 'puissance4') {
    const ids = [...room.players.keys()];
    const [red, yellow] = ids;
    if (!red || !yellow) return 'wait-opponent';
    if (!room.ready[red] || !room.ready[yellow]) return 'not-ready';
    room.started = true;
    room.connect4 = room.connect4 || freshBoard();
    if (!room.connect4.turn) room.connect4.turn = firstTurn(room, red, yellow);
    log.debug(`Room ${room.code} started, turn=${room.connect4.turn}`);
    return 'ok';
  }
  room.started = true;
  return 'ok';
}

function addPlayer(room, id, name) {
  const used = new Set([...room.players.values()].map((p) => p.color));
  const color = COLORS.map((c) => c.id).find((c) => !used.has(c)) || 'red';
  room.players.set(id, { id, name: String(name || 'Joueur').slice(0, 20), color });
  if (!room.hostId) room.hostId = id;
  if (room.creatorId && id === room.creatorId) room.hostId = id;
  log.debug(`Room ${room.code} +player ${name} color=${color} host=${room.hostId === id}`);
}

function setPlayerColor(room, id, colorId) {
  if (!COLORS.some((c) => c.id === colorId)) return 'unknown';
  const player = room.players.get(id);
  if (!player) return 'unknown-player';
  const taken = [...room.players.values()].some((p) => p.id !== id && p.color === colorId);
  if (taken) return 'taken';
  player.color = colorId;
  if (!room.started) delete room.ready[id];
  log.debug(`Room ${room.code} ${id} color -> ${colorId}`);
  return 'ok';
}

function removePlayer(room, id) {
  const wasHost = room.hostId === id;
  room.players.delete(id);
  delete room.ready[id];
  if (room.game === 'puissance4') {
    room.connect4 = freshBoard();
    room.started = false;
  }
  if (wasHost) {
    room.hostId = room.players.keys().next().value || null;
    log.debug(`Room ${room.code} -player ${id}, host -> ${room.hostId}`);
  } else {
    log.debug(`Room ${room.code} -player ${id}`);
  }
}

function handleInput(room, playerId, action, col) {
  if (action === 'drop' && room.game === 'puissance4') {
    return dropToken(room, playerId, col);
  }
  return { accepted: false };
}

function state(room) {
  return {
    room: room.code,
    game: room.game,
    hostId: room.hostId,
    creatorId: room.creatorId || null,
    ready: { ...(room.ready || {}) },
    started: !!room.started,
    players: [...room.players.values()].map((p) => ({ ...p, bg: bgOfColor(p.color) })),
    connect4: {
      grid: (room.connect4 || freshBoard()).grid,
      turn: (room.connect4 || {}).turn || null,
      winnerId: (room.connect4 || {}).winnerId || null,
      isDraw: !!(room.connect4 || {}).isDraw,
      winCells: (room.connect4 || {}).winCells || [],
      red: [...room.players.keys()][0] || null,
      yellow: [...room.players.keys()][1] || null,
      colorBg: Object.fromEntries(
        [...room.players.keys()].slice(0, 2).map((id) => [id, bgOfColor((room.players.get(id) || {}).color)])
      ),
    },
  };
}

module.exports = {
  rooms,
  generateRoomCode,
  createRoom,
  deleteRoom,
  getRoom,
  setGame,
  resetRound,
  addPlayer,
  removePlayer,
  setPlayerColor,
  setReady,
  tryStart,
  handleInput,
  state,
  COLORS,
};
