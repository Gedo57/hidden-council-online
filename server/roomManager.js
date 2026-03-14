import { generateRoomCode } from './utils.js';
import {
  addPlayer,
  canStartGame,
  createRoom,
  markDisconnected,
  reconnectPlayer,
  removePlayerFromLobby,
  shouldDestroyRoom,
  startGame
} from './gameManager.js';

const rooms = new Map();
const playerRoomIndex = new Map();

export function createNewRoom(socketId, hostName, playerId) {
  const roomCode = generateRoomCode(new Set(rooms.keys()));
  const room = createRoom(roomCode, socketId, hostName, playerId);
  rooms.set(roomCode, room);
  playerRoomIndex.set(playerId, roomCode);
  return room;
}

export function getRoom(roomCode) {
  return rooms.get(roomCode);
}

export function getRoomByPlayerId(playerId) {
  const roomCode = playerRoomIndex.get(playerId);
  if (!roomCode) return null;
  return rooms.get(roomCode) ?? null;
}

export function joinRoom(roomCode, socketId, name, playerId) {
  const room = rooms.get(roomCode);
  if (!room) throw new Error('Room not found.');
  addPlayer(room, socketId, name, playerId);
  playerRoomIndex.set(playerId, roomCode);
  return room;
}

export function reconnectToRoom(roomCode, socketId, playerId) {
  const room = rooms.get(roomCode);
  if (!room) throw new Error('Room not found.');
  reconnectPlayer(room, socketId, playerId);
  playerRoomIndex.set(playerId, roomCode);
  return room;
}

export function disconnectSocket(socketId) {
  for (const [roomCode, room] of rooms.entries()) {
    const player = room.players.find((p) => p.socketId === socketId);
    if (!player) continue;

    if (room.status === 'lobby') {
      removePlayerFromLobby(room, socketId);
      playerRoomIndex.delete(player.id);
      if (shouldDestroyRoom(room)) {
        rooms.delete(roomCode);
      }
      return { roomCode, room: rooms.get(roomCode) ?? null, removed: true };
    }

    markDisconnected(room, socketId);
    return { roomCode, room, removed: false };
  }
  return null;
}

export function startRoomGame(roomCode, requesterPlayerId) {
  const room = rooms.get(roomCode);
  if (!room) throw new Error('Room not found.');
  if (!canStartGame(room, requesterPlayerId)) throw new Error('Only the host can start once 5-10 players are present.');
  startGame(room);
  return room;
}

export function listRooms() {
  return Array.from(rooms.values()).map((room) => ({
    code: room.code,
    playerCount: room.players.length,
    status: room.status
  }));
}
