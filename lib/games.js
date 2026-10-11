const GAMES = [
  { id: 'lobby', name: 'Lobby', icon: 'fa-solid fa-gamepad', description: 'Salle d’attente, connexion des joueurs.' },
  { id: 'puissance4', name: 'Puissance 4', icon: 'fa-solid fa-circle', description: 'Aligne 4 jetons, les 2 premiers joueurs s’affrontent.', players: '2 joueurs' },
];

function isValidGame(id) {
  return GAMES.some((g) => g.id === id);
}

function getGame(id) {
  return GAMES.find((g) => g.id === id) || null;
}

module.exports = { GAMES, isValidGame, getGame };
