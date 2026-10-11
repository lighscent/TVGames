const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const log = require('./logger');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'tvgames.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Joueur',
  last_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game TEXT NOT NULL,
  player1_id TEXT,
  player2_id TEXT,
  winner_id TEXT,
  is_draw INTEGER NOT NULL DEFAULT 0,
  room TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_matches_game ON matches(game);
CREATE INDEX IF NOT EXISTS idx_matches_winner ON matches(winner_id);
`);

const upsertPlayerStmt = db.prepare(`
INSERT INTO players (id, name, last_seen) VALUES (?, ?, ?)
ON CONFLICT(id) DO UPDATE SET name = excluded.name, last_seen = excluded.last_seen
`);

const recordMatchStmt = db.prepare(`
INSERT INTO matches (game, player1_id, player2_id, winner_id, is_draw, room, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?)
`);

function statsFor(game) {
  const rows = db.prepare(`
    SELECT p.id, p.name,
      (SELECT COUNT(*) FROM matches m WHERE m.winner_id = p.id ${game ? 'AND m.game = ?' : ''}) AS wins,
      (SELECT COUNT(*) FROM matches m WHERE m.is_draw = 0 AND m.winner_id IS NOT NULL AND m.winner_id != p.id
        AND (m.player1_id = p.id OR m.player2_id = p.id) ${game ? 'AND m.game = ?' : ''}) AS losses,
      (SELECT COUNT(*) FROM matches m WHERE m.is_draw = 1 AND (m.player1_id = p.id OR m.player2_id = p.id)
        ${game ? 'AND m.game = ?' : ''}) AS draws
    FROM players p
    ORDER BY wins DESC, draws DESC, losses ASC
    LIMIT 50
  `).all(...(game ? [game, game, game] : []));
  return rows.filter((r) => r.wins + r.losses + r.draws > 0);
}

function upsertPlayer(id, name) {
  if (!id) return;
  upsertPlayerStmt.run(id, String(name || 'Joueur').slice(0, 20), Date.now());
  log.debug(`DB upsert player ${id} (${name})`);
}

function recordMatch({ game, player1Id, player2Id, winnerId, isDraw, room }) {
  recordMatchStmt.run(game, player1Id || null, player2Id || null, winnerId || null, isDraw ? 1 : 0, room || null, Date.now());
  log.info(`Match saved game=${game} winner=${winnerId || 'draw'} room=${room || '?'}`);
}

function getScores() {
  const games = db.prepare('SELECT DISTINCT game FROM matches ORDER BY game').all().map((r) => r.game);
  const byGame = {};
  for (const g of games) byGame[g] = statsFor(g);
  return { global: statsFor(null), byGame };
}

const duelStmt = db.prepare(`
  SELECT
    SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) AS w1,
    SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) AS w2,
    SUM(CASE WHEN is_draw = 1 THEN 1 ELSE 0 END) AS draws
  FROM matches
  WHERE game = ?
    AND ((player1_id = ? AND player2_id = ?) OR (player1_id = ? AND player2_id = ?))
`);

function getDuel(game, id1, id2) {
  if (!game || !id1 || !id2) return { w1: 0, w2: 0, draws: 0 };
  const r = duelStmt.get(id1, id2, game, id1, id2, id2, id1);
  log.debug(`DB duel game=${game} ${id1}/${id2} -> ${r.w1 || 0}-${r.w2 || 0} (${r.draws || 0} nuls)`);
  return { w1: r.w1 || 0, w2: r.w2 || 0, draws: r.draws || 0 };
}

module.exports = { upsertPlayer, recordMatch, getScores, getDuel, close: () => db.close() };
