import { POLICY_TYPES, ROOM_CODE_LENGTH } from './constants.js';

export function generateRoomCode(existingCodes = new Set()) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: ROOM_CODE_LENGTH }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (existingCodes.has(code));
  return code;
}

export function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createPolicyDeck() {
  const deck = [];
  for (let i = 0; i < 6; i += 1) deck.push(POLICY_TYPES.LIBERAL);
  for (let i = 0; i < 11; i += 1) deck.push(POLICY_TYPES.SHADOW);
  return shuffle(deck);
}

export function drawPolicies(state, count) {
  if (state.drawPile.length < count) {
    state.drawPile = shuffle([...state.drawPile, ...state.discardPile]);
    state.discardPile = [];
  }
  const drawn = state.drawPile.splice(0, count);
  return drawn;
}

export function rolesForPlayerCount(playerCount) {
  switch (playerCount) {
    case 5:
    case 6:
      return { liberals: playerCount - 2, shadows: 1, supreme: 1 };
    case 7:
    case 8:
      return { liberals: playerCount - 3, shadows: 2, supreme: 1 };
    case 9:
    case 10:
      return { liberals: playerCount - 4, shadows: 3, supreme: 1 };
    default:
      throw new Error('Unsupported player count');
  }
}

export function nowIso() {
  return new Date().toISOString();
}
