const SERVER_URL = window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:3001';

const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

const state = {
  playerId: localStorage.getItem('hiddenCouncilPlayerId') || crypto.randomUUID(),
  roomCode: localStorage.getItem('hiddenCouncilRoomCode') || '',
  playerName: localStorage.getItem('hiddenCouncilPlayerName') || '',
  snapshot: null,
  privatePresidentState: null,
  privateChancellorState: null,
  privatePowerResult: null
};
localStorage.setItem('hiddenCouncilPlayerId', state.playerId);

const el = {
  playerName: document.getElementById('playerName'),
  roomCodeInput: document.getElementById('roomCodeInput'),
  createRoomBtn: document.getElementById('createRoomBtn'),
  joinRoomBtn: document.getElementById('joinRoomBtn'),
  authPanel: document.getElementById('authPanel'),
  roomPanel: document.getElementById('roomPanel'),
  roomCodeDisplay: document.getElementById('roomCodeDisplay'),
  roomMeta: document.getElementById('roomMeta'),
  copyCodeBtn: document.getElementById('copyCodeBtn'),
  startGameBtn: document.getElementById('startGameBtn'),
  connectionStatus: document.getElementById('connectionStatus'),
  playersList: document.getElementById('playersList'),
  privateRoleCard: document.getElementById('privateRoleCard'),
  actionArea: document.getElementById('actionArea'),
  gameLog: document.getElementById('gameLog'),
  councilTrack: document.getElementById('councilTrack'),
  shadowTrack: document.getElementById('shadowTrack'),
  electionTracker: document.getElementById('electionTracker'),
  drawPileCount: document.getElementById('drawPileCount'),
  discardPileCount: document.getElementById('discardPileCount'),
  toast: document.getElementById('toast')
};

el.playerName.value = state.playerName;
el.roomCodeInput.value = state.roomCode;

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.toast.classList.add('hidden'), 3000);
}

function updateConnectionStatus(text, ok) {
  el.connectionStatus.textContent = text;
  el.connectionStatus.classList.toggle('ok', !!ok);
  el.connectionStatus.classList.toggle('bad', ok === false);
}

socket.on('connect', () => {
  updateConnectionStatus('Connected', true);
  if (state.roomCode) {
    socket.emit('reconnect_room', { roomCode: state.roomCode, playerId: state.playerId }, (res) => {
      if (!res?.ok) return;
      showRoom();
    });
  }
});

socket.on('disconnect', () => updateConnectionStatus('Disconnected', false));
socket.on('connect_error', () => updateConnectionStatus('Connection error', false));

socket.on('room_state', ({ snapshot, privatePresidentState, privateChancellorState }) => {
  state.snapshot = snapshot;
  state.privatePresidentState = privatePresidentState;
  state.privateChancellorState = privateChancellorState;
  state.roomCode = snapshot.roomCode;
  localStorage.setItem('hiddenCouncilRoomCode', state.roomCode);
  render();
  showRoom();
});

socket.on('action_error', ({ message }) => showToast(message));
socket.on('private_power_result', (result) => {
  state.privatePowerResult = result;
  if (result.type === 'investigate') {
    showToast(`Investigation result: ${nameById(result.targetId)} is on the ${result.team} team.`);
  } else if (result.type === 'policy_peek') {
    showToast(`Top deck peek: ${result.cards.join(', ')}`);
  }
});

function showRoom() {
  el.authPanel.classList.add('hidden');
  el.roomPanel.classList.remove('hidden');
}

function getEnteredName() {
  const name = el.playerName.value.trim();
  if (!name) {
    showToast('Enter your name first.');
    return null;
  }
  state.playerName = name;
  localStorage.setItem('hiddenCouncilPlayerName', name);
  return name;
}

el.createRoomBtn.addEventListener('click', () => {
  const name = getEnteredName();
  if (!name) return;
  socket.emit('create_room', { name, playerId: state.playerId }, (res) => {
    if (!res.ok) return showToast(res.message || 'Could not create room.');
    state.roomCode = res.roomCode;
    localStorage.setItem('hiddenCouncilRoomCode', state.roomCode);
    showRoom();
  });
});

el.joinRoomBtn.addEventListener('click', () => {
  const name = getEnteredName();
  if (!name) return;
  const roomCode = el.roomCodeInput.value.trim().toUpperCase();
  if (!roomCode) return showToast('Enter a room code.');
  socket.emit('join_room', { roomCode, name, playerId: state.playerId }, (res) => {
    if (!res.ok) return showToast(res.message || 'Could not join room.');
    state.roomCode = res.roomCode;
    localStorage.setItem('hiddenCouncilRoomCode', state.roomCode);
    showRoom();
  });
});

el.copyCodeBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(state.roomCode || '');
    showToast('Room code copied.');
  } catch {
    showToast('Could not copy room code.');
  }
});

