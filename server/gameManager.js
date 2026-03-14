import {
  ELECTION_TRACKER_LIMIT,
  GAME_PHASES,
  LIBERAL_POLICIES_TO_WIN,
  MAX_PLAYERS,
  MIN_PLAYERS,
  POLICY_TYPES,
  ROLE_TYPES,
  SHADOW_POLICIES_TO_WIN,
  TEAM_TYPES
} from './constants.js';
import { createPolicyDeck, drawPolicies, nowIso, rolesForPlayerCount, shuffle } from './utils.js';

function buildPlayerState(player) {
  return {
    id: player.id,
    name: player.name,
    socketId: player.socketId,
    connected: player.connected,
    isHost: player.isHost,
    isAlive: player.isAlive,
    role: player.role,
    team: player.team,
    canVote: player.isAlive,
    isPresident: false,
    isChancellor: false
  };
}

export function createRoom(roomCode, hostSocketId, hostName, playerId) {
  const host = {
    id: playerId,
    socketId: hostSocketId,
    name: hostName,
    connected: true,
    isHost: true,
    isAlive: true,
    role: null,
    team: null
  };

  return {
    code: roomCode,
    createdAt: nowIso(),
    status: GAME_PHASES.LOBBY,
    hostPlayerId: playerId,
    players: [host],
    startedAt: null,
    winner: null,
    board: {
      council: 0,
      shadow: 0
    },
    state: createInitialGameState(),
    log: ['Room created. Waiting for players.']
  };
}

function createInitialGameState() {
  return {
    phase: GAME_PHASES.LOBBY,
    presidencyIndex: -1,
    currentPresidentId: null,
    nominatedChancellorId: null,
    currentChancellorId: null,
    previousPresidentId: null,
    previousChancellorId: null,
    electionTracker: 0,
    drawPile: [],
    discardPile: [],
    votes: {},
    legislative: {
      presidentHand: [],
      chancellorHand: []
    },
    pendingPower: null,
    lastPolicy: null,
    lastVotes: null,
    investigatedPlayers: {}
  };
}

export function addPlayer(room, socketId, name, playerId) {
  if (room.status !== GAME_PHASES.LOBBY) {
    throw new Error('Game already started for this room.');
  }
  if (room.players.length >= MAX_PLAYERS) {
    throw new Error('Room is full.');
  }
  const normalizedName = name.trim();
  if (room.players.some((p) => p.name.toLowerCase() === normalizedName.toLowerCase())) {
    throw new Error('Name already taken in this room.');
  }

  room.players.push({
    id: playerId,
    socketId,
    name: normalizedName,
    connected: true,
    isHost: false,
    isAlive: true,
    role: null,
    team: null
  });
  room.log.unshift(`${normalizedName} joined the room.`);
}

export function reconnectPlayer(room, socketId, playerId) {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) throw new Error('Player not found in this room.');
  player.socketId = socketId;
  player.connected = true;
  room.log.unshift(`${player.name} reconnected.`);
  return player;
}

export function markDisconnected(room, socketId) {
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return null;
  player.connected = false;
  room.log.unshift(`${player.name} disconnected.`);
  return player;
}

export function removePlayerFromLobby(room, socketId) {
  if (room.status !== GAME_PHASES.LOBBY) return false;
  const idx = room.players.findIndex((p) => p.socketId === socketId);
  if (idx === -1) return false;
  const [removed] = room.players.splice(idx, 1);
  room.log.unshift(`${removed.name} left the room.`);
  if (removed.isHost && room.players.length > 0) {
    room.players[0].isHost = true;
    room.hostPlayerId = room.players[0].id;
    room.log.unshift(`${room.players[0].name} is now host.`);
  }
  return true;
}

export function shouldDestroyRoom(room) {
  return room.players.length === 0;
}

export function canStartGame(room, requesterPlayerId) {
  return room.status === GAME_PHASES.LOBBY
    && room.players.length >= MIN_PLAYERS
    && room.players.length <= MAX_PLAYERS
    && room.hostPlayerId === requesterPlayerId;
}

