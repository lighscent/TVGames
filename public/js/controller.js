(() => {
  const { room: prefilledRoom, games } = window.__CTRL_INIT__;
  const PALETTE = [
    { id: 'red', name: 'Rouge', bg: 'bg-red-500' },
    { id: 'yellow', name: 'Jaune', bg: 'bg-yellow-400' },
    { id: 'blue', name: 'Bleu', bg: 'bg-blue-500' },
    { id: 'green', name: 'Vert', bg: 'bg-green-500' },
    { id: 'purple', name: 'Violet', bg: 'bg-purple-500' },
    { id: 'orange', name: 'Orange', bg: 'bg-orange-500' },
    { id: 'pink', name: 'Rose', bg: 'bg-pink-500' },
    { id: 'cyan', name: 'Cyan', bg: 'bg-cyan-400' },
    { id: 'lime', name: 'Citron', bg: 'bg-lime-400' },
    { id: 'teal', name: 'Turquoise', bg: 'bg-teal-400' },
    { id: 'indigo', name: 'Indigo', bg: 'bg-indigo-500' },
    { id: 'brown', name: 'Marron', bg: 'bg-amber-800' },
  ];
  let lastError = null;
  let lastErrT = null;
  let joinErrT = null;
  function setLastError(msg) {
    lastError = msg;
    clearTimeout(lastErrT);
    if (msg) lastErrT = setTimeout(() => { lastError = null; render(); }, 5000);
  }
  function showJoinError(msg) {
    joinError.textContent = msg;
    joinError.classList.remove('hidden');
    clearTimeout(joinErrT);
    joinErrT = setTimeout(() => joinError.classList.add('hidden'), 5000);
  }
  let tvsIdle = [];
  let openRooms = [];
  let pendingCol = null;
  let prevGridM = null;
  let duelCache = { key: null, data: null };
  let rematchOffer = null;
  const joinScreen = document.getElementById('join-screen');
  const gameScreen = document.getElementById('game-screen');
  const nameInput = document.getElementById('input-name');
  const roomInput = document.getElementById('input-room');
  const joinBtn = document.getElementById('btn-join');
  const createBtn = document.getElementById('btn-create');
  const joinError = document.getElementById('join-error');
  const statusEl = document.getElementById('ws-status');
  const dotEl = document.getElementById('ws-dot');
  const controlsEl = document.getElementById('controls');
  const gameLabel = document.getElementById('game-label');

  let ws = null;
  let state = null;
  let joined = false;
  let myId = sessionStorage.getItem('tvgames-player-id') || null;
  let myRoom = null;
  let myName = sessionStorage.getItem('tvgames-player-name') || '';
  let storedRoom = sessionStorage.getItem('tvgames-room') || '';

  if (myName) nameInput.value = myName;

  function getNames() {
    try { return JSON.parse(localStorage.getItem('tvgames-names') || '[]'); } catch { return []; }
  }
  function renderNameHistory() {
    const dl = document.getElementById('name-history');
    if (dl) dl.innerHTML = getNames().map((n) => `<option value="${escapeHtml(n)}"></option>`).join('');
  }
  function saveName(name) {
    if (!name || name === 'Joueur') return;
    const names = [name, ...getNames().filter((n) => n !== name)].slice(0, 5);
    try { localStorage.setItem('tvgames-names', JSON.stringify(names)); } catch {}
    renderNameHistory();
  }
  renderNameHistory();
  const pendingError = sessionStorage.getItem('tvgames-join-error') || '';
  if (pendingError) {
    sessionStorage.removeItem('tvgames-join-error');
    showJoinError(pendingError);
  }
  const urlRoom = new URLSearchParams(location.search).get('room');
  const initialRoom = (urlRoom || storedRoom || prefilledRoom || '').toUpperCase();
  if (initialRoom) roomInput.value = initialRoom;

  function setStatus(text, color) {
    statusEl.textContent = text;
    dotEl.className = `mr-1 inline-block h-2 w-2 rounded-full ${color}`;
  }

  function currentRoute() {
    const p = location.pathname.replace(/\/+$/, '');
    if (p === '/controller') return { name: 'login' };
    if (p === '/controller/game') return { name: 'lobby' };
    const m = p.match(/^\/controller\/game\/([a-z0-9-]+)$/);
    if (m) return { name: 'play', game: m[1] };
    return { name: 'unknown' };
  }

  function navigate(path, replace) {
    if (location.pathname === path) { render(); return; }
    if (replace) history.replaceState(null, '', path);
    else history.pushState(null, '', path);
    render();
  }

  function render() {
    const r = currentRoute();
    if (!joined) {
      if (r.name !== 'login') { navigate('/controller', true); return; }
      return showJoin();
    }
    if (r.name === 'login' || r.name === 'unknown') { navigate('/controller/game', true); return; }
    if (r.name === 'lobby') return renderLobby();
    if (!games.some((g) => g.id === r.game)) { navigate('/controller/game', true); return; }
    return renderControls();
  }

  function syncRoute() {
    if (!joined || !state) return;
    const r = currentRoute();
    if (r.name === 'login') return navigate('/controller/game', true);
    if (state.game === 'lobby') {
      if (r.name !== 'lobby') return navigate('/controller/game', true);
      return renderLobby();
    }
    const target = `/controller/game/${state.game}`;
    if (r.name === 'play' && r.game === state.game) return renderControls();
    return navigate(target, true);
  }

  function hideOverlays() {
    for (const id of ['end-modal', 'rematch-modal']) {
      const m = document.getElementById(id);
      if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
    }
  }

  function showJoin() {
    hideOverlays();
    gameScreen.classList.add('hidden');
    gameScreen.classList.remove('flex');
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('flex');
    joinScreen.classList.remove('hidden');
  }

  function showLobby() {
    hideOverlays();
    joinScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    gameScreen.classList.remove('flex');
    const lobby = document.getElementById('lobby-screen');
    lobby.classList.remove('hidden');
    lobby.classList.add('flex');
    document.getElementById('lobby-room').textContent = myRoom || '';
  }

  function showPlay() {
    hideOverlays();
    joinScreen.classList.add('hidden');
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('flex');
    gameScreen.classList.remove('hidden');
    gameScreen.classList.add('flex');
    document.getElementById('room-label').textContent = myRoom;
    document.getElementById('name-label').textContent = sessionStorage.getItem('tvgames-player-name') || '';
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-nav]');
    if (!a) return;
    e.preventDefault();
    navigate(a.dataset.nav);
  });
  window.addEventListener('popstate', render);

  function deadRoom(message) {
    sessionStorage.removeItem('tvgames-player-id');
    sessionStorage.removeItem('tvgames-room');
    sessionStorage.setItem('tvgames-join-error', message);
    backToJoin(message);
  }

  function checkBoot(msg) {
    if (msg.boot) sessionStorage.setItem('tvgames-boot', msg.boot);
    return false;
  }

  function connect() {
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    ws.onopen = () => {
      setStatus('connecté', 'bg-emerald-400');
      const roomCode = (roomInput.value.trim() || storedRoom).toUpperCase();
      if (!joined && myId && myName && roomCode) {
        ws.send(JSON.stringify({ type: 'join', role: 'player', room: roomCode, name: myName, playerId: myId }));
      } else if (!joined) {
        ws.send(JSON.stringify({ type: 'list-rooms' }));
      }
    };
    ws.onclose = () => {
      joined = false;
      setStatus('déconnecté — reconnexion…', 'bg-red-400');
      setTimeout(connect, 2000);
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'joined') {
        if (checkBoot(msg)) return;
        joined = true;
        myId = msg.playerId;
        sessionStorage.setItem('tvgames-player-id', myId);
        sessionStorage.setItem('tvgames-room', msg.room);
        myRoom = msg.room;
        state = msg;
        render();
      } else if (msg.type === 'room-state') {
        if (checkBoot(msg)) return;
        if (!msg.started || state?.connect4?.turn !== msg.connect4?.turn) pendingCol = null;
        if (!msg.started) prevGridM = null;
        state = msg;
        setLastError(null);
        syncRoute();
      } else if (msg.type === 'tv-list') {
        tvsIdle = msg.tvs || [];
        if (joined) render();
      } else if (msg.type === 'rooms-list') {
        openRooms = msg.rooms || [];
        if (!joined) renderRooms();
      } else if (msg.type === 'room-closed') {
        backToJoin(msg.reason || 'Salon fermé.');
      } else if (msg.type === 'rematch-offer') {
        rematchOffer = { room: msg.room, from: msg.from };
        if (joined) syncRoute();
      } else if (msg.type === 'rematch-declined') {
        setLastError(`${msg.by} a refusé la revanche.`);
        if (joined) render();
      } else if (msg.type === 'error') {
        if (msg.code === 'room-not-found' || msg.message === 'salon introuvable') {
          deadRoom('Salon introuvable — il a été fermé ou le code est erroné. Choisis un salon détecté ou crée le tien.');
          return;
        }
        setLastError(msg.message);
        showJoinError(msg.message);
        if (typeof render === 'function' && joined) render();
      }
    };
  }

  joinBtn.onclick = () => {
    const name = nameInput.value.trim() || 'Joueur';
    const roomCode = roomInput.value.trim().toUpperCase();
    if (!roomCode) {
      showJoinError('Entre le code du salon affiché sur la TV.');
      return;
    }
    joinError.classList.add('hidden');
    sessionStorage.setItem('tvgames-player-name', name);
    saveName(name);
    const sendJoin = () => ws.send(JSON.stringify({ type: 'join', role: 'player', room: roomCode, name, playerId: myId }));
    if (ws && ws.readyState === 1) sendJoin();
    else {
      showJoinError('Connexion au serveur… réessaie dans 1s.');
    }
  };

  createBtn.onclick = () => {
    const name = nameInput.value.trim() || 'Joueur';
    joinError.classList.add('hidden');
    sessionStorage.setItem('tvgames-player-name', name);
    saveName(name);
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'create-room', name }));
    else {
      showJoinError('Connexion au serveur… réessaie dans 1s.');
    }
  };

  function renderRooms() {
    const box = document.getElementById('rooms-list');
    if (!box) return;
    if (!openRooms.length) {
      box.innerHTML = '<p class="text-xs text-zinc-500">Aucun salon ouvert — crée le tien.</p>';
      return;
    }
    const gameName = (id) => (games.find((g) => g.id === id) || {}).name || id;
    box.innerHTML = openRooms.map((r) => `<button data-room="${r.code}" class="pick-room flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-left active:bg-sky-950">
      <span><span class="font-mono font-bold text-sky-400">${r.code}</span> <span class="text-sm font-medium">${escapeHtml(r.host)}</span>
      <span class="block text-xs text-zinc-400">${escapeHtml(gameName(r.game))} · ${r.players} joueur(s)${r.tv ? ` · <i class="fa-solid fa-tv"></i> ${escapeHtml(r.tv)}` : ' · sans TV'}</span></span>
      <i class="fa-solid fa-chevron-right text-zinc-500"></i>
    </button>`).join('');
    box.querySelectorAll('.pick-room').forEach((b) => {
      b.onclick = () => {
        roomInput.value = b.dataset.room;
        joinBtn.click();
      };
    });
  }

  document.getElementById('btn-refresh-rooms').onclick = () => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'list-rooms' }));
  };

  function backToJoin(message) {
    joined = false;
    state = null;
    rematchOffer = null;
    myId = null;
    myRoom = null;
    storedRoom = '';
    sessionStorage.removeItem('tvgames-player-id');
    sessionStorage.removeItem('tvgames-room');
    roomInput.value = '';
    gameScreen.classList.add('hidden');
    gameScreen.classList.remove('flex');
    joinScreen.classList.remove('hidden');
    if (message) {
      showJoinError(message);
    }
    navigate('/controller', true);
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'list-rooms' }));
    else renderRooms();
  }

  document.querySelectorAll('.btn-leave').forEach((b) => {
    let armed = false;
    let timer = null;
    b.onclick = () => {
      if (!armed) {
        armed = true;
        b.dataset.label = b.textContent;
        b.textContent = 'Sûr ? Re-tap pour quitter';
        b.classList.add('border-red-500', 'text-red-400');
        timer = setTimeout(() => {
          armed = false;
          b.textContent = b.dataset.label || 'Quitter';
          b.classList.remove('border-red-500', 'text-red-400');
        }, 3000);
        return;
      }
      clearTimeout(timer);
      armed = false;
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'leave' }));
      myId = null;
      joined = false;
      sessionStorage.removeItem('tvgames-player-id');
      sessionStorage.removeItem('tvgames-room');
      backToJoin();
    };
  });

  let catalogCache = null;

  function renderLobby() {
    if (!state) return;
    showLobby();
    if (!catalogCache) {
      catalogCache = games;
      fetch('/api/games').then((r) => (r.ok ? r.json() : null)).then((cats) => {
        if (Array.isArray(cats) && cats.length && JSON.stringify(cats) !== JSON.stringify(catalogCache)) {
          catalogCache = cats;
          if (joined && currentRoute().name === 'lobby') renderLobby();
        }
      }).catch(() => {});
    }
    const catalog = catalogCache;
    const isHost = state.hostId === myId;
    const isCreator = state.creatorId === myId;
    const hostName = (state.players.find((p) => p.id === state.hostId) || {}).name || '—';
    const box = document.getElementById('lobby-content');

    let tvHtml = '';
    if (isCreator && !state.pairedTv) {
      tvHtml = `<div class="rounded-2xl border border-sky-700/60 bg-sky-950/30 px-3 py-2">
          <p class="font-bold text-sky-300"><i class="fa-solid fa-tv"></i> Étape 1 — choisis la TV</p>
          <p class="mt-1 text-sm text-zinc-400">Obligatoire : le salon ne démarre que sur une TV.</p>
          ${tvsIdle.length
            ? `<div class="mt-2 grid grid-cols-2 gap-2">${tvsIdle.map((t) => `<button data-tv="${t.tvId}" class="pick-tv rounded-xl border border-zinc-700 px-2 py-2 font-bold"><i class="fa-solid fa-tv"></i> ${escapeHtml(t.name)}</button>`).join('')}</div>`
            : `<p class="mt-1 text-sm text-zinc-400">Aucune TV en attente — ouvre /tv sur la TV.</p>`}
        </div>`;
    } else {
      tvHtml = `<p class="text-sm text-zinc-400"><i class="fa-solid fa-tv"></i> TV : ${state.pairedTv ? `<strong class="text-zinc-200">${escapeHtml(state.pairedTv.name)}</strong>` : 'en attente…'}</p>`;
    }

    const playersHtml = `<div class="flex flex-wrap gap-1">${state.players.map((p) => `<span class="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-1 text-xs"><span class="inline-block h-2 w-2 rounded-full ${p.bg || 'bg-zinc-500'}"></span>${escapeHtml(p.name)}${p.id === state.hostId ? ' <i class="fa-solid fa-crown text-amber-300"></i>' : ''}</span>`).join('')}</div>`;

    let gamesHtml = '';
    if (isHost && state.pairedTv) {
      const cards = catalog.filter((g) => g.id !== 'lobby').map((g) => {
        const sel = g.id === state.game;
        const inner = `<i class="${g.icon} text-3xl ${sel ? 'text-sky-300' : 'text-zinc-400'}"></i>
            <p class="mt-1 font-bold">${escapeHtml(g.name)}</p>
            <p class="mt-0.5 text-xs text-zinc-400">${escapeHtml(g.description || '')}</p>
            ${g.players ? `<p class="mt-1 inline-block rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300"><i class="fa-solid fa-user"></i> ${escapeHtml(g.players)}</p>` : ''}`;
        return sel
          ? `<div class="rounded-2xl border-2 border-sky-500 bg-sky-950/40 p-3">${inner}</div>`
          : `<button data-pick-game="${g.id}" class="rounded-2xl border-2 border-zinc-700 p-3 text-left active:bg-zinc-800">${inner}</button>`;
      }).join('');
      gamesHtml = `<div class="rounded-2xl border border-amber-700/60 bg-amber-950/30 px-3 py-2">
          <p class="font-bold text-amber-300"><i class="fa-solid fa-crown"></i> Étape 2 — choisir le jeu</p>
          <div class="mt-2 grid grid-cols-2 gap-2">${cards}</div>
          <div class="mt-2 flex gap-2">
            <button id="btn-reset" class="flex-1 rounded-xl border border-amber-700/60 px-2 py-2 text-sm font-medium text-amber-300"><i class="fa-solid fa-rotate-right"></i> Nouvelle manche</button>
            ${state.game !== 'lobby' ? '<button id="btn-tolobby" class="flex-1 rounded-xl border border-zinc-700 px-2 py-2 text-sm text-zinc-400">Retour lobby</button>' : ''}
          </div>
        </div>`;
    } else if (!isHost) {
      const chosen = (catalog.find((g) => g.id === state.game) || {}).name || state.game;
      gamesHtml = `<p class="text-sm text-zinc-400">${!state.pairedTv ? 'En attente de la TV…' : state.game === 'lobby' ? `En attente du choix du jeu par ${escapeHtml(hostName)}…` : `Jeu choisi : <strong class="text-zinc-200">${escapeHtml(chosen)}</strong>`}</p>`;
    }

    const enterHtml = state.game !== 'lobby'
      ? `<button data-nav="/controller/game/${state.game}" class="w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-white"><i class="fa-solid fa-play"></i> Entrer dans le jeu</button>`
      : '';

    box.innerHTML = `<p class="text-center font-mono text-5xl font-bold tracking-widest text-sky-400">${state.room}</p>
      ${tvHtml}${playersHtml}${gamesHtml}${enterHtml}
      ${lastError ? `<p class="text-sm text-red-400">${escapeHtml(lastError)}</p>` : ''}`;
    box.querySelectorAll('.pick-tv').forEach((b) => {
      b.onclick = () => ws?.send(JSON.stringify({ type: 'pair-tv', tvId: b.dataset.tv }));
    });
    box.querySelectorAll('[data-pick-game]').forEach((b) => {
      b.onclick = () => ws?.send(JSON.stringify({ type: 'set-game', game: b.dataset.pickGame }));
    });
    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) resetBtn.onclick = () => ws?.send(JSON.stringify({ type: 'reset-round' }));
    const tolobby = document.getElementById('btn-tolobby');
    if (tolobby) tolobby.onclick = () => ws?.send(JSON.stringify({ type: 'set-game', game: 'lobby' }));
  }

  function renderEndModal() {
    const modal = document.getElementById('end-modal');
    const card = document.getElementById('end-modal-card');
    if (!modal || !card) return;
    const c4 = state?.connect4;
    const over = state && state.game === 'puissance4' && state.started && c4 && (c4.winnerId || c4.isDraw);
    if (!over || !duelCache.data) { modal.classList.add('hidden'); modal.classList.remove('flex'); return; }
    const d = duelCache.data;
    const isRed = myId === c4.red, isYellow = myId === c4.yellow;
    const first = (isRed || (!isRed && !isYellow)) ? c4.red : c4.yellow;
    const second = first === c4.red ? c4.yellow : c4.red;
    const wFirst = first === c4.red ? d.w1 : d.w2;
    const wSecond = first === c4.red ? d.w2 : d.w1;
    let title;
    if (c4.isDraw) title = '<p class="text-[6vmin] font-bold"><i class="fa-solid fa-handshake"></i> Match nul !</p>';
    else if (c4.winnerId === myId) title = '<p class="text-[6vmin] font-bold text-emerald-400"><i class="fa-solid fa-trophy"></i> Vous avez gagné !</p>';
    else if (isRed || isYellow) title = '<p class="text-[6vmin] font-bold text-red-400"><i class="fa-solid fa-face-frown"></i> Vous avez perdu</p>';
    else title = `<p class="text-[6vmin] font-bold text-amber-300"><i class="fa-solid fa-trophy"></i> ${escapeHtml(playerNameOf(c4.winnerId))} gagne !</p>`;
    card.innerHTML = `${title}
      <p class="mt-[2vmin] font-mono text-[14vmin] font-bold leading-none">${wFirst} - ${wSecond}</p>
      <p class="mt-[1vmin] text-[3.6vmin] text-zinc-400">${escapeHtml(playerNameOf(first))} · ${escapeHtml(playerNameOf(second))} — Puissance 4${d.draws ? ` · ${d.draws} nul(s)` : ''}</p>
      <div class="mt-[3vmin] flex gap-2">
        ${state.hostId === myId ? '<button id="btn-rematch" class="flex-1 rounded-xl border border-amber-500 bg-amber-500 px-4 py-[2vmin] text-[4vmin] font-bold text-zinc-950"><i class="fa-solid fa-rotate-right"></i> Rejouer</button>' : ''}
        <button id="btn-end-menu" class="flex-1 rounded-xl border border-zinc-700 px-4 py-[2vmin] text-[4vmin] font-bold"><i class="fa-solid fa-house"></i> Menu</button>
      </div>`;
    modal.classList.remove('hidden'); modal.classList.add('flex');
    const rematch = document.getElementById('btn-rematch');
    if (rematch) rematch.onclick = () => { hideOverlays(); ws?.send(JSON.stringify({ type: 'rematch' })); };
    document.getElementById('btn-end-menu').onclick = () => {
      if (state.hostId === myId) ws?.send(JSON.stringify({ type: 'set-game', game: 'lobby' }));
      navigate('/controller/game');
    };
  }

  function renderRematchModal() {
    const modal = document.getElementById('rematch-modal');
    const card = document.getElementById('rematch-modal-card');
    if (!modal || !card) return;
    const c4 = state?.connect4;
    const show = joined && rematchOffer && state && rematchOffer.room === state.room
      && state.game === 'puissance4' && !state.started && c4
      && myId !== state.hostId && (myId === c4.red || myId === c4.yellow);
    if (!show) { modal.classList.add('hidden'); modal.classList.remove('flex'); return; }
    card.innerHTML = `<p class="text-[5vmin] font-bold"><i class="fa-solid fa-rotate-right text-amber-300"></i> Revanche ?</p>
      <p class="mt-[2vmin] text-[4vmin]">${escapeHtml(rematchOffer.from)} propose de rejouer !</p>
      <div class="mt-[3vmin] flex gap-2">
        <button id="btn-rematch-yes" class="flex-1 rounded-xl border border-emerald-500 bg-emerald-600 px-4 py-[2vmin] text-[4vmin] font-bold text-white"><i class="fa-solid fa-check"></i> Accepter</button>
        <button id="btn-rematch-no" class="flex-1 rounded-xl border border-zinc-700 px-4 py-[2vmin] text-[4vmin] font-bold"><i class="fa-solid fa-xmark"></i> Refuser</button>
      </div>`;
    modal.classList.remove('hidden'); modal.classList.add('flex');
    document.getElementById('btn-rematch-yes').onclick = () => { rematchOffer = null; ws?.send(JSON.stringify({ type: 'ready', ready: true })); };
    document.getElementById('btn-rematch-no').onclick = () => { rematchOffer = null; hideOverlays(); ws?.send(JSON.stringify({ type: 'rematch-decline' })); };
  }

  function maybeFetchDuel(c4) {
    const over = c4 && (c4.winnerId || c4.isDraw);
    if (!state || state.game !== 'puissance4' || !state.started || !over || !c4.red || !c4.yellow) {
      if (duelCache.key || duelCache.data) duelCache = { key: null, data: null };
      renderEndModal();
      return;
    }
    const moves = c4.grid.flat().filter(Boolean).length;
    const key = `${state.room}:${state.game}:${c4.winnerId || 'draw'}:${moves}`;
    if (key === duelCache.key) { renderEndModal(); return; }
    duelCache = { key, data: null };
    renderEndModal();
    fetch(`/api/duel?game=${encodeURIComponent(state.game)}&a=${encodeURIComponent(c4.red)}&b=${encodeURIComponent(c4.yellow)}`)
      .then((r) => r.json())
      .then((d) => { if (duelCache.key === key) { duelCache.data = d; renderEndModal(); } })
      .catch(() => {});
  }

  function renderControls() {
    if (!state) return;
    if (state.game === 'lobby') { navigate('/controller/game', true); return; }
    showPlay();
    gameLabel.textContent = state.game;
    const isHost = state.hostId === myId;
    const me = state.players.find((p) => p.id === myId) || {};
    const myBg = (PALETTE.find((c) => c.id === me.color) || {}).bg || 'bg-zinc-500';
    const takenBy = (id) => (state.players.find((p) => p.color === id && p.id !== myId) || {}).name;
    const colorHtml = `<p class="mt-[2vmin] text-[3.8vmin] font-bold">Ta couleur :</p>
      <div class="mt-[1vmin] grid w-full grid-cols-4 gap-[1.5vmin]">${
        PALETTE.map((c) => {
          const by = takenBy(c.id);
          return `<button data-color="${c.id}" ${by ? 'disabled' : ''} class="p4-color flex items-center justify-center gap-1 rounded-xl border px-1 py-[1.6vmin] text-[3vmin] ${c.id === me.color ? 'border-white ring-2 ring-white' : 'border-zinc-700'} ${by ? 'opacity-30' : ''}"><span class="h-[3.5vmin] w-[3.5vmin] rounded-full ${c.bg}"></span>${by ? escapeHtml(by) : c.name}</button>`;
        }).join('')
      }</div>`;
    document.getElementById('name-label').innerHTML =
      `${escapeHtml(sessionStorage.getItem('tvgames-player-name') || '')}${isHost ? ' <i class="fa-solid fa-crown text-amber-300"></i>' : ''} <span class="inline-block h-3 w-3 rounded-full ${myBg}"></span>`;

    let gameHtml = '';
    if (state.game === 'puissance4') {
      const c4 = state.connect4;
      const isRed = myId === c4.red;
      const isYellow = myId === c4.yellow;
      const contestant = isRed || isYellow;
      const readyMark = (id) => state.ready[id]
        ? '<i class="fa-solid fa-check text-emerald-400"></i>'
        : '<i class="fa-solid fa-hourglass-half text-zinc-500"></i>';
      if (!state.started) {
        const amReady = !!state.ready[myId];
        const bothReady = c4.red && c4.yellow && state.ready[c4.red] && state.ready[c4.yellow];
        gameHtml = `${c4.red && c4.yellow
          ? `<p class="text-[3.8vmin] font-bold">${escapeHtml(playerNameOf(c4.red))} ${readyMark(c4.red)} vs ${escapeHtml(playerNameOf(c4.yellow))} ${readyMark(c4.yellow)}</p>`
          : '<p class="mt-[1vmin] text-[3.6vmin] text-zinc-400">En attente d\u2019un adversaire…</p>'}
        ${contestant ? colorHtml : '<p class="text-[3.2vmin] text-zinc-500">Tu regarderas la partie <i class="fa-solid fa-eye"></i></p>'}
        ${contestant ? `<button id="btn-ready" class="mt-[2vmin] w-full rounded-xl border px-4 py-[2vmin] text-[4vmin] font-bold ${amReady ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-zinc-700'}"><i class="fa-solid fa-check"></i> ${amReady ? 'Prêt ! (tap pour annuler)' : 'Je suis prêt !'}</button>` : ''}
        ${isHost ? `<button id="btn-start" ${bothReady ? '' : 'disabled'} class="mt-[1.5vmin] w-full rounded-xl border px-4 py-[2vmin] text-[4vmin] font-bold ${bothReady ? 'border-amber-500 bg-amber-500 text-zinc-950' : 'border-zinc-800 text-zinc-600'}"><i class="fa-solid fa-play"></i> Lancer la partie</button>
        ${bothReady ? '' : '<p class="mt-[1vmin] text-[3.4vmin] text-zinc-500">En attente que les 2 joueurs soient prêts…</p>'}` : '<p class="mt-[1vmin] text-[3.4vmin] text-zinc-400">Le gérant lancera la partie…</p>'}
        ${lastError ? `<p class="mt-[1vmin] text-[3.4vmin] text-red-400">${escapeHtml(lastError)}</p>` : ''}`;
      } else {
      const myTurn = c4.turn === myId && !c4.winnerId && !c4.isDraw;
      let fallingM = null;
      if (prevGridM) {
        for (let r = 0; r < 6 && !fallingM; r++) {
          for (let c = 0; c < 7; c++) {
            if ((prevGridM[r][c] === null || prevGridM[r][c] === undefined) && c4.grid[r][c] !== null && c4.grid[r][c] !== undefined) { fallingM = `${r},${c}`; break; }
          }
        }
      }
      prevGridM = c4.grid.map((rowArr) => [...rowArr]);
      const tokenClass = (v, r, c) => {
        const base = 'aspect-square rounded-full';
        if (v !== null && v !== undefined) return `${base} ${c4.colorBg[v] || 'bg-zinc-500'}`;
        return `${base} bg-zinc-800`;
      };
      const board = c4.grid.map((rowArr, r) =>
        rowArr.map((v, c) => fallingM === `${r},${c}`
          ? `<div class="${tokenClass(v, r, c)} c4-drop" style="--fall:-${(r + 1) * 100}%"></div>`
          : `<div class="${tokenClass(v, r, c)}"></div>`).join('')
      ).join('');
      const cols = myTurn
        ? `<div class="mt-[1vmin] grid w-[min(100%,52dvh)] grid-cols-7 gap-1">${
            [0, 1, 2, 3, 4, 5, 6].map((c) => `<button data-col="${c}" class="p4-col rounded-lg border py-[1.5vmin] text-[4vmin] font-bold ${pendingCol === c ? 'border-sky-400 bg-sky-600' : 'border-zinc-700 active:bg-sky-500'}"><i class="fa-solid fa-chevron-down"></i></button>`).join('')
          }</div>`
        : '';
      const status = c4.winnerId
        ? `<p class="mt-[1vmin] text-[4.5vmin] font-bold text-amber-300"><i class="fa-solid fa-trophy"></i> ${c4.winnerId === myId ? 'Tu as gagné !' : `${escapeHtml(playerNameOf(c4.winnerId))} gagne !`}</p>`
        : c4.isDraw
          ? `<p class="mt-[1vmin] text-[4.5vmin] font-bold"><i class="fa-solid fa-handshake"></i> Match nul !</p>`
          : !(c4.red && c4.yellow)
            ? `<p class="mt-[1vmin] text-[3.6vmin] text-zinc-400">En attente d'un adversaire…</p>`
            : myTurn
              ? `<p class="mt-[1vmin] text-[3.8vmin] font-bold text-emerald-400">À toi <i class="fa-solid fa-circle" style="color:${isRed ? '#ef4444' : '#facc15'}"></i> — tap une colonne, re-tap pour valider !</p>`
              : `<p class="mt-[1vmin] text-[3.6vmin] text-zinc-400">Tour de ${escapeHtml(playerNameOf(c4.turn))}…</p>`;
      gameHtml = `${contestant && c4.red && c4.yellow ? `<p class="text-[3.2vmin] text-zinc-500"><i class="fa-solid fa-circle" style="color:#ef4444"></i> ${escapeHtml(playerNameOf(c4.red))} vs <i class="fa-solid fa-circle" style="color:#facc15"></i> ${escapeHtml(playerNameOf(c4.yellow))}</p>` : '<p class="text-[3.2vmin] text-zinc-500">Tu regardes la partie <i class="fa-solid fa-eye"></i></p>'}
        ${(isRed || isYellow) ? colorHtml : ''}
        ${lastError ? `<p class="mt-[1vmin] text-[3.4vmin] text-red-400">${escapeHtml(lastError)}</p>` : ''}
        <div class="grid w-[min(100%,52dvh)] grid-cols-7 gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-2">${board}</div>
        ${cols}${status}`;
      }
    }

    controlsEl.innerHTML = gameHtml;
    maybeFetchDuel(state.game === 'puissance4' && state.started ? state.connect4 : null);
    renderRematchModal();
    const readyBtn = document.getElementById('btn-ready');
    if (readyBtn) readyBtn.onclick = () => ws?.send(JSON.stringify({ type: 'ready', ready: !state.ready[myId] }));
    const startBtn = document.getElementById('btn-start');
    if (startBtn) startBtn.onclick = () => ws?.send(JSON.stringify({ type: 'start-game' }));
    controlsEl.querySelectorAll('.p4-col').forEach((b) => {
      b.onclick = () => {
        const col = Number(b.dataset.col);
        if (pendingCol === col) {
          pendingCol = null;
          ws?.send(JSON.stringify({ type: 'input', action: 'drop', col }));
        } else {
          pendingCol = col;
          renderControls();
        }
      };
    });
    controlsEl.querySelectorAll('.p4-color').forEach((b) => {
      b.onclick = () => ws?.send(JSON.stringify({ type: 'set-color', color: b.dataset.color }));
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function playerNameOf(id) {
    return (state?.players || []).find((p) => p.id === id)?.name || '?';
  }

  connect();
})();
