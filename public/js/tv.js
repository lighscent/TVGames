(() => {
  const init = window.__TV_INIT__;
  const { games } = init;
  let room = init.room || '';
  let qr = init.qr || '';
  let tvId = sessionStorage.getItem('tvgames-tv-id') || null;
  let tvName = '';
  const stage = document.getElementById('stage');
  const playersEl = document.getElementById('players');
  const countEl = document.getElementById('player-count');
  const statusEl = document.getElementById('ws-status');
  const currentGameEl = document.getElementById('current-game');
  const hostNameEl = document.getElementById('host-name');
  let state = null;
  let ws = null;
  let prevGrid = null;

  const gameLabel = (id) => {
    const g = games.find((gg) => gg.id === id);
    return g ? `<i class="${g.icon}"></i> ${escapeHtml(g.name)}` : escapeHtml(id);
  };
  const playerName = (id) => (state?.players || []).find((p) => p.id === id)?.name || '?';

  function connect() {
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    ws.onopen = () => {
      statusEl.textContent = 'connecté';
      statusEl.className = 'text-emerald-400';
      ws.send(JSON.stringify({ type: 'join', role: 'tv', tvId }));
    };
    ws.onclose = () => {
      statusEl.textContent = 'déconnecté — reconnexion…';
      statusEl.className = 'text-red-400';
      setTimeout(connect, 2000);
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'tv-idle') {
        tvId = msg.tvId;
        tvName = msg.tvName;
        sessionStorage.setItem('tvgames-tv-id', tvId);
        state = null;
        room = '';
        renderIdle();
      } else if (msg.type === 'tv-paired') {
        tvId = msg.tvId;
        tvName = msg.tvName;
        room = msg.room;
        qr = msg.qrDataUrl || '';
        sessionStorage.setItem('tvgames-tv-id', tvId);
        document.getElementById('room-code').textContent = room;
      } else if (msg.type === 'room-state') {
        state = msg;
        room = msg.room;
        document.getElementById('room-code').textContent = room;
        render();
      }
    };
  }

  function renderIdle() {
    document.getElementById('room-code').textContent = '—';
    currentGameEl.textContent = 'En attente';
    hostNameEl.textContent = '—';
    countEl.textContent = '0';
    playersEl.innerHTML = '';
    stage.innerHTML = `<div><p class="text-[10vmin]"><i class="fa-solid fa-tv"></i></p>
      <p class="mt-[1vmin] font-mono text-[13vmin] font-black leading-none text-emerald-400">${escapeHtml(tvName)}</p>
      <h2 class="mt-[2vmin] text-[4vmin] font-bold">En attente d'association</h2>
      <p class="mt-[1vmin] text-[2.4vmin] text-zinc-400">Crée un salon depuis un mobile, puis sélectionne cette TV.</p></div>`;
  }

  function fitBoards() {
    document.querySelectorAll('[data-fit-aspect]').forEach((el) => {
      const parent = el.parentElement;
      const aspect = parseFloat(el.dataset.fitAspect);
      const width = Math.max(120, Math.min(parent.clientWidth, parent.clientHeight * aspect));
      el.style.width = `${width}px`;
    });
  }
  window.addEventListener('resize', fitBoards);

  function render() {
    if (!state) return;
    currentGameEl.innerHTML = gameLabel(state.game);
    hostNameEl.textContent = playerName(state.hostId);
    countEl.textContent = state.players.length;
    playersEl.innerHTML = state.players.length
      ? state.players.map((p) => `<span class="rounded-full border ${p.id === state.hostId ? 'border-amber-500' : 'border-zinc-700'} px-3 py-1 text-[1.8vmin]"><span class="mr-1 inline-block h-[1.6vmin] w-[1.6vmin] rounded-full ${p.bg || 'bg-zinc-500'}"></span>${p.id === state.hostId ? '<i class="fa-solid fa-crown"></i>' : '<i class="fa-solid fa-user"></i>'} ${escapeHtml(p.name)}</span>`).join('')
      : '<span class="text-[1.8vmin] text-zinc-600">En attente de joueurs… scannez le QR.</span>';

    if (state.game === 'lobby') {
      stage.innerHTML = `<div class="flex flex-wrap items-center justify-center gap-[5vmin]">
        ${qr ? `<img src="${qr}" alt="QR pour rejoindre" class="w-[30vmin] rounded-2xl bg-white p-2" />` : '<p class="text-[10vmin]"><i class="fa-solid fa-gamepad"></i></p>'}
        <div>
          <h2 class="text-[4vmin] font-bold">En attente de joueurs</h2>
          <p class="mt-[1vmin] font-mono text-[13vmin] font-black leading-none tracking-[0.2em] text-sky-400">${room}</p>
          <p class="mt-[2vmin] text-[2.4vmin] text-zinc-400">Sur mobile : <span class="font-mono text-sky-300">/controller?room=${room}</span> — entrez ce code</p>
        </div>
      </div>`;
    } else if (state.game === 'puissance4') {
      const c4 = state.connect4;
      const dot = (id) => `<span class="inline-block h-[2vmin] w-[2vmin] rounded-full ${c4.colorBg[id] || 'bg-zinc-600'}"></span>`;
      const readyMark = (id) => state.ready[id]
        ? '<i class="fa-solid fa-check text-emerald-400"></i>'
        : '<i class="fa-solid fa-hourglass-half text-zinc-500"></i>';
      if (!state.started) {
        prevGrid = null;
        const vs = c4.red && c4.yellow
          ? `${dot(c4.red)} ${escapeHtml(playerName(c4.red))} ${readyMark(c4.red)} vs ${dot(c4.yellow)} ${escapeHtml(playerName(c4.yellow))} ${readyMark(c4.yellow)}`
          : 'En attente de 2 joueurs…';
        stage.innerHTML = `<div class="flex h-full w-full flex-col items-center justify-center">
          <h2 class="text-[5vmin] font-bold">Puissance 4 — préparation</h2>
          <p class="mt-[2vmin] text-[3.4vmin]">${vs}</p>
          <p class="mt-[2vmin] text-[2.4vmin] text-zinc-400">Choisissez votre couleur sur mobile, mettez-vous prêts — le gérant lancera la partie.</p>
        </div>`;
      } else {
      const winSet = new Set((c4.winCells || []).map(([r, c]) => `${r},${c}`));
      let falling = null;
      if (prevGrid) {
        for (let r = 0; r < 6 && !falling; r++) {
          for (let c = 0; c < 7; c++) {
            if ((prevGrid[r][c] === null || prevGrid[r][c] === undefined) && c4.grid[r][c] !== null && c4.grid[r][c] !== undefined) { falling = `${r},${c}`; break; }
          }
        }
      }
      prevGrid = c4.grid.map((rowArr) => [...rowArr]);
      const tokenClass = (v, r, c) => {
        const base = 'aspect-square rounded-full';
        if (v !== null && v !== undefined) return `${base} ${c4.colorBg[v] || 'bg-zinc-500'}${winSet.has(`${r},${c}`) ? ' ring-4 ring-emerald-400' : ''}`;
        return `${base} bg-zinc-800`;
      };
      const board = c4.grid.map((rowArr, r) =>
        rowArr.map((v, c) => falling === `${r},${c}`
          ? `<div class="${tokenClass(v, r, c)} c4-drop" style="--fall:-${(r + 1) * 100}%"></div>`
          : `<div class="${tokenClass(v, r, c)}"></div>`).join('')
      ).join('');
      const dot = (id) => `<span class="inline-block h-[2vmin] w-[2vmin] rounded-full ${c4.colorBg[id] || 'bg-zinc-600'}"></span>`;
      const vs = c4.red && c4.yellow
        ? `${dot(c4.red)} ${escapeHtml(playerName(c4.red))} vs ${dot(c4.yellow)} ${escapeHtml(playerName(c4.yellow))}`
        : 'En attente de 2 joueurs…';
      stage.innerHTML = `<div class="flex h-full w-full flex-col items-center">
        ${c4.winnerId
          ? `<h2 class="shrink-0 text-[5vmin] font-bold text-amber-300"><i class="fa-solid fa-trophy"></i> ${escapeHtml(playerName(c4.winnerId))} gagne !</h2>`
          : c4.isDraw
            ? `<h2 class="shrink-0 text-[5vmin] font-bold"><i class="fa-solid fa-handshake"></i> Match nul !</h2>`
            : `<h2 class="shrink-0 text-[4vmin] font-bold">Puissance 4</h2><p class="shrink-0 text-[2.4vmin] text-zinc-400">${vs}${c4.turn ? ` — tour de <strong class="text-white">${escapeHtml(playerName(c4.turn))}</strong>` : ''}</p>`}
        <div class="flex min-h-0 w-full flex-1 items-center justify-center pt-[1.5vmin]">
          <div data-fit-aspect="1.1" class="grid grid-cols-7 gap-[1vmin] rounded-2xl border border-zinc-800 bg-zinc-900/60 p-[1.5vmin]">${board}</div>
        </div>
      </div>`;
      }
    } else {
      stage.innerHTML = `<h2 class="text-[4vmin] font-bold">${gameLabel(state.game)}</h2>`;
    }
    fitBoards();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  connect();
})();