export function startGame(room) {
  if (room.players.length < MIN_PLAYERS || room.players.length > MAX_PLAYERS) {
    throw new Error('Room needs 5 to 10 players to start.');
  }

  const roleSpec = rolesForPlayerCount(room.players.length);
  const roles = [
    ...Array.from({ length: roleSpec.liberals }, () => ({ role: ROLE_TYPES.COUNCIL, team: TEAM_TYPES.LIBERAL })),
    ...Array.from({ length: roleSpec.shadows }, () => ({ role: ROLE_TYPES.SHADOW, team: TEAM_TYPES.SHADOW })),
    { role: ROLE_TYPES.SUPREME_SHADOW, team: TEAM_TYPES.SHADOW }
  ];

  const shuffledPlayers = shuffle(room.players);
  const shuffledRoles = shuffle(roles);
  shuffledPlayers.forEach((player, index) => {
    player.role = shuffledRoles[index].role;
    player.team = shuffledRoles[index].team;
    player.isAlive = true;
  });

  room.startedAt = nowIso();
  room.status = 'in_game';
  room.board = { council: 0, shadow: 0 };
  room.state = createInitialGameState();
  room.state.drawPile = createPolicyDeck();
  room.state.discardPile = [];
  room.state.phase = GAME_PHASES.NOMINATION;
  room.state.presidencyIndex = 0;
  room.state.currentPresidentId = room.players[0].id;
  room.log = ['Game started. President must nominate a Chancellor.'];
}

export function getRoleKnowledge(room, playerId) {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;
  const others = room.players.filter((p) => p.id !== playerId);

  if (player.role === ROLE_TYPES.COUNCIL) {
    return {
      role: player.role,
      team: player.team,
      knownAllies: []
    };
  }

  if (room.players.length <= 6 && player.role === ROLE_TYPES.SUPREME_SHADOW) {
    return {
      role: player.role,
      team: player.team,
      knownAllies: others.filter((p) => p.team === TEAM_TYPES.SHADOW).map(publicPlayerIdentity)
    };
  }

  if (player.team === TEAM_TYPES.SHADOW) {
    return {
      role: player.role,
      team: player.team,
      knownAllies: others.filter((p) => p.team === TEAM_TYPES.SHADOW && p.role !== ROLE_TYPES.SUPREME_SHADOW).map(publicPlayerIdentity),
      knownSupremeShadow: room.players.find((p) => p.role === ROLE_TYPES.SUPREME_SHADOW)?.id ?? null
    };
  }

  return {
    role: player.role,
    team: player.team,
    knownAllies: []
  };
}

function publicPlayerIdentity(player) {
  return { id: player.id, name: player.name, role: player.role };
}

export function getRoomSnapshot(room, viewerPlayerId) {
  const phase = room.state.phase;
  return {
    roomCode: room.code,
    status: room.status,
    phase,
    hostPlayerId: room.hostPlayerId,
    players: room.players.map((p) => {
      const playerState = buildPlayerState(p);
      playerState.isPresident = room.state.currentPresidentId === p.id;
      playerState.isChancellor = room.state.currentChancellorId === p.id;
      return {
        id: playerState.id,
        name: playerState.name,
        connected: playerState.connected,
        isHost: playerState.isHost,
        isAlive: playerState.isAlive,
        canVote: playerState.canVote,
        isPresident: playerState.isPresident,
        isChancellor: playerState.isChancellor,
        isYou: p.id === viewerPlayerId,
        isEligibleForChancellor: canBeChancellor(room, p.id)
      };
    }),
    board: room.board,
    electionTracker: room.state.electionTracker,
    drawPileCount: room.state.drawPile.length,
    discardPileCount: room.state.discardPile.length,
    currentPresidentId: room.state.currentPresidentId,
    nominatedChancellorId: room.state.nominatedChancellorId,
    currentChancellorId: room.state.currentChancellorId,
    previousPresidentId: room.state.previousPresidentId,
    previousChancellorId: room.state.previousChancellorId,
    log: room.log.slice(0, 12),
    pendingPower: room.state.pendingPower,
    winner: room.winner,
    myVoteSubmitted: Boolean(room.state.votes[viewerPlayerId]),
    myInvestigations: room.state.investigatedPlayers[viewerPlayerId] ?? {},
    lastPolicy: room.state.lastPolicy,
    canStart: canStartGame(room, viewerPlayerId),
    minimumReached: room.players.length >= MIN_PLAYERS,
    privateRoleInfo: room.status === 'in_game' || room.status === GAME_PHASES.GAME_OVER
      ? getRoleKnowledge(room, viewerPlayerId)
      : null
  };
}

