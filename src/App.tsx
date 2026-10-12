import { useState, useEffect, useCallback, useRef } from 'react';

// Types
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type Difficulty = 'easy' | 'normal' | 'hard';
type GameState = 'idle' | 'playing' | 'paused' | 'gameover';

// Constants
const GRID_SIZE = 20;
const SPEEDS: Record<Difficulty, number> = {
  easy: 150,
  normal: 100,
  hard: 65,
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Fácil',
  normal: 'Normal',
  hard: 'Difícil',
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: 'bg-green-100 text-green-700 border-green-200',
  normal: 'bg-blue-100 text-blue-700 border-blue-200',
  hard: 'bg-red-100 text-red-700 border-red-200',
};

// Helper functions
function getRandomPosition(snake: Position[]): Position {
  let pos: Position;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (snake.some(segment => segment.x === pos.x && segment.y === pos.y));
  return pos;
}

function getInitialSnake(): Position[] {
  const mid = Math.floor(GRID_SIZE / 2);
  return [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
}

// Main App Component
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState(400);
  const [snake, setSnake] = useState<Position[]>(getInitialSnake());
  const [food, setFood] = useState<Position>({ x: 15, y: 10 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [gameState, setGameState] = useState<GameState>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('snake-high-score');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [showSettings, setShowSettings] = useState(false);

  const directionRef = useRef<Direction>('RIGHT');
  const gameStateRef = useRef<GameState>('idle');
  const snakeRef = useRef<Position[]>(getInitialSnake());
  const foodRef = useRef<Position>({ x: 15, y: 10 });
  const scoreRef = useRef(0);
  const gameLoopRef = useRef<number | null>(null);
  const lastDirectionRef = useRef<Direction>('RIGHT');

  // Sync refs
  useEffect(() => { directionRef.current = direction; }, [direction]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { snakeRef.current = snake; }, [snake]);
  useEffect(() => { foodRef.current = food; }, [food]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  // Responsive canvas sizing
  useEffect(() => {
    const updateSize = () => {
      const maxSize = Math.min(window.innerWidth - 32, window.innerHeight - 280, 500);
      const size = Math.max(280, Math.floor(maxSize / GRID_SIZE) * GRID_SIZE);
      setCanvasSize(size);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Draw game
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = canvasSize / GRID_SIZE;

    // Clear canvas with light background
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Draw grid
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.8;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvasSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvasSize, i * cellSize);
      ctx.stroke();
    }

    // Draw food with glow effect
    const foodX = foodRef.current.x * cellSize + cellSize / 2;
    const foodY = foodRef.current.y * cellSize + cellSize / 2;
    const foodRadius = cellSize * 0.4;

    ctx.save();
    ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(foodX, foodY, foodRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.restore();

    // Food shine
    ctx.beginPath();
    ctx.arc(foodX - foodRadius * 0.3, foodY - foodRadius * 0.3, foodRadius * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();

    // Draw snake
    const currentSnake = snakeRef.current;
    currentSnake.forEach((segment, index) => {
      const x = segment.x * cellSize;
      const y = segment.y * cellSize;
      const padding = 1;
      const radius = index === 0 ? cellSize * 0.15 : cellSize * 0.1;

      // Snake body gradient
      const isHead = index === 0;
      const alpha = 1 - (index / currentSnake.length) * 0.3;

      ctx.save();
      if (isHead) {
        ctx.shadowColor = 'rgba(22, 163, 74, 0.3)';
        ctx.shadowBlur = 6;
      }

      // Rounded rectangle for each segment
      ctx.beginPath();
      ctx.roundRect(
        x + padding,
        y + padding,
        cellSize - padding * 2,
        cellSize - padding * 2,
        radius
      );

      if (isHead) {
        ctx.fillStyle = '#16a34a';
      } else {
        ctx.fillStyle = `rgba(34, 197, 94, ${alpha})`;
      }
      ctx.fill();
      ctx.restore();

      // Draw eyes on head
      if (isHead) {
        const dir = directionRef.current;
        let eye1X: number, eye1Y: number, eye2X: number, eye2Y: number;
        const eyeSize = cellSize * 0.12;
        const eyeOffset = cellSize * 0.25;
        const centerX = x + cellSize / 2;
        const centerY = y + cellSize / 2;

        switch (dir) {
          case 'RIGHT':
            eye1X = centerX + eyeOffset * 0.5; eye1Y = centerY - eyeOffset;
            eye2X = centerX + eyeOffset * 0.5; eye2Y = centerY + eyeOffset;
            break;
          case 'LEFT':
            eye1X = centerX - eyeOffset * 0.5; eye1Y = centerY - eyeOffset;
            eye2X = centerX - eyeOffset * 0.5; eye2Y = centerY + eyeOffset;
            break;
          case 'UP':
            eye1X = centerX - eyeOffset; eye1Y = centerY - eyeOffset * 0.5;
            eye2X = centerX + eyeOffset; eye2Y = centerY - eyeOffset * 0.5;
            break;
          case 'DOWN':
            eye1X = centerX - eyeOffset; eye1Y = centerY + eyeOffset * 0.5;
            eye2X = centerX + eyeOffset; eye2Y = centerY + eyeOffset * 0.5;
            break;
        }

        ctx.beginPath();
        ctx.arc(eye1X!, eye1Y!, eyeSize, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eye2X!, eye2Y!, eyeSize, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();

        // Pupils
        ctx.beginPath();
        ctx.arc(eye1X!, eye1Y!, eyeSize * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eye2X!, eye2Y!, eyeSize * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
      }
    });
  }, [canvasSize]);

  // Game loop
  const gameLoop = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;

    const currentSnake = [...snakeRef.current];
    const head = { ...currentSnake[0] };
    const dir = directionRef.current;
    lastDirectionRef.current = dir;

    // Move head
    switch (dir) {
      case 'UP': head.y -= 1; break;
      case 'DOWN': head.y += 1; break;
      case 'LEFT': head.x -= 1; break;
      case 'RIGHT': head.x += 1; break;
    }

    // Check wall collision
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      setGameState('gameover');
      if (scoreRef.current > highScore) {
        setHighScore(scoreRef.current);
        localStorage.setItem('snake-high-score', scoreRef.current.toString());
      }
      return;
    }

    // Check self collision
    if (currentSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
      setGameState('gameover');
      if (scoreRef.current > highScore) {
        setHighScore(scoreRef.current);
        localStorage.setItem('snake-high-score', scoreRef.current.toString());
      }
      return;
    }

    // Add new head
    currentSnake.unshift(head);

    // Check food collision
    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      const newScore = scoreRef.current + 10;
      setScore(newScore);
      setFood(getRandomPosition(currentSnake));
    } else {
      currentSnake.pop();
    }

    setSnake([...currentSnake]);
    draw();
  }, [draw, highScore]);

  // Start/stop game loop
  useEffect(() => {
    if (gameState === 'playing') {
      const interval = setInterval(gameLoop, SPEEDS[difficulty]);
      gameLoopRef.current = interval as unknown as number;
      return () => clearInterval(interval);
    } else {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    }
  }, [gameState, difficulty, gameLoop]);

  // Draw on state changes
  useEffect(() => {
    draw();
  }, [snake, food, draw]);

  // Change direction
  const changeDirection = useCallback((newDir: Direction) => {
    const opposites: Record<Direction, Direction> = {
      UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT'
    };
    if (opposites[newDir] !== lastDirectionRef.current) {
      setDirection(newDir);
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
          e.preventDefault();
          if (gameStateRef.current === 'playing') changeDirection('UP');
          break;
        case 'ArrowDown': case 's': case 'S':
          e.preventDefault();
          if (gameStateRef.current === 'playing') changeDirection('DOWN');
          break;
        case 'ArrowLeft': case 'a': case 'A':
          e.preventDefault();
          if (gameStateRef.current === 'playing') changeDirection('LEFT');
          break;
        case 'ArrowRight': case 'd': case 'D':
          e.preventDefault();
          if (gameStateRef.current === 'playing') changeDirection('RIGHT');
          break;
        case ' ':
          e.preventDefault();
          if (gameStateRef.current === 'playing') {
            setGameState('paused');
          } else if (gameStateRef.current === 'paused') {
            setGameState('playing');
          } else if (gameStateRef.current === 'idle' || gameStateRef.current === 'gameover') {
            startGame();
          }
          break;
        case 'r': case 'R':
          e.preventDefault();
          startGame();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeDirection]);

  // Touch/Swipe controls
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const minSwipe = 30;

      if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;

      if (Math.abs(dx) > Math.abs(dy)) {
        changeDirection(dx > 0 ? 'RIGHT' : 'LEFT');
      } else {
        changeDirection(dy > 0 ? 'DOWN' : 'UP');
      }
      touchStartRef.current = null;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [changeDirection]);

  // Game functions
  const startGame = () => {
    const initialSnake = getInitialSnake();
    setSnake(initialSnake);
    setFood(getRandomPosition(initialSnake));
    setDirection('RIGHT');
    lastDirectionRef.current = 'RIGHT';
    setScore(0);
    setGameState('playing');
  };

  const togglePause = () => {
    if (gameState === 'playing') setGameState('paused');
    else if (gameState === 'paused') setGameState('playing');
  };

  const resetGame = () => {
    setGameState('idle');
    const initialSnake = getInitialSnake();
    setSnake(initialSnake);
    setFood(getRandomPosition(initialSnake));
    setDirection('RIGHT');
    lastDirectionRef.current = 'RIGHT';
    setScore(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-lg mb-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
            <span className="text-3xl">🐍</span> Snake
          </h1>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="btn-game p-2 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md text-slate-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm animate-fade-in">
            <p className="text-sm font-medium text-slate-600 mb-2">Dificuldade</p>
            <div className="flex gap-2">
              {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => { setDifficulty(d); if (gameState === 'idle') resetGame(); }}
                  className={`btn-game flex-1 py-2 px-3 rounded-xl text-sm font-medium border transition-all ${
                    difficulty === d
                      ? DIFFICULTY_COLORS[d] + ' shadow-sm'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {DIFFICULTY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Score Board */}
      <div className="w-full max-w-lg mb-3 flex justify-between items-center animate-slide-up">
        <div className="flex items-center gap-4">
          <div className="bg-white rounded-xl px-4 py-2 border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block">Pontuação</span>
            <span className="text-xl font-bold text-slate-800">{score}</span>
          </div>
          <div className="bg-white rounded-xl px-4 py-2 border border-amber-200 shadow-sm">
            <span className="text-xs text-amber-600 block">🏆 Recorde</span>
            <span className="text-xl font-bold text-amber-700">{highScore}</span>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-xs font-medium border ${DIFFICULTY_COLORS[difficulty]}`}>
          {DIFFICULTY_LABELS[difficulty]}
        </div>
      </div>

      {/* Game Board */}
      <div ref={containerRef} className="relative animate-fade-in">
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          className="game-canvas"
          style={{ width: canvasSize, height: canvasSize }}
        />

        {/* Overlay States */}
        {gameState === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl animate-fade-in">
            <div className="text-5xl mb-3 animate-bounce-in">🐍</div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Jogo da Cobra</h2>
            <p className="text-sm text-slate-500 mb-4">Use as setas ou deslize para jogar</p>
            <button
              onClick={startGame}
              className="btn-game px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-200 transition-all"
            >
              ▶ Jogar
            </button>
            <p className="text-xs text-slate-400 mt-3">ou pressione Espaço</p>
          </div>
        )}

        {gameState === 'paused' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl animate-fade-in">
            <div className="text-4xl mb-3">⏸️</div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Pausado</h2>
            <button
              onClick={togglePause}
              className="btn-game px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-200 transition-all"
            >
              ▶ Continuar
            </button>
            <p className="text-xs text-slate-400 mt-3">ou pressione Espaço</p>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/85 backdrop-blur-sm rounded-xl animate-fade-in">
            <div className="text-4xl mb-2 animate-bounce-in">💀</div>
            <h2 className="text-xl font-bold text-slate-800 mb-1">Fim de Jogo!</h2>
            <p className="text-3xl font-bold text-emerald-600 mb-1">{score} pts</p>
            {score >= highScore && score > 0 && (
              <p className="text-sm text-amber-600 font-medium mb-2 animate-bounce-in">🏆 Novo Recorde!</p>
            )}
            <button
              onClick={startGame}
              className="btn-game px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-200 transition-all mt-2"
            >
              🔄 Jogar Novamente
            </button>
            <p className="text-xs text-slate-400 mt-2">ou pressione R</p>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="w-full max-w-lg mt-4 flex justify-between items-center animate-slide-up">
        <button
          onClick={togglePause}
          disabled={gameState !== 'playing' && gameState !== 'paused'}
          className="btn-game px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-medium text-sm shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {gameState === 'paused' ? '▶ Continuar' : '⏸ Pausa'}
        </button>
        <button
          onClick={resetGame}
          className="btn-game px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-medium text-sm shadow-sm hover:shadow-md transition-all"
        >
          🔄 Reiniciar
        </button>
      </div>

      {/* Mobile Touch Controls */}
      <div className="mt-4 md:hidden animate-slide-up">
        <div className="flex flex-col items-center gap-1">
          <button
            onTouchStart={(e) => { e.preventDefault(); changeDirection('UP'); }}
            className="touch-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <div className="flex gap-1">
            <button
              onTouchStart={(e) => { e.preventDefault(); changeDirection('LEFT'); }}
              className="touch-btn"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-14 h-14"></div>
            <button
              onTouchStart={(e) => { e.preventDefault(); changeDirection('RIGHT'); }}
              className="touch-btn"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <button
            onTouchStart={(e) => { e.preventDefault(); changeDirection('DOWN'); }}
            className="touch-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Footer hint */}
      <p className="hidden md:block mt-4 text-xs text-slate-400 animate-slide-up">
        Setas / WASD para mover • Espaço para pausar • R para reiniciar
      </p>
    </div>
  );
}
