const { BAT_SIZE, BAT_FLEET, shuffled, firstTurn } = require('./helpers');
const { freshBataille } = require('../registry');

function bataillePlace() {
  const cells = [];
  const fleets = [];
  const taken = new Set();
  for (const len of BAT_FLEET) {
    for (let tries = 0; tries < 200; tries++) {
      const horiz = Math.random() < 0.5;
      const r = Math.floor(Math.random() * (horiz ? BAT_SIZE : BAT_SIZE - len + 1));
      const c = Math.floor(Math.random() * (horiz ? BAT_SIZE - len + 1 : BAT_SIZE));
      const cur = Array.from({ length: len }, (_, i) => (horiz ? r * BAT_SIZE + c + i : (r + i) * BAT_SIZE + c));
      if (cur.every((x) => !taken.has(x))) { cur.forEach((x) => taken.add(x)); cells.push(...cur); fleets.push(cur); break; }
    }
  }
  return { cells, fleets };
}

function batailleShips(room, id) {
  room.bataille.ships[id] = room.bataille.ships[id] || [];
  room.bataille.fleets[id] = room.bataille.fleets[id] || [];
  if (!room.bataille.ships[id].length) {
    const auto = bataillePlace();
    room.bataille.ships[id] = auto.cells;
    room.bataille.fleets[id] = auto.fleets;
  }
  room.bataille.shots[id] = room.bataille.shots[id] || {};
  return room.bataille.ships[id];
}

function bataillePlaceManual(room, playerId, cells) {
  room.bataille = room.bataille || freshBataille();
  const b = room.bataille;
  b.ships = b.ships || {};
  b.fleets = b.fleets || {};
  b.shots = b.shots || {};
  const { red, yellow } = contestants(room);
  if (room.game !== 'bataille' || room.started || (playerId !== red && playerId !== yellow)) return 'refused';
  if (!Array.isArray(cells)) return 'invalid';
  if (!cells.length) {
    b.ships[playerId] = [];
    b.fleets[playerId] = [];
    b.shots[playerId] = {};
    return 'ok';
  }
  const N = BAT_SIZE * BAT_SIZE;
  const set = new Set(cells);
  if (set.size !== 16 || cells.some((x) => !Number.isInteger(x) || x < 0 || x >= N)) return 'invalid';
  const seen = new Set();
  const groups = [];
  for (const x of set) {
    if (seen.has(x)) continue;
    const q = [x];
    seen.add(x);
    const g = [];
    while (q.length) {
      const c = q.pop();
      g.push(c);
      const r = Math.floor(c / BAT_SIZE), col = c % BAT_SIZE;
      [[r - 1, col], [r + 1, col], [r, col - 1], [r, col + 1]].forEach(([rr, cc]) => {
        if (rr < 0 || cc < 0 || rr >= BAT_SIZE || cc >= BAT_SIZE) return;
        const n = rr * BAT_SIZE + cc;
        if (set.has(n) && !seen.has(n)) { seen.add(n); q.push(n); }
      });
    }
    groups.push(g);
  }
  const sizes = groups.map((g) => g.length).sort((a, b2) => a - b2);
  if (sizes.join(',') !== [...BAT_FLEET].sort((a, b2) => a - b2).join(',')) return 'invalid';
  for (const g of groups) {
    const rows = g.map((x) => Math.floor(x / BAT_SIZE)), cols = g.map((x) => x % BAT_SIZE);
    const sameRow = rows.every((r) => r === rows[0]), sameCol = cols.every((c) => c === cols[0]);
    if (!sameRow && !sameCol) return 'invalid';
    const line = (sameRow ? cols : rows).slice().sort((a, b2) => a - b2);
    if (!line.every((v, i) => i === 0 || v === line[i - 1] + 1)) return 'invalid';
  }
  b.ships[playerId] = [...set];
  b.fleets[playerId] = groups;
  b.shots[playerId] = {};
  return 'ok';
}

function batailleFire(room, playerId, idx) {
  room.bataille = room.bataille || freshBataille();
  const b = room.bataille;
  b.ships = b.ships || {};
  b.fleets = b.fleets || {};
  b.shots = b.shots || {};
  const { red, yellow } = contestants(room);
  if (room.game !== 'bataille' || !room.started || !red || !yellow || b.winnerId) return { accepted: false };
  idx = Number(idx);
  if (!Number.isInteger(idx) || idx < 0 || idx >= BAT_SIZE * BAT_SIZE) return { accepted: false };
  if (playerId !== red && playerId !== yellow) return { accepted: false };
  if (!b.turn) b.turn = firstTurn(room, red, yellow);
  if (b.turn !== playerId) return { accepted: false };
  const foe = playerId === red ? yellow : red;
  batailleShips(room, foe);
  b.shots[playerId] = b.shots[playerId] || {};
  if (idx in b.shots[playerId]) return { accepted: false };
  const hit = b.ships[foe].includes(idx);
  b.shots[playerId][idx] = hit ? 'hit' : 'miss';
  if (hit && b.ships[foe].every((x) => b.shots[playerId][x] === 'hit')) {
    b.winnerId = playerId;
    room.lastLoser = room.lastLoser || {};
    room.lastLoser[room.game] = foe;
  } else if (!hit) {
    b.turn = foe;
  }
  return { accepted: true };
}

function contestants(room) {
  const ids = [...room.players.keys()];
  return { red: ids[0] || null, yellow: ids[1] || null };
}

module.exports = { bataillePlace, batailleShips, bataillePlaceManual, batailleFire, contestants };