function canBeChancellor(room, playerId) {
  const player = room.players.find((p) => p.id === playerId);
  if (!player || !player.isAlive) return false;
  if (playerId === room.state.currentPresidentId) return false;
  if (room.players.length > 5 && playerId === room.state.previousChancellorId) return false;
  if (room.players.length > 5 && playerId === room.state.previousPresidentId) return false;
  return true;
}

export function nominateChancellor(room, presidentPlayerId, targetPlayerId) {
  if (room.state.phase !== GAME_PHASES.NOMINATION) throw new Error('Not nomination phase.');
  if (room.state.currentPresidentId !== presidentPlayerId) throw new Error('Only the current President can nominate.');
  if (!canBeChancellor(room, targetPlayerId)) throw new Error('Target cannot be nominated right now.');

  room.state.nominatedChancellorId = targetPlayerId;
  room.state.phase = GAME_PHASES.VOTING;
  room.state.votes = {};
  const president = room.players.find((p) => p.id === presidentPlayerId);
  const chancellor = room.players.find((p) => p.id === targetPlayerId);
  room.log.unshift(`${president.name} nominated ${chancellor.name} as Chancellor.`);
}

export function castVote(room, playerId, vote) {
  if (room.state.phase !== GAME_PHASES.VOTING) throw new Error('Voting is not active.');
  const player = room.players.find((p) => p.id === playerId);
  if (!player || !player.isAlive) throw new Error('Only alive players may vote.');
  if (room.state.votes[playerId]) throw new Error('Vote already submitted.');
  if (!['ja', 'nein'].includes(vote)) throw new Error('Invalid vote.');

  room.state.votes[playerId] = vote;
  const alivePlayers = room.players.filter((p) => p.isAlive);
  if (Object.keys(room.state.votes).length === alivePlayers.length) {
    resolveVote(room);
    return { resolved: true };
  }
  return { resolved: false };
}

function resolveVote(room) {
  const alivePlayers = room.players.filter((p) => p.isAlive);
  const results = alivePlayers.map((p) => ({ id: p.id, name: p.name, vote: room.state.votes[p.id] ?? 'nein' }));
  const yesVotes = results.filter((v) => v.vote === 'ja').length;
  const passed = yesVotes > alivePlayers.length / 2;
  room.state.lastVotes = results;

  if (!passed) {
    room.state.electionTracker += 1;
    room.log.unshift(`Vote failed (${yesVotes}/${alivePlayers.length} Ja). Election tracker is now ${room.state.electionTracker}.`);
    room.state.nominatedChancellorId = null;
    room.state.votes = {};
    if (room.state.electionTracker >= ELECTION_TRACKER_LIMIT) {
      topDeckPolicy(room);
      return;
    }
    advancePresidency(room, false);
    return;
  }

  room.state.currentChancellorId = room.state.nominatedChancellorId;
  room.state.previousPresidentId = room.state.currentPresidentId;
  room.state.previousChancellorId = room.state.currentChancellorId;
  room.state.electionTracker = 0;
  room.state.votes = {};

  const chancellor = room.players.find((p) => p.id === room.state.currentChancellorId);
  if (room.board.shadow >= 3 && chancellor?.role === ROLE_TYPES.SUPREME_SHADOW) {
    endGame(room, 'shadow', 'The Supreme Shadow was elected Chancellor after three Shadow policies.');
    return;
  }

  room.state.phase = GAME_PHASES.LEGISLATIVE_PRESIDENT;
  room.state.legislative.presidentHand = drawPolicies(room.state, 3);
  room.log.unshift(`Government approved. ${chancellor?.name ?? 'Chancellor'} awaits legislation.`);
}

