require('dotenv').config();
const express = require('express');
const compression = require('compression');
const http = require('http');
const path = require('path');
const log = require('./lib/logger');

const { GAMES } = require('./lib/games');
const { setupWebSocket } = require('./lib/ws');
const db = require('./lib/db');

const app = express();
const PORT = process.env.PORT || 4444;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));
const faDir = path.join(__dirname, 'node_modules/@fortawesome/fontawesome-free');
const faCache = { maxAge: '1y', immutable: true };
app.use('/fa/css', express.static(path.join(faDir, 'css'), faCache));
app.use('/fa/webfonts', express.static(path.join(faDir, 'webfonts'), faCache));
app.use((req, res, next) => {
  const t = Date.now();
  res.on('finish', () => log.debug(`HTTP ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - t}ms)`));
  next();
});
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
  let scores = { global: [], byGame: {} };
  try { scores = db.getScores(); } catch (e) { log.error(e); }
  res.render('index', { title: 'TVGames', games: GAMES, scores });
});

app.get('/tv', (req, res) => {
  res.render('tv', { title: 'TVGames · TV', room: '', joinUrl: '', qrDataUrl: '', games: GAMES });
});

function renderController(title) {
  return (req, res) => {
    res.render('controller', {
      title,
      room: String(req.query.room || '').toUpperCase().slice(0, 8),
      games: GAMES,
    });
  };
}

app.get('/controller', renderController('Controller'));
app.get('/controller/game', renderController('Salon · TVGames'));
app.get('/controller/game/:gamename', renderController('Jeu · TVGames'));

app.get('/api/games', (req, res) => res.json(GAMES));
app.get('/api/scores', (req, res) => {
  try { res.json(db.getScores()); }
  catch (e) { log.error(e); res.status(500).json({ error: 'scores indisponibles' }); }
});
app.get('/api/duel', (req, res) => {
  try { res.json(db.getDuel(String(req.query.game || ''), String(req.query.a || ''), String(req.query.b || ''))); }
  catch (e) { log.error(e); res.status(500).json({ w1: 0, w2: 0, draws: 0 }); }
});
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const server = http.createServer(app);
const wss = setupWebSocket(server);

let closing = false;
function shutdown(signal) {
  if (closing) return;
  closing = true;
  log.info(`Arret (${signal})`);
  try {
    for (const ws of wss.clients) ws.close(1001, 'shutdown');
  } catch (e) { log.error(e); }
  server.close(() => {
    try { db.close(); } catch (e) { log.error(e); }
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

server.listen(PORT, () => {
  log.info(`Server running on http://localhost:${PORT}`);
  log.info(`TV: http://localhost:${PORT}/tv`);
  log.debug(`boot=${require('./lib/ws').BOOT_ID} games=${GAMES.map((g) => g.id).join(',')}`);
});
