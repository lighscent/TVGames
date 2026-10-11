const { TTT_LINES, firstTurn } = require('./helpers');
const { freshTictactoe } = require('../registry');

function tictactoePlay(room, playerId, idx) {
  room.tictactoe = room.tictactoe || freshTictactoe();
  const t = room.tictactoe;
  const { red, yellow } = contestants(room);
  if (room.game !== 'tictactoe' || !room.started || !red || !yellow || t.winnerId || t.isDraw) return { accepted: false };
  idx = Number(idx);
  if (!Number.isInteger(idx) || idx < 0 || idx > 8 || t.grid[idx]) return { accepted: false };
  if (playerId !== red && playerId !== yellow) return { accepted: false };
  if (!t.turn) t.turn = firstTurn(room, red, yellow);
  if (t.turn !== playerId) return { accepted: false };
  t.grid[idx] = playerId;
  const line = TTT_LINES.find(([a, b, c]) => t.grid[a] && t.grid[a] === t.grid[b] && t.grid[a] === t.grid[c]);
  if (line) {
    t.winnerId = playerId;
    t.winCells = line;
    room.lastLoser = room.lastLoser || {};
    room.lastLoser[room.game] = playerId === red ? yellow : red;
  } else if (t.grid.every(Boolean)) {
    t.isDraw = true;
    if (room.lastLoser) delete room.lastLoser[room.game];
  } else {
    t.turn = playerId === red ? yellow : red;
  }
  return { accepted: true };
}

function contestants(room) {
  const ids = [...room.players.keys()];
  return { red: ids[0] || null, yellow: ids[1] || null };
}

module.exports = { tictactoePlay, contestants };