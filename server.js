import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

const WIDTH = 800;
const HEIGHT = 500;
const PADDLE_W = 12;
const PADDLE_H = 90;
const BALL_R = 8;
const PADDLE_SPEED = 7;
const WIN_SCORE = 7;

const rooms = new Map();

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? makeCode() : code;
}

function newGameState() {
  return {
    ball: {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      vx: 5 * (Math.random() < 0.5 ? -1 : 1),
      vy: Math.random() * 4 - 2,
    },
    paddles: { left: HEIGHT / 2 - PADDLE_H / 2, right: HEIGHT / 2 - PADDLE_H / 2 },
    scores: { left: 0, right: 0 },
    running: false,
    winner: null,
  };
}

function resetBall(state, dir) {
  state.ball.x = WIDTH / 2;
  state.ball.y = HEIGHT / 2;
  state.ball.vx = 5 * dir;
  state.ball.vy = Math.random() * 4 - 2;
}

function tick(room) {
  const s = room.state;
  if (!s.running) return;

  for (const side of ['left', 'right']) {
    const input = room.inputs[side];
    if (input === 'up') s.paddles[side] -= PADDLE_SPEED;
    if (input === 'down') s.paddles[side] += PADDLE_SPEED;
    s.paddles[side] = Math.max(0, Math.min(HEIGHT - PADDLE_H, s.paddles[side]));
  }

  s.ball.x += s.ball.vx;
  s.ball.y += s.ball.vy;

  if (s.ball.y - BALL_R < 0) {
    s.ball.y = BALL_R;
    s.ball.vy *= -1;
  }
  if (s.ball.y + BALL_R > HEIGHT) {
    s.ball.y = HEIGHT - BALL_R;
    s.ball.vy *= -1;
  }

  if (s.ball.x - BALL_R < PADDLE_W && s.ball.vx < 0) {
    if (s.ball.y > s.paddles.left && s.ball.y < s.paddles.left + PADDLE_H) {
      s.ball.x = PADDLE_W + BALL_R;
      s.ball.vx = -s.ball.vx * 1.05;
      const rel = (s.ball.y - (s.paddles.left + PADDLE_H / 2)) / (PADDLE_H / 2);
      s.ball.vy += rel * 2;
    }
  }
  if (s.ball.x + BALL_R > WIDTH - PADDLE_W && s.ball.vx > 0) {
    if (s.ball.y > s.paddles.right && s.ball.y < s.paddles.right + PADDLE_H) {
      s.ball.x = WIDTH - PADDLE_W - BALL_R;
      s.ball.vx = -s.ball.vx * 1.05;
      const rel = (s.ball.y - (s.paddles.right + PADDLE_H / 2)) / (PADDLE_H / 2);
      s.ball.vy += rel * 2;
    }
  }

  s.ball.vx = Math.max(-14, Math.min(14, s.ball.vx));
  s.ball.vy = Math.max(-10, Math.min(10, s.ball.vy));

  if (s.ball.x < -BALL_R) {
    s.scores.right++;
    if (s.scores.right >= WIN_SCORE) {
      s.winner = 'right';
      s.running = false;
    } else {
      resetBall(s, 1);
    }
  } else if (s.ball.x > WIDTH + BALL_R) {
    s.scores.left++;
    if (s.scores.left >= WIN_SCORE) {
      s.winner = 'left';
      s.running = false;
    } else {
      resetBall(s, -1);
    }
  }
}

function publicRoom(room) {
  return {
    code: room.code,
    players: {
      left: room.players.left ? room.names.left : null,
      right: room.players.right ? room.names.right : null,
    },
    state: room.state,
  };
}

io.on('connection', (socket) => {
  let currentRoom = null;
  let currentSide = null;

  socket.on('create', () => {
    const code = makeCode();
    const room = {
      code,
      players: { left: socket.id, right: null },
      names: { left: 'Player 1', right: null },
      inputs: { left: null, right: null },
      state: newGameState(),
    };
    rooms.set(code, room);
    socket.join(code);
    currentRoom = code;
    currentSide = 'left';
    socket.emit('joined', { code, side: 'left' });
    io.to(code).emit('roomState', publicRoom(room));
  });

  socket.on('join', (rawCode) => {
    const code = (rawCode || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) {
      socket.emit('error_msg', 'Room not found');
      return;
    }
    if (room.players.right) {
      socket.emit('error_msg', 'Room is full');
      return;
    }
    room.players.right = socket.id;
    room.names.right = 'Player 2';
    socket.join(code);
    currentRoom = code;
    currentSide = 'right';
    socket.emit('joined', { code, side: 'right' });
    io.to(code).emit('roomState', publicRoom(room));
  });

  socket.on('start', () => {
    const room = rooms.get(currentRoom);
    if (!room) return;
    if (!room.players.left || !room.players.right) return;
    room.state = newGameState();
    room.state.running = true;
    io.to(currentRoom).emit('roomState', publicRoom(room));
  });

  socket.on('input', (dir) => {
    const room = rooms.get(currentRoom);
    if (!room || !currentSide) return;
    if (dir === 'up' || dir === 'down' || dir === null) {
      room.inputs[currentSide] = dir;
    }
  });

  socket.on('rematch', () => {
    const room = rooms.get(currentRoom);
    if (!room) return;
    if (!room.players.left || !room.players.right) return;
    room.state = newGameState();
    room.state.running = true;
    io.to(currentRoom).emit('roomState', publicRoom(room));
  });

  socket.on('disconnect', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    if (room.players.left === socket.id) {
      room.players.left = null;
      room.names.left = null;
    }
    if (room.players.right === socket.id) {
      room.players.right = null;
      room.names.right = null;
    }
    if (!room.players.left && !room.players.right) {
      rooms.delete(currentRoom);
    } else {
      room.state.running = false;
      io.to(currentRoom).emit('roomState', publicRoom(room));
      io.to(currentRoom).emit('opponent_left');
    }
  });
});

setInterval(() => {
  for (const room of rooms.values()) {
    tick(room);
    if (room.state.running || room.state.winner) {
      io.to(room.code).emit('state', room.state);
    }
  }
}, 1000 / 60);

const PORT = process.env.PORT || 4000;

app.get('/', (req, res) => {
  res.type('text/plain').send('Sandy Pong server is awake.');
});

httpServer.listen(PORT, () => {
  console.log(`Sandy Pong server on port ${PORT}`);
});