el.startGameBtn.addEventListener('click', () => {
  socket.emit('start_game', { roomCode: state.roomCode, playerId: state.playerId });
});

function nameById(id) {
  return state.snapshot?.players.find((p) => p.id === id)?.name || 'Unknown';
}

function render() {
  if (!state.snapshot) return;
  renderHeader();
  renderBoard();
  renderPlayers();
  renderRoleCard();
  renderActionArea();
  renderLog();
}

function renderHeader() {
  const s = state.snapshot;
  el.roomCodeDisplay.textContent = s.roomCode;
  const president = nameById(s.currentPresidentId);
  const nominated = s.nominatedChancellorId ? nameById(s.nominatedChancellorId) : 'None';
  el.roomMeta.textContent = `${s.players.length}/10 players • Phase: ${s.phase.replaceAll('_', ' ')} • President: ${president || 'TBD'} • Nominee: ${nominated}`;
  el.startGameBtn.classList.toggle('hidden', !s.canStart);
  el.startGameBtn.disabled = !s.minimumReached;
}

function renderBoard() {
  el.councilTrack.innerHTML = '';
  for (let i = 0; i < 5; i += 1) {
    const slot = document.createElement('div');
    slot.className = `policy-slot ${i < state.snapshot.board.council ? 'active council' : ''}`;
    el.councilTrack.appendChild(slot);
  }

  el.shadowTrack.innerHTML = '';
  for (let i = 0; i < 6; i += 1) {
    const slot = document.createElement('div');
    slot.className = `policy-slot ${i < state.snapshot.board.shadow ? 'active shadow' : ''}`;
    el.shadowTrack.appendChild(slot);
  }

  el.electionTracker.innerHTML = '';
  for (let i = 0; i < 3; i += 1) {
    const slot = document.createElement('div');
    slot.className = `tracker-slot ${i < state.snapshot.electionTracker ? 'active' : ''}`;
    el.electionTracker.appendChild(slot);
  }

  el.drawPileCount.textContent = state.snapshot.drawPileCount;
  el.discardPileCount.textContent = state.snapshot.discardPileCount;
}

function renderPlayers() {
  el.playersList.innerHTML = '';
  state.snapshot.players.forEach((player) => {
    const card = document.createElement('div');
    card.className = `player-card ${player.isYou ? 'you' : ''} ${player.isAlive ? '' : 'dead'}`;

    const head = document.createElement('div');
    head.className = 'player-head';
    head.innerHTML = `<strong>${player.name}${player.isYou ? ' (You)' : ''}</strong><span>${player.connected ? '🟢' : '🔴'}</span>`;

    const tags = document.createElement('div');
    tags.className = 'player-tags';
    if (player.isHost) tags.appendChild(tag('Host'));
    if (player.isPresident) tags.appendChild(tag('President', 'good'));
    if (player.isChancellor) tags.appendChild(tag('Chancellor', 'good'));
    if (!player.isAlive) tags.appendChild(tag('Eliminated', 'bad'));
    if (player.isEligibleForChancellor) tags.appendChild(tag('Eligible'));
    else tags.appendChild(tag('Blocked'));

    if (canNominateThisPlayer(player)) {
      const btn = document.createElement('button');
      btn.textContent = 'Nominate';
      btn.addEventListener('click', () => {
        socket.emit('nominate_chancellor', {
          roomCode: state.roomCode,
          playerId: state.playerId,
          targetPlayerId: player.id
        });
      });
      tags.appendChild(btn);
    }

    if (canTargetForPresidentPower(player)) {
      const btn = document.createElement('button');
      btn.textContent = presidentPowerLabel();
      btn.addEventListener('click', () => {
        socket.emit('resolve_president_power', {
          roomCode: state.roomCode,
          playerId: state.playerId,
          payload: { targetPlayerId: player.id }
        });
      });
      tags.appendChild(btn);
    }

    card.append(head, tags);
    el.playersList.appendChild(card);
  });
}

function tag(text, kind = '') {
  const div = document.createElement('div');
  div.className = `tag ${kind}`.trim();
  div.textContent = text;
  return div;
}

function canNominateThisPlayer(player) {
  const s = state.snapshot;
  return s.phase === 'nomination' && s.currentPresidentId === state.playerId && player.id !== state.playerId && player.isEligibleForChancellor;
}

function canTargetForPresidentPower(player) {
  const s = state.snapshot;
  const power = s.pendingPower;
  return s.phase === 'president_power' && s.currentPresidentId === state.playerId && ['investigate', 'special_election', 'eliminate'].includes(power) && player.id !== state.playerId && player.isAlive;
}