function topDeckPolicy(room) {
  room.state.electionTracker = 0;
  const [policy] = drawPolicies(room.state, 1);
  enactPolicy(room, policy, true);
}

export function presidentDiscard(room, presidentPlayerId, discardIndex) {
  if (room.state.phase !== GAME_PHASES.LEGISLATIVE_PRESIDENT) throw new Error('President is not choosing right now.');
  if (room.state.currentPresidentId !== presidentPlayerId) throw new Error('Only the current President may discard.');
  const hand = room.state.legislative.presidentHand;
  if (!Number.isInteger(discardIndex) || discardIndex < 0 || discardIndex >= hand.length) {
    throw new Error('Invalid policy selection.');
  }
  const [discarded] = hand.splice(discardIndex, 1);
  room.state.discardPile.push(discarded);
  room.state.legislative.chancellorHand = [...hand];
  room.state.legislative.presidentHand = [];
  room.state.phase = GAME_PHASES.LEGISLATIVE_CHANCELLOR;
  room.log.unshift('President passed two policies to the Chancellor.');
}

export function chancellorEnact(room, chancellorPlayerId, enactIndex) {
  if (room.state.phase !== GAME_PHASES.LEGISLATIVE_CHANCELLOR) throw new Error('Chancellor is not choosing right now.');
  if (room.state.currentChancellorId !== chancellorPlayerId) throw new Error('Only the current Chancellor may enact.');
  const hand = room.state.legislative.chancellorHand;
  if (!Number.isInteger(enactIndex) || enactIndex < 0 || enactIndex >= hand.length) {
    throw new Error('Invalid policy selection.');
  }

  const enacted = hand.splice(enactIndex, 1)[0];
  const discarded = hand[0];
  if (discarded) room.state.discardPile.push(discarded);
  room.state.legislative.chancellorHand = [];
  enactPolicy(room, enacted, false);
}

function enactPolicy(room, policy, wasTopDeck) {
  room.state.lastPolicy = policy;
  if (policy === POLICY_TYPES.LIBERAL) {
    room.board.council += 1;
    room.log.unshift(`A Council policy was enacted${wasTopDeck ? ' from the top deck' : ''}.`);
    if (room.board.council >= LIBERAL_POLICIES_TO_WIN) {
      endGame(room, 'council', 'Five Council policies have been enacted.');
      return;
    }
    finishRound(room);
    return;
  }

  room.board.shadow += 1;
  room.log.unshift(`A Shadow policy was enacted${wasTopDeck ? ' from the top deck' : ''}.`);
  if (room.board.shadow >= SHADOW_POLICIES_TO_WIN) {
    endGame(room, 'shadow', 'Six Shadow policies have been enacted.');
    return;
  }

  const power = getPowerForShadowPolicy(room.players.length, room.board.shadow);
  if (power) {
    room.state.pendingPower = power;
    room.state.phase = GAME_PHASES.PRESIDENT_POWER;
    room.log.unshift(`President power unlocked: ${power}.`);
    return;
  }
  finishRound(room);
}

function getPowerForShadowPolicy(playerCount, shadowCount) {
  if (playerCount <= 6) {
    if (shadowCount === 3) return 'policy_peek';
    if (shadowCount >= 4) return 'eliminate';
    return null;
  }
  if (playerCount <= 8) {
    if (shadowCount === 2) return 'investigate';
    if (shadowCount === 3) return 'special_election';
    if (shadowCount >= 4) return 'eliminate';
    return null;
  }
  if (shadowCount <= 2) return 'investigate';
  if (shadowCount === 3) return 'special_election';
  if (shadowCount >= 4) return 'eliminate';
  return null;
}

