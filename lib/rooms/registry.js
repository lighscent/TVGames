const { generateRoomCode } = require('./code');
const log = require('../logger');

const rooms = new Map();

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
    picks: {},
    lastLoser: {},
    connect4: freshBoard(),
    tictactoe: freshTictactoe(),
    memory: freshMemory(),
    bataille: freshBataille(),
    uno: freshUno(),
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

function freshBoard() {
  return {
    grid: Array.from({ length: 6 }, () => Array(7).fill(null)),
    turn: null,
    winnerId: null,
    isDraw: false,
    winCells: [],
  };
}

function freshTictactoe() {
  return { grid: Array(9).fill(null), turn: null, winnerId: null, isDraw: false, winCells: [] };
}

function freshMemory() {
  return { deck: [], flipped: [], shown: [], shownId: 0, matched: Array(16).fill(null), scores: {}, turn: null, winnerId: null, isDraw: false };
}

function freshBataille() {
  return { ships: {}, fleets: {}, shots: {}, turn: null, winnerId: null };
}

function freshUno() {
  return { hands: {}, deck: [], pile: [], color: null, turn: null, pendingWild: null, winnerId: null };
}

module.exports = {
  rooms,
  createRoom,
  deleteRoom,
  getRoom,
  freshBoard,
  freshTictactoe,
  freshMemory,
  freshBataille,
  freshUno,
};