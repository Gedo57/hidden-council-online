import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import {
  castVote,
  chancellorEnact,
  getChancellorPrivateState,
  getPresidentPrivateState,
  getRoomSnapshot,
  nominateChancellor,
  presidentDiscard,
  resolvePresidentPower
} from './gameManager.js';
import {
  createNewRoom,
  disconnectSocket,
  getRoom,
  joinRoom,
  reconnectToRoom,
  startRoomGame
} from './roomManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.resolve(__dirname, '../client');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(clientDir));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

function emitRoomState(room) {
  if (!room) return;
  room.players.forEach((player) => {
    if (!player.socketId) return;
    io.to(player.socketId).emit('room_state', {
      snapshot: getRoomSnapshot(room, player.id),
      privatePresidentState: getPresidentPrivateState(room, player.id),
      privateChancellorState: getChancellorPrivateState(room, player.id)
    });
  });
}

function emitError(socket, message) {
  socket.emit('action_error', { message });
}

io.on('connection', (socket) => {
  socket.on('create_room', ({ name, playerId }, cb = () => {}) => {
    try {
      const room = createNewRoom(socket.id, (name || '').trim() || 'Host', playerId);
      socket.join(room.code);
      emitRoomState(room);
      cb({ ok: true, roomCode: room.code });
    } catch (error) {
      cb({ ok: false, message: error.message });
    }
  });

  socket.on('join_room', ({ roomCode, name, playerId }, cb = () => {}) => {
    try {
      const room = joinRoom((roomCode || '').trim().toUpperCase(), socket.id, (name || '').trim(), playerId);
      socket.join(room.code);
      emitRoomState(room);
      cb({ ok: true, roomCode: room.code });
    } catch (error) {
      cb({ ok: false, message: error.message });
    }
  });

  socket.on('reconnect_room', ({ roomCode, playerId }, cb = () => {}) => {
    try {
      const room = reconnectToRoom((roomCode || '').trim().toUpperCase(), socket.id, playerId);
      socket.join(room.code);
      emitRoomState(room);
      cb({ ok: true, roomCode: room.code });
    } catch (error) {
      cb({ ok: false, message: error.message });
    }
  });

  socket.on('start_game', ({ roomCode, playerId }) => {
    try {
      const room = startRoomGame((roomCode || '').trim().toUpperCase(), playerId);
      emitRoomState(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('nominate_chancellor', ({ roomCode, playerId, targetPlayerId }) => {
    try {
      const room = getRoom((roomCode || '').trim().toUpperCase());
      if (!room) throw new Error('Room not found.');
      nominateChancellor(room, playerId, targetPlayerId);
      emitRoomState(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('cast_vote', ({ roomCode, playerId, vote }) => {
    try {
      const room = getRoom((roomCode || '').trim().toUpperCase());
      if (!room) throw new Error('Room not found.');
      castVote(room, playerId, vote);
      emitRoomState(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('president_discard', ({ roomCode, playerId, discardIndex }) => {
    try {
      const room = getRoom((roomCode || '').trim().toUpperCase());
      if (!room) throw new Error('Room not found.');
      presidentDiscard(room, playerId, discardIndex);
      emitRoomState(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('chancellor_enact', ({ roomCode, playerId, enactIndex }) => {
    try {
      const room = getRoom((roomCode || '').trim().toUpperCase());
      if (!room) throw new Error('Room not found.');
      chancellorEnact(room, playerId, enactIndex);
      emitRoomState(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('resolve_president_power', ({ roomCode, playerId, payload }) => {
    try {
      const room = getRoom((roomCode || '').trim().toUpperCase());
      if (!room) throw new Error('Room not found.');
      const result = resolvePresidentPower(room, playerId, payload);
      socket.emit('private_power_result', result);
      emitRoomState(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('disconnect', () => {
    const result = disconnectSocket(socket.id);
    if (result?.room) emitRoomState(result.room);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Hidden Council server running on port ${PORT}`);
});
