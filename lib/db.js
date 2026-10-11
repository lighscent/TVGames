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

const findByIdStmt = db.prepare('SELECT id, name FROM players WHERE id = ?');
const findByNameStmt = db.prepare('SELECT id FROM players WHERE name = ? COLLATE NOCASE');

// Un pseudo = un joueur : les doublons existants sont fusionnés (plus vieux gardé,
// matchs re-pointés), puis l'unicité est garantie par index.
try {
  const dupes = db.prepare(`SELECT MIN(name) AS name FROM players WHERE name != 'Joueur' GROUP BY name COLLATE NOCASE HAVING COUNT(*) > 1`).all();
  const idsFor = db.prepare('SELECT id FROM players WHERE name = ? COLLATE NOCASE ORDER BY rowid');
  const repoint = (col) => db.prepare(`UPDATE matches SET ${col} = ? WHERE ${col} = ?`);
  for (const d of dupes) {
    const ids = idsFor.all(d.name).map((r) => r.id);
    const keep = ids.shift();
    for (const old of ids) {
      for (const col of ['player1_id', 'player2_id', 'winner_id']) repoint(col).run(keep, old);
      db.prepare('DELETE FROM players WHERE id = ?').run(old);
    }
    if (ids.length) log.info(`DB merged ${ids.length} duplicate(s) of "${d.name}"`);
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_players_name ON players(name COLLATE NOCASE) WHERE name != 'Joueur'`);
} catch (e) {
  log.warn(`DB dedup skipped: ${e.message}`);
}

function canonId(id) {
  if (!id) return null;
  if (id2canon.has(id)) return id2canon.get(id);
  const row = findByIdStmt.get(id);
  if (!row || row.name === 'Joueur') return id;
  return (findByNameStmt.get(row.name) || {}).id || id;
}

const id2canon = new Map(); // id de session -> id canonique (jamais stocké sinon)

function repointMatches(from, to) {
  for (const col of ['player1_id', 'player2_id', 'winner_id']) {
    db.prepare(`UPDATE matches SET ${col} = ? WHERE ${col} = ?`).run(to, from);
  }
}

const insertPlayerStmt = db.prepare('INSERT INTO players (id, name, last_seen) VALUES (?, ?, ?)');
const touchPlayerStmt = db.prepare('UPDATE players SET name = ?, last_seen = ? WHERE id = ?');

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
  name = String(name || 'Joueur').slice(0, 20);
  const row = findByIdStmt.get(id);
  if (name === 'Joueur') {
    // Pseudo par défaut : pas d'identité fiable, une ligne par session.
    if (row) touchPlayerStmt.run(name, Date.now(), id);
    else insertPlayerStmt.run(id, name, Date.now());
    id2canon.set(id, id);
  } else {
    const target = findByNameStmt.get(name);
    if (target) {
      if (row && row.id !== target.id) {
        repointMatches(row.id, target.id);
        db.prepare('DELETE FROM players WHERE id = ?').run(row.id);
      }
      touchPlayerStmt.run(name, Date.now(), target.id);
      id2canon.set(id, target.id);
    } else if (row) {
      touchPlayerStmt.run(name, Date.now(), row.id); // rename
      id2canon.set(id, row.id);
    } else {
      insertPlayerStmt.run(id, name, Date.now());
      id2canon.set(id, id);
    }
  }
  log.debug(`DB upsert player ${id} (${name})`);
}

function recordMatch({ game, player1Id, player2Id, winnerId, isDraw, room }) {
  recordMatchStmt.run(game, canonId(player1Id), canonId(player2Id), canonId(winnerId), isDraw ? 1 : 0, room || null, Date.now());
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

const duelAllStmt = db.prepare(`
  SELECT
    SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) AS w1,
    SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) AS w2,
    SUM(CASE WHEN is_draw = 1 THEN 1 ELSE 0 END) AS draws
  FROM matches
  WHERE (player1_id = ? AND player2_id = ?) OR (player1_id = ? AND player2_id = ?)
`);

function getDuel(game, id1, id2) {
  if (!id1 || !id2) return { w1: 0, w2: 0, draws: 0 };
  id1 = canonId(id1); id2 = canonId(id2);
  const all = !game || game === 'all';
  const r = all
    ? duelAllStmt.get(id1, id2, id1, id2, id2, id1)
    : duelStmt.get(id1, id2, game, id1, id2, id2, id1);
  log.debug(`DB duel game=${all ? 'all' : game} ${id1}/${id2} -> ${r.w1 || 0}-${r.w2 || 0} (${r.draws || 0} nuls)`);
  return { w1: r.w1 || 0, w2: r.w2 || 0, draws: r.draws || 0 };
}

module.exports = { upsertPlayer, recordMatch, getScores, getDuel, close: () => db.close() };