export function resolvePresidentPower(room, presidentPlayerId, payload) {
  if (room.state.phase !== GAME_PHASES.PRESIDENT_POWER) throw new Error('No power is pending.');
  if (room.state.currentPresidentId !== presidentPlayerId) throw new Error('Only the President may use this power.');

  const power = room.state.pendingPower;
  if (power === 'policy_peek') {
    room.log.unshift('President peeked at the top three policies.');
    room.state.pendingPower = null;
    finishRound(room);
    return { type: 'policy_peek', cards: room.state.drawPile.slice(0, 3) };
  }

  const targetId = payload?.targetPlayerId;
  const target = room.players.find((p) => p.id === targetId);
  if (!target || !target.isAlive || target.id === presidentPlayerId) {
    throw new Error('Invalid target for presidential power.');
  }

  if (power === 'investigate') {
    room.state.investigatedPlayers[presidentPlayerId] ??= {};
    room.state.investigatedPlayers[presidentPlayerId][targetId] = target.team;
    room.log.unshift(`President investigated ${target.name}.`);
    room.state.pendingPower = null;
    finishRound(room);
    return { type: 'investigate', targetId, team: target.team };
  }

  if (power === 'special_election') {
    room.state.pendingPower = null;
    room.state.currentPresidentId = targetId;
    room.state.nominatedChancellorId = null;
    room.state.currentChancellorId = null;
    room.state.phase = GAME_PHASES.NOMINATION;
    room.log.unshift(`${target.name} was selected for a special election.`);
    return { type: 'special_election', targetId };
  }

  if (power === 'eliminate') {
    target.isAlive = false;
    room.log.unshift(`${target.name} was eliminated.`);
    room.state.pendingPower = null;
    if (target.role === ROLE_TYPES.SUPREME_SHADOW) {
      endGame(room, 'council', 'The Supreme Shadow was eliminated.');
      return { type: 'eliminate', targetId, ended: true };
    }
    finishRound(room);
    return { type: 'eliminate', targetId, ended: false };
  }

  throw new Error('Unsupported power.');
}

function finishRound(room) {
  room.state.nominatedChancellorId = null;
  room.state.currentChancellorId = null;
  room.state.pendingPower = null;
  room.state.votes = {};
  advancePresidency(room, true);
}

function advancePresidency(room, normalAdvance) {
  room.state.phase = GAME_PHASES.NOMINATION;
  const alivePlayers = room.players.filter((p) => p.isAlive);
  if (alivePlayers.length < 2) {
    endGame(room, 'shadow', 'Too few Council members remain alive.');
    return;
  }

  if (!normalAdvance && room.state.currentPresidentId) {
    const currentIdx = room.players.findIndex((p) => p.id === room.state.currentPresidentId);
    let idx = currentIdx;
    do {
      idx = (idx + 1) % room.players.length;
    } while (!room.players[idx].isAlive);
    room.state.currentPresidentId = room.players[idx].id;
    room.log.unshift(`${room.players[idx].name} is the new President.`);
    return;
  }

  let idx = room.players.findIndex((p) => p.id === room.state.currentPresidentId);
  do {
    idx = (idx + 1) % room.players.length;
  } while (!room.players[idx].isAlive);
  room.state.currentPresidentId = room.players[idx].id;
  room.log.unshift(`${room.players[idx].name} is the new President.`);
}

function endGame(room, winner, reason) {
  room.status = GAME_PHASES.GAME_OVER;
  room.state.phase = GAME_PHASES.GAME_OVER;
  room.winner = { side: winner, reason };
  room.log.unshift(`Game over: ${reason}`);
}

export function getPresidentPrivateState(room, playerId) {
  if (room.state.currentPresidentId !== playerId) return null;
  if (room.state.phase === GAME_PHASES.LEGISLATIVE_PRESIDENT) {
    return {
      type: 'legislative_president',
      cards: room.state.legislative.presidentHand
    };
  }
  if (room.state.phase === GAME_PHASES.PRESIDENT_POWER && room.state.pendingPower === 'policy_peek') {
    return {
      type: 'policy_peek_prompt',
      cards: room.state.drawPile.slice(0, 3)
    };
  }
  return null;
}

export function getChancellorPrivateState(room, playerId) {
  if (room.state.currentChancellorId !== playerId) return null;
  if (room.state.phase === GAME_PHASES.LEGISLATIVE_CHANCELLOR) {
    return {
      type: 'legislative_chancellor',
      cards: room.state.legislative.chancellorHand
    };
  }
  return null;
}
