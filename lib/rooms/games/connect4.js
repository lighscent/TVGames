const { checkWin, firstTurn } = require('../games/helpers');
const { freshBoard } = require('../registry');

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
  } else if (c4.grid.flat().every(Boolean)) {
    c4.isDraw = true;
    if (room.lastLoser) delete room.lastLoser[room.game];
  } else {
    c4.turn = playerId === red ? yellow : red;
  }
  return { accepted: true };
}

function contestants(room) {
  const ids = [...room.players.keys()];
  return { red: ids[0] || null, yellow: ids[1] || null };
}

module.exports = { dropToken, contestants };