const {
  TTT_LINES,
  MEMO_SYMBOLS,
  UNO_COLORS,
  BAT_SIZE,
  BAT_FLEET,
  shuffled,
} = require('../constants');

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

module.exports = { checkWin, firstTurn, TTT_LINES, MEMO_SYMBOLS, UNO_COLORS, BAT_SIZE, BAT_FLEET, shuffled };