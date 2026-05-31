import { useState, useEffect, useRef } from 'react';
import { socket } from './socket';

const WIDTH = 800;
const HEIGHT = 500;
const PADDLE_W = 12;
const PADDLE_H = 90;
const BALL_R = 8;

export default function App() {
  const [view, setView] = useState('home');
  const [side, setSide] = useState(null);
  const [room, setRoom] = useState(null);
  const [state, setState] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    socket.on('joined', ({ code, side }) => {
      setSide(side);
      setView('lobby');
      setError('');
      setOpponentLeft(false);
    });
    socket.on('roomState', (r) => {
      setRoom(r);
      setState(r.state);
      if (r.state.running) {
        setView('game');
        setOpponentLeft(false);
      }
    });
    socket.on('state', (s) => setState(s));
    socket.on('error_msg', (m) => setError(m));
    socket.on('opponent_left', () => setOpponentLeft(true));

    return () => {
      socket.off('joined');
      socket.off('roomState');
      socket.off('state');
      socket.off('error_msg');
      socket.off('opponent_left');
    };
  }, []);

  useEffect(() => {
    if (view !== 'game') return;
    let current = null;
    const onDown = (e) => {
      const key = e.key.toLowerCase();
      let dir = null;
      if (key === 'arrowup' || key === 'w') dir = 'up';
      if (key === 'arrowdown' || key === 's') dir = 'down';
      if (dir && dir !== current) {
        current = dir;
        socket.emit('input', dir);
      }
    };
    const onUp = (e) => {
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'w', 's'].includes(key)) {
        current = null;
        socket.emit('input', null);
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [view]);

  useEffect(() => {
    if (view !== 'game' || !state) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    grad.addColorStop(0, '#0d0d0d');
    grad.addColorStop(1, '#070707');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.strokeStyle = 'rgba(201, 162, 74, 0.4)';
    ctx.setLineDash([6, 12]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2, 0);
    ctx.lineTo(WIDTH / 2, HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(201, 162, 74, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(WIDTH / 2, HEIGHT / 2, 60, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#F2E8D5';
    ctx.shadowColor = 'rgba(242, 232, 213, 0.4)';
    ctx.shadowBlur = 10;
    ctx.fillRect(0, state.paddles.left, PADDLE_W, PADDLE_H);
    ctx.fillRect(WIDTH - PADDLE_W, state.paddles.right, PADDLE_W, PADDLE_H);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#F4C26A';
    ctx.shadowColor = '#F4C26A';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [state, view]);

  function createRoom() {
    setError('');
    setOpponentLeft(false);
    socket.emit('create');
  }
  function joinRoom() {
    if (!joinCode || joinCode.length < 4) {
      setError('Enter a valid room code');
      return;
    }
    setError('');
    setOpponentLeft(false);
    socket.emit('join', joinCode);
  }
  function startGame() {
    socket.emit('start');
  }
  function rematch() {
    socket.emit('rematch');
  }
  function copyCode() {
    if (!room) return;
    navigator.clipboard.writeText(room.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="app">
      <header className="brand">
        <Logo />
        <div className="brand-text">
          <h1>Sandy Pong</h1>
          <span className="sub">A Luxury Rally</span>
        </div>
      </header>

      {view === 'home' && (
        <section className="panel">
          <h2>Play a Match</h2>
          <p className="muted">Invite only — create a code or enter one to join.</p>
          <button className="primary" onClick={createRoom}>Create Room</button>
          <div className="divider"><span>or</span></div>
          <div className="join-row">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
              placeholder="ROOM CODE"
              maxLength={5}
            />
            <button className="secondary" onClick={joinRoom}>Join</button>
          </div>
          {error && <p className="error">{error}</p>}
        </section>
      )}

      {view === 'lobby' && room && (
        <section className="panel">
          <h2>Room</h2>
          <button className="code-btn" onClick={copyCode} title="Copy code">
            <span className="code">{room.code}</span>
            <span className="copy-hint">{copied ? 'copied' : 'tap to copy'}</span>
          </button>
          <p className="muted">Share this code with your opponent</p>
          <div className="players">
            <div className={`player-card ${side === 'left' ? 'me' : ''}`}>
              <span className="player-side">Left</span>
              <span className="player-name">{room.players.left || 'Waiting…'}</span>
            </div>
            <div className={`player-card ${side === 'right' ? 'me' : ''}`}>
              <span className="player-side">Right</span>
              <span className="player-name">{room.players.right || 'Waiting…'}</span>
            </div>
          </div>
          {side === 'left' ? (
            <button
              className="primary"
              onClick={startGame}
              disabled={!room.players.left || !room.players.right}
            >
              {room.players.right ? 'Start Match' : 'Waiting for opponent…'}
            </button>
          ) : (
            <p className="muted small">The host will start the match.</p>
          )}
        </section>
      )}

      {view === 'game' && state && (
        <section className="game-panel">
          <div className="scoreboard">
            <div className="score">{state.scores.left}</div>
            <div className="score-label">Sandy Pong</div>
            <div className="score">{state.scores.right}</div>
          </div>
          <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="court" />
          <div className="controls">
            <span>Controls <kbd>W</kbd>/<kbd>S</kbd> or <kbd>↑</kbd>/<kbd>↓</kbd></span>
            <span>You are <strong>{side === 'left' ? 'Left' : 'Right'}</strong></span>
          </div>
          {state.winner && (
            <div className="winner-banner">
              <h3>{state.winner === side ? 'Victory' : 'Defeat'}</h3>
              <p className="muted">Final · {state.scores.left} – {state.scores.right}</p>
              {side === 'left' && (
                <button className="primary narrow" onClick={rematch}>Rematch</button>
              )}
              {side === 'right' && (
                <p className="muted small">Waiting for host to start a rematch…</p>
              )}
            </div>
          )}
          {opponentLeft && !state.winner && (
            <div className="winner-banner">
              <h3>Opponent left</h3>
              <p className="muted">Refresh to start a new match.</p>
            </div>
          )}
        </section>
      )}

      <footer className="foot">© Sandy Pong · est. 2026</footer>
    </div>
  );
}

function Logo() {
  return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="head" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4C26A" />
          <stop offset="1" stopColor="#8B5E1F" />
        </linearGradient>
        <linearGradient id="handle" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F2E8D5" />
          <stop offset="1" stopColor="#8a8170" />
        </linearGradient>
      </defs>
      <g transform="rotate(-30 32 32)">
        <ellipse cx="32" cy="22" rx="16" ry="18" fill="url(#head)" stroke="#F2E8D5" strokeWidth="1.2"/>
        <ellipse cx="32" cy="22" rx="11" ry="13" fill="#0a0a0a" opacity="0.35"/>
        <rect x="29" y="38" width="6" height="22" rx="3" fill="url(#handle)"/>
        <rect x="28" y="38" width="8" height="3" fill="#C9A24A"/>
      </g>
    </svg>
  );
}