function presidentPowerLabel() {
  const power = state.snapshot?.pendingPower;
  if (power === 'investigate') return 'Investigate';
  if (power === 'special_election') return 'Select';
  if (power === 'eliminate') return 'Eliminate';
  return 'Target';
}

function renderRoleCard() {
  const info = state.snapshot.privateRoleInfo;
  if (!info) {
    el.privateRoleCard.textContent = 'Your role will appear here after the game starts.';
    return;
  }

  const allies = (info.knownAllies || []).map((ally) => ally.name).join(', ') || 'None revealed';
  const knownSupreme = info.knownSupremeShadow ? nameById(info.knownSupremeShadow) : 'Unknown';
  el.privateRoleCard.innerHTML = `
    <p><strong>Role:</strong> ${info.role}</p>
    <p><strong>Team:</strong> ${info.team}</p>
    <p><strong>Known allies:</strong> ${allies}</p>
    ${info.knownSupremeShadow ? `<p><strong>Known Supreme Shadow:</strong> ${knownSupreme}</p>` : ''}
  `;
}

function renderActionArea() {
  const s = state.snapshot;
  const actionParts = [];

  if (s.winner) {
    actionParts.push(`<p><strong>Winner:</strong> ${s.winner.side}</p><p>${s.winner.reason}</p>`);
  }

  if (s.phase === 'voting' && !s.myVoteSubmitted && currentPlayerAlive()) {
    actionParts.push(`
      <p>The table is voting on <strong>${nameById(s.nominatedChancellorId)}</strong>.</p>
      <div class="action-buttons">
        <button class="primary" data-vote="ja">Vote Ja</button>
        <button data-vote="nein">Vote Nein</button>
      </div>
    `);
  } else if (s.phase === 'voting' && s.myVoteSubmitted) {
    actionParts.push('<p>Your vote has been submitted. Waiting for the others.</p>');
  }

  if (state.privatePresidentState?.type === 'legislative_president') {
    actionParts.push(renderPolicyChoice('Choose 1 policy to discard', state.privatePresidentState.cards, 'discard'));
  }

  if (state.privateChancellorState?.type === 'legislative_chancellor') {
    actionParts.push(renderPolicyChoice('Choose 1 policy to enact', state.privateChancellorState.cards, 'enact'));
  }

  if (s.phase === 'president_power' && s.currentPresidentId === state.playerId) {
    if (s.pendingPower === 'policy_peek') {
      actionParts.push(`
        <p>Policy Peek available.</p>
        <button class="primary" id="peekBtn">Reveal top 3 policies to yourself</button>
      `);
    } else {
      actionParts.push(`<p>Select a target player below for <strong>${s.pendingPower}</strong>.</p>`);
    }
  }

  if (actionParts.length === 0) {
    actionParts.push('<p>No action available right now.</p>');
  }

  el.actionArea.innerHTML = actionParts.join('');

  el.actionArea.querySelectorAll('[data-vote]').forEach((btn) => {
    btn.addEventListener('click', () => {
      socket.emit('cast_vote', {
        roomCode: state.roomCode,
        playerId: state.playerId,
        vote: btn.dataset.vote
      });
    });
  });

  el.actionArea.querySelectorAll('[data-discard-index]').forEach((btn) => {
    btn.addEventListener('click', () => {
      socket.emit('president_discard', {
        roomCode: state.roomCode,
        playerId: state.playerId,
        discardIndex: Number(btn.dataset.discardIndex)
      });
    });
  });

  el.actionArea.querySelectorAll('[data-enact-index]').forEach((btn) => {
    btn.addEventListener('click', () => {
      socket.emit('chancellor_enact', {
        roomCode: state.roomCode,
        playerId: state.playerId,
        enactIndex: Number(btn.dataset.enactIndex)
      });
    });
  });

  const peekBtn = document.getElementById('peekBtn');
  if (peekBtn) {
    peekBtn.addEventListener('click', () => {
      socket.emit('resolve_president_power', {
        roomCode: state.roomCode,
        playerId: state.playerId,
        payload: {}
      });
    });
  }
}

function renderPolicyChoice(title, cards, mode) {
  const buttons = cards.map((card, index) => `
    <button class="policy-button ${card}" ${mode === 'discard' ? `data-discard-index="${index}"` : `data-enact-index="${index}"`}>
      ${card}
    </button>
  `).join('');

  return `
    <p>${title}</p>
    <div class="policy-choice-row">${buttons}</div>
  `;
}

function currentPlayerAlive() {
  return !!state.snapshot?.players.find((p) => p.id === state.playerId)?.isAlive;
}

function renderLog() {
  el.gameLog.innerHTML = '';
  state.snapshot.log.forEach((entry) => {
    const div = document.createElement('div');
    div.className = 'log-item';
    div.textContent = entry;
    el.gameLog.appendChild(div);
  });
}
