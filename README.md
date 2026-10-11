# TVGames

Jeux multi-joueurs : la partie s'affiche sur une **TV**, les joueurs jouent depuis leur **mobile** (temps réel via WebSocket). Pour l'instant : Puissance 4.

## Démarrer

```bash
npm install
npm run dev
```

- TV : http://localhost:4444/tv
- Mobile : http://localhost:4444/controller
- Config : copier `.env.example` vers `.env` (`PORT`, `PUBLIC_URL` = IP LAN pour que les mobiles rejoignent via QR, `LOG_LEVEL`, `DB_PATH`)

## Une partie, en bref

1. Sur mobile : **Créer un salon**, puis choisir la TV dans la liste.
2. La TV affiche un **QR + un code** : le joueur 2 scanne ou tape le code (ou choisit le salon dans « Salons détectés »).
3. Le gérant (couronne, = premier arrivé) choisit le jeu, chacun choisit sa couleur et se dit prêt, le gérant lance.
4. Fin de partie : modale gagné/perdu avec le score du face-à-face, boutons Rejouer (avec proposition à l'adversaire) et Menu.
5. Les scores sont sauvegardés en SQLite et visibles sur la page d'accueil (`/`).
