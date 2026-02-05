
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import type { StudentProfile } from '../../types.ts';
import toast from 'react-hot-toast';
import { Modal } from '../../components/ui/Modal.tsx';

type Difficulty = 'easy' | 'moderate' | 'hard';

interface GameProps {
    onWin: () => void;
    difficulty: Difficulty;
    onGameOver?: () => void;
}

// --- SHARED COMPONENTS ---
const GameTimer = ({ duration, onTimeUp, isActive }: { duration: number, onTimeUp: () => void, isActive: boolean }) => {
    const [timeLeft, setTimeLeft] = useState(duration);

    useEffect(() => {
        setTimeLeft(duration);
    }, [duration]);

    useEffect(() => {
        if (!isActive) return;
        if (timeLeft <= 0) {
            onTimeUp();
            return;
        }
        const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
        return () => clearInterval(timer);
    }, [isActive, timeLeft, onTimeUp]);

    return (
        <div className={`font-mono text-xl font-bold ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-primary'}`}>
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </div>
    );
};

// --- GAME 1: MEMORY MATRIX ---
const MemoryMatrix = ({ onWin, difficulty, onGameOver }: GameProps) => {
    const [grid, setGrid] = useState<boolean[]>([]);
    const [pattern, setPattern] = useState<number[]>([]);
    const [userPath, setUserPath] = useState<number[]>([]);
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'idle' | 'showing' | 'playing'>('idle');

    const gridSize = difficulty === 'easy' ? 9 : difficulty === 'moderate' ? 16 : 25;
    const gridCols = Math.sqrt(gridSize);

    useEffect(() => {
        setGrid(Array(gridSize).fill(false));
    }, [gridSize]);

    const startGame = () => {
        setGameState('showing');
        const newPattern = [];
        const count = level + (difficulty === 'easy' ? 2 : difficulty === 'moderate' ? 3 : 4);
        for (let i = 0; i < count; i++) newPattern.push(Math.floor(Math.random() * gridSize));
        setPattern(newPattern);
        setUserPath([]);

        let i = 0;
        const speed = difficulty === 'easy' ? 800 : difficulty === 'moderate' ? 600 : 400;
        const interval = setInterval(() => {
            const tempGrid = Array(gridSize).fill(false);
            if (i < newPattern.length) {
                tempGrid[newPattern[i]] = true;
                setGrid(tempGrid);
                i++;
            } else {
                clearInterval(interval);
                setGrid(Array(gridSize).fill(false));
                setGameState('playing');
            }
        }, speed);
    };

    const handleCellClick = (index: number) => {
        if (gameState !== 'playing') return;
        const currentStep = userPath.length;
        if (index === pattern[currentStep]) {
            const newPath = [...userPath, index];
            setUserPath(newPath);
            // Flash Correct
            const tempGrid = [...grid];
            tempGrid[index] = true;
            setGrid(tempGrid);
            setTimeout(() => {
                const resetGrid = [...tempGrid];
                resetGrid[index] = false;
                setGrid(resetGrid);
            }, 200);

            if (newPath.length === pattern.length) {
                toast.success(`Level ${level} Complete!`);
                if (level >= 3) {
                    onWin();
                    setLevel(1);
                    setGameState('idle');
                } else {
                    setLevel(l => l + 1);
                    setGameState('idle'); // Wait for user to start next level
                }
            }
        } else {
            toast.error("Wrong tile!");
            if (onGameOver) onGameOver();
            setLevel(1);
            setGameState('idle');
        }
    };

    return (
        <div className="flex flex-col items-center">
            <div className="flex justify-between w-full mb-4 px-2 items-center">
                <span className="text-secondary font-bold">Level: {level}</span>
                <span className="text-text-muted">{gameState === 'showing' ? "Memorize..." : gameState === 'playing' ? "Repeat" : "Ready"}</span>
            </div>
            <div
                className="grid gap-2 mb-4 bg-black/50 p-4 rounded-lg border border-primary/20"
                style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
            >
                {grid.map((active, i) => (
                    <div
                        key={i}
                        onClick={() => handleCellClick(i)}
                        className={`w-12 h-12 md:w-16 md:h-16 rounded border cursor-pointer transition-all duration-200 ${active ? 'bg-primary shadow-[0_0_15px_#00ffff] scale-95' : 'bg-card-bg border-white/10 hover:border-primary/50'}`}
                    />
                ))}
            </div>
            {gameState === 'idle' && <Button onClick={startGame} className="w-full">Start Level {level}</Button>}
        </div>
    );
};

// --- GAME 2: APTITUDE BLITZ ---
const AptitudeBlitz = ({ onWin, difficulty, onGameOver }: GameProps) => {
    const [question, setQuestion] = useState("");
    const [correctAnswer, setCorrectAnswer] = useState<number>(0);
    const [userAnswer, setUserAnswer] = useState("");
    const [explanation, setExplanation] = useState("");
    const [streak, setStreak] = useState(0);
    const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
    const [gameActive, setGameActive] = useState(false);

    const timeLimit = difficulty === 'easy' ? 60 : difficulty === 'moderate' ? 45 : 30;

    const generateQuestion = () => {
        setFeedback(null);
        setUserAnswer("");
        setExplanation("");

        const types = ['percent', 'ratio', 'work', 'speed', 'series'];
        const type = types[Math.floor(Math.random() * types.length)];
        const multiplier = difficulty === 'easy' ? 1 : difficulty === 'moderate' ? 5 : 13;

        if (type === 'percent') {
            const percent = Math.floor(Math.random() * 10) * 5 + 5;
            const base = Math.floor(Math.random() * 20 * multiplier) * 5;
            setQuestion(`What is ${percent}% of ${base}?`);
            setCorrectAnswer((percent / 100) * base);
            setExplanation(`${percent}% means ${percent}/100.`);
        } else if (type === 'series') {
            const start = Math.floor(Math.random() * 10);
            const diff = Math.floor(Math.random() * 5 * multiplier) + 1;
            setQuestion(`Next in series: ${start}, ${start + diff}, ${start + diff * 2}, ...?`);
            setCorrectAnswer(start + diff * 3);
            setExplanation(`Common difference is ${diff}.`);
        } else {
            // Speed logic
            const dist = Math.floor(Math.random() * 5 + 2) * 60;
            const time = Math.floor(Math.random() * 3 + 2);
            setQuestion(`Car covers ${dist}km in ${time} hours. Speed (km/h)?`);
            setCorrectAnswer(dist / time);
            setExplanation(`Speed = Distance / Time.`);
        }
    };

    const startGame = () => {
        setGameActive(true);
        setStreak(0);
        generateQuestion();
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!gameActive || !userAnswer) return;

        const val = parseFloat(userAnswer);
        if (Math.abs(val - correctAnswer) < 0.1) {
            setStreak(s => s + 1);
            setFeedback("correct");
            if (streak + 1 >= (difficulty === 'easy' ? 3 : 5)) {
                onWin();
                toast.success("Round Cleared!");
                setGameActive(false);
            } else {
                setTimeout(generateQuestion, 1000);
            }
        } else {
            setFeedback("wrong");
            if (onGameOver) onGameOver();
            setGameActive(false);
        }
    };

    return (
        <div className="flex flex-col items-center w-full max-w-md mx-auto">
            <div className="flex justify-between w-full mb-4">
                <span className="text-secondary font-bold">Streak: {streak}</span>
                <GameTimer
                    duration={timeLimit}
                    isActive={gameActive}
                    onTimeUp={() => {
                        setGameActive(false);
                        toast.error("Time's Up!");
                        if (onGameOver) onGameOver();
                    }}
                />
            </div>

            <div className="w-full bg-card-bg border border-secondary/30 p-6 rounded-lg mb-4 min-h-[120px] flex items-center justify-center flex-col relative overflow-hidden">
                {!gameActive ? (
                    <Button onClick={startGame}>{feedback === 'wrong' || feedback === 'correct' ? 'Try Again' : 'Start Quiz'}</Button>
                ) : (
                    <>
                        <p className="text-xl font-medium text-center text-white z-10">{question}</p>
                        {feedback && (
                            <div className={`mt-4 p-3 w-full rounded border z-10 text-sm animate-fade-in-up ${feedback === 'correct' ? 'bg-green-500/20 border-green-500/50 text-green-200' : 'bg-red-500/20 border-red-500/50 text-red-200'}`}>
                                <p className="font-bold text-lg mb-1">{feedback === 'correct' ? "Correct!" : "Incorrect"}</p>
                                <p>Answer: {correctAnswer}</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {gameActive && (
                <form onSubmit={submit} className="flex gap-2 w-full">
                    <Input
                        type="number"
                        value={userAnswer}
                        onChange={e => setUserAnswer(e.target.value)}
                        placeholder="Answer..."
                        autoFocus
                        className="text-center text-xl"
                    />
                    <Button type="submit">Submit</Button>
                </form>
            )}
        </div>
    );
};

// --- GAME 3: TALLY NUMBUBBLES ---
const TallyNumbubbles = ({ onWin, difficulty, onGameOver }: GameProps) => {
    const [bubbles, setBubbles] = useState<{ id: number, val: number, text: string, x: number, y: number }[]>([]);
    const [currentQuestion, setCurrentQuestion] = useState("");
    const [correctAnswer, setCorrectAnswer] = useState(0);
    const [score, setScore] = useState(0);
    const [active, setActive] = useState(false);

    // Difficulty settings
    const bubbleCount = difficulty === 'easy' ? 6 : difficulty === 'moderate' ? 10 : 15;
    const timeLimit = difficulty === 'easy' ? 60 : difficulty === 'moderate' ? 45 : 30;
    const winScore = difficulty === 'easy' ? 5 : difficulty === 'moderate' ? 8 : 10;

    const generateRound = () => {
        // Generate equation
        const a = Math.floor(Math.random() * 20) + 1;
        const b = Math.floor(Math.random() * 20) + 1;
        const ops = ['+', '-'];
        const op = ops[Math.floor(Math.random() * ops.length)];

        let ans = 0;
        let qText = "";

        if (op === '+') { ans = a + b; qText = `${a} + ${b} = ?`; }
        else {
            const max = Math.max(a, b);
            const min = Math.min(a, b);
            ans = max - min;
            qText = `${max} - ${min} = ?`;
        }

        setCorrectAnswer(ans);
        setCurrentQuestion(qText);

        const newBubbles = [];
        // Ensure one correct answer exists
        newBubbles.push({
            id: 0, val: ans, text: ans.toString(),
            x: Math.random() * 80 + 10, y: Math.random() * 80 + 10
        });

        // Generate distractors
        for (let i = 1; i < bubbleCount; i++) {
            let fakeAns = ans + Math.floor(Math.random() * 10) - 5;
            if (fakeAns === ans) fakeAns += 1;
            newBubbles.push({
                id: i, val: fakeAns, text: fakeAns.toString(),
                x: Math.random() * 80 + 10, y: Math.random() * 80 + 10
            });
        }

        // Shuffle positions a bit randomly
        setBubbles(newBubbles.sort(() => Math.random() - 0.5));
    };

    const startGame = () => {
        setActive(true);
        setScore(0);
        generateRound();
    };

    const handlePop = (val: number) => {
        if (!active) return;

        if (val === correctAnswer) {
            toast.success("Correct!", { duration: 500 });
            setScore(s => {
                const newScore = s + 1;
                if (newScore >= winScore) {
                    setActive(false);
                    onWin();
                    toast.success("Challenge Complete!");
                } else {
                    generateRound();
                }
                return newScore;
            });
        } else {
            toast.error("Wrong!");
            setActive(false);
            if (onGameOver) onGameOver();
        }
    };

    return (
        <div className="flex flex-col items-center h-[500px] w-full relative">
            <div className="flex justify-between w-full mb-2 text-lg font-bold items-center px-4 bg-black/40 p-2 rounded-lg border border-white/10 z-10">
                <div className="flex flex-col">
                    <span className="text-secondary text-sm uppercase tracking-widest">Question</span>
                    <span className="font-mono text-2xl text-white">{currentQuestion || "Ready?"}</span>
                </div>
                <div className="text-right">
                    <span className="text-text-muted text-xs block">Score</span>
                    <span className="font-mono text-xl text-primary">{score}/{winScore}</span>
                </div>
                <GameTimer duration={timeLimit} isActive={active} onTimeUp={() => { setActive(false); toast.error("Time's Up!"); if (onGameOver) onGameOver(); }} />
            </div>

            <div className="relative w-full h-full bg-gradient-to-b from-black/60 to-black/20 rounded-lg border border-white/10 overflow-hidden">
                {active ? bubbles.map(b => (
                    <div
                        key={b.id}
                        onClick={() => handlePop(b.val)}
                        className={`absolute w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.1)] border border-white/20 bg-white/10 backdrop-blur-sm animate-float`}
                        style={{
                            left: `${b.x}%`,
                            top: `${b.y}%`,
                            animationDuration: `${Math.random() * 5 + 3}s`
                        }}
                    >
                        <span className="font-bold text-lg md:text-xl text-white pointer-events-none drop-shadow-md">{b.text}</span>
                    </div>
                )) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Button onClick={startGame} className="shadow-lg scale-110">Start Challenge</Button>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes float {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-20px); }
                    100% { transform: translateY(0px); }
                }
                .animate-float { animation-name: float; animation-iteration-count: infinite; animation-timing-function: ease-in-out; }
            `}</style>
        </div>
    );
};

// --- GAME 4: PATH FINDER ---
const PathFinder = ({ onWin, difficulty }: GameProps) => {
    const SIZE = 8;
    const [grid, setGrid] = useState<string[]>([]);
    const [playerPos, setPlayerPos] = useState(0);
    const [endPos, setEndPos] = useState(0);
    const [active, setActive] = useState(false);

    // Scoring State
    const [moves, setMoves] = useState(0);
    const [minMoves, setMinMoves] = useState(0);
    const [showResults, setShowResults] = useState(false);

    const getShortestPathLength = (start: number, end: number, walls: Set<number>) => {
        const q: { pos: number, dist: number }[] = [{ pos: start, dist: 0 }];
        const visited = new Set([start]);

        while (q.length > 0) {
            const { pos, dist } = q.shift()!;
            if (pos === end) return dist;

            const r = Math.floor(pos / SIZE);
            const c = pos % SIZE;
            const neighbors = [pos - SIZE, pos + SIZE, pos - 1, pos + 1].filter(n => {
                const nr = Math.floor(n / SIZE);
                const nc = n % SIZE;
                const isAdj = Math.abs(nr - r) + Math.abs(nc - c) === 1;
                return n >= 0 && n < SIZE * SIZE && isAdj && !walls.has(n) && !visited.has(n);
            });

            for (const n of neighbors) {
                visited.add(n);
                q.push({ pos: n, dist: dist + 1 });
            }
        }
        return -1;
    };

    const generateLevel = useCallback(() => {
        let attempts = 0;
        while (attempts < 50) {
            const walls = new Set<number>();
            const wallCount = difficulty === 'easy' ? 15 : difficulty === 'moderate' ? 25 : 35;
            while (walls.size < wallCount) walls.add(Math.floor(Math.random() * (SIZE * SIZE)));

            const start = 0;
            const end = SIZE * SIZE - 1;
            walls.delete(start); walls.delete(end);

            const optimalSteps = getShortestPathLength(start, end, walls);

            if (optimalSteps > 0) {
                const newGrid = Array(SIZE * SIZE).fill('.');
                walls.forEach(w => newGrid[w] = '#');
                newGrid[end] = 'E'; // Mark end
                setGrid(newGrid);
                setPlayerPos(start);
                setEndPos(end);
                setMinMoves(optimalSteps);
                setMoves(0);
                setShowResults(false);
                setActive(true);
                return;
            }
            attempts++;
        }
        toast.error("Generation failed. Retrying...");
    }, [difficulty]);

    const attemptMove = (targetIdx: number) => {
        if (!active || showResults) return;

        // Check if adjacent
        const r1 = Math.floor(playerPos / SIZE);
        const c1 = playerPos % SIZE;
        const r2 = Math.floor(targetIdx / SIZE);
        const c2 = targetIdx % SIZE;

        const isAdjacent = (Math.abs(r1 - r2) + Math.abs(c1 - c2)) === 1;
        const isWall = grid[targetIdx] === '#';

        if (isAdjacent && !isWall) {
            setPlayerPos(targetIdx);
            setMoves(m => m + 1);

            if (targetIdx === endPos) {
                // Game Over Logic
                setActive(false);
                setShowResults(true);
            }
        }
    };

    // Keyboard support
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (!active || showResults) return;
            let next = playerPos;
            if (e.key === 'ArrowUp' || e.key === 'w') next -= SIZE;
            if (e.key === 'ArrowDown' || e.key === 's') next += SIZE;
            if (e.key === 'ArrowLeft' || e.key === 'a') next -= 1;
            if (e.key === 'ArrowRight' || e.key === 'd') next += 1;

            if (next >= 0 && next < SIZE * SIZE) {
                attemptMove(next);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [active, playerPos, showResults]);

    const handleConfirmWin = () => {
        onWin();
        setShowResults(false);
        setActive(false);
    };

    return (
        <div className="flex flex-col items-center w-full relative min-h-[400px]">
            {showResults ? (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm rounded-lg p-6 animate-fade-in-up">
                    <h3 className="text-3xl font-display text-primary mb-4">Level Complete!</h3>

                    <div className="grid grid-cols-2 gap-4 w-full mb-6">
                        <div className="bg-card-bg p-3 rounded border border-white/10 text-center">
                            <span className="text-xs text-text-muted uppercase">Your Moves</span>
                            <p className={`text-2xl font-bold ${moves <= minMoves ? 'text-green-400' : 'text-yellow-400'}`}>{moves}</p>
                        </div>
                        <div className="bg-card-bg p-3 rounded border border-white/10 text-center">
                            <span className="text-xs text-text-muted uppercase">Optimal</span>
                            <p className="text-2xl font-bold text-secondary">{minMoves}</p>
                        </div>
                    </div>

                    <p className="text-sm text-text-muted mb-6">
                        {moves === minMoves ? "Perfect Path! Maximum Efficiency." : `You took ${moves - minMoves} extra steps.`}
                    </p>

                    <div className="flex gap-4">
                        <Button onClick={generateLevel} variant="secondary">Replay</Button>
                        <Button onClick={handleConfirmWin} variant="primary">Next Level</Button>
                    </div>
                </div>
            ) : null}

            <div className="flex justify-between w-full mb-2 px-2">
                <span className="text-text-muted">Moves: <span className="text-white font-bold">{moves}</span></span>
                <span className="text-primary font-bold">{active ? "Navigate to 🏁" : "Idle"}</span>
            </div>

            <div className="grid gap-1 mb-4 bg-black/50 p-2 rounded border border-white/10 select-none shadow-inner touch-manipulation"
                style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
                {grid.map((cell, i) => {
                    const isPlayer = i === playerPos;
                    const isWall = cell === '#';
                    const isEnd = i === endPos;

                    // Highlight valid moves
                    const r1 = Math.floor(playerPos / SIZE);
                    const c1 = playerPos % SIZE;
                    const r2 = Math.floor(i / SIZE);
                    const c2 = i % SIZE;
                    const isAdjacent = (Math.abs(r1 - r2) + Math.abs(c1 - c2)) === 1;
                    const isValidMove = active && isAdjacent && !isWall;

                    return (
                        <div
                            key={i}
                            onClick={() => attemptMove(i)}
                            className={`w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-sm transition-all duration-150 text-base md:text-lg font-bold cursor-pointer relative
                                ${isPlayer ? 'bg-primary text-black shadow-[0_0_15px_cyan] z-10 scale-110' :
                                    isEnd ? 'bg-green-500 text-black animate-pulse' :
                                        isWall ? 'bg-gray-800 border-gray-700' :
                                            isValidMove ? 'bg-white/10 hover:bg-white/20 border border-white/5' : 'bg-transparent'}
                            `}
                        >
                            {isPlayer && '🏃'}
                            {isEnd && !isPlayer && '🏁'}
                            {isValidMove && !isEnd && <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />}
                        </div>
                    );
                })}
            </div>

            {!active && !showResults && (
                <Button onClick={generateLevel} className="w-full max-w-xs shadow-secondary">Start Maze</Button>
            )}
        </div>
    );
};

// --- GAME 5: CODE BREAKER (Logic) ---
const CodeBreaker = ({ onWin, difficulty, onGameOver }: GameProps) => {
    const [secretCode, setSecretCode] = useState<string[]>([]);
    const [guesses, setGuesses] = useState<{ guess: string[], green: number, yellow: number }[]>([]);
    const [currentGuess, setCurrentGuess] = useState<string[]>([]);
    const [active, setActive] = useState(false);

    // Config based on difficulty
    const codeLength = difficulty === 'easy' ? 3 : 4;
    const maxDigits = difficulty === 'easy' ? 6 : difficulty === 'moderate' ? 8 : 9; // 1-6 or 1-9
    const maxAttempts = difficulty === 'easy' ? 8 : 10;

    const start = () => {
        const newCode = Array.from({ length: codeLength }, () => Math.floor(Math.random() * maxDigits + 1).toString());
        setSecretCode(newCode);
        setGuesses([]);
        setCurrentGuess([]);
        setActive(true);
    };

    const handleInput = (num: number) => {
        if (currentGuess.length < codeLength) {
            setCurrentGuess(prev => [...prev, num.toString()]);
        }
    };

    const handleDelete = () => {
        setCurrentGuess(prev => prev.slice(0, -1));
    };

    const checkGuess = () => {
        if (currentGuess.length !== codeLength) return;

        let green = 0;
        let yellow = 0;
        const codeCopy = [...secretCode];
        const guessCopy = [...currentGuess];

        // Check exact matches (Green)
        for (let i = 0; i < codeLength; i++) {
            if (guessCopy[i] === codeCopy[i]) {
                green++;
                codeCopy[i] = '#'; // Mark as used
                guessCopy[i] = '*';
            }
        }

        // Check partial matches (Yellow)
        for (let i = 0; i < codeLength; i++) {
            if (guessCopy[i] !== '*') {
                const index = codeCopy.indexOf(guessCopy[i]);
                if (index !== -1) {
                    yellow++;
                    codeCopy[index] = '#'; // Mark as used
                }
            }
        }

        const newHistory = [...guesses, { guess: currentGuess, green, yellow }];
        setGuesses(newHistory);
        setCurrentGuess([]);

        if (green === codeLength) {
            setActive(false);
            toast.success("Code Cracked!");
            onWin();
        } else if (newHistory.length >= maxAttempts) {
            setActive(false);
            toast.error(`Game Over! Code was ${secretCode.join('')}`);
            if (onGameOver) onGameOver();
        }
    };

    return (
        <div className="flex flex-col items-center w-full max-w-sm mx-auto">
            {!active && guesses.length === 0 && (
                <div className="text-center space-y-4 py-8">
                    <p className="text-text-muted">Crack the {codeLength}-digit code. Digits 1-{maxDigits}.</p>
                    <p className="text-xs text-green-400">Green = Correct Number & Position</p>
                    <p className="text-xs text-yellow-400">Yellow = Correct Number, Wrong Position</p>
                    <Button onClick={start}>Start Hacking</Button>
                </div>
            )}

            {(active || guesses.length > 0) && (
                <div className="w-full space-y-4">
                    <div className="h-64 overflow-y-auto custom-scrollbar bg-black/30 rounded border border-white/10 p-2 space-y-2">
                        {guesses.map((g, i) => (
                            <div key={i} className="flex justify-between items-center bg-white/5 p-2 rounded">
                                <span className="font-mono text-text-muted text-xs">#{i + 1}</span>
                                <div className="flex gap-1">
                                    {g.guess.map((digit, idx) => (
                                        <span key={idx} className="w-6 h-6 flex items-center justify-center bg-black/50 rounded border border-white/20 font-bold">{digit}</span>
                                    ))}
                                </div>
                                <div className="flex gap-1">
                                    {Array(g.green).fill(0).map((_, idx) => <div key={`g-${idx}`} className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_5px_lime]"></div>)}
                                    {Array(g.yellow).fill(0).map((_, idx) => <div key={`y-${idx}`} className="w-3 h-3 rounded-full bg-yellow-500"></div>)}
                                    {g.green === 0 && g.yellow === 0 && <span className="text-xs text-gray-600">-</span>}
                                </div>
                            </div>
                        ))}
                    </div>

                    {active && (
                        <>
                            <div className="flex justify-center gap-2 py-2">
                                {Array.from({ length: codeLength }).map((_, i) => (
                                    <div key={i} className="w-10 h-10 border-2 border-primary/50 rounded bg-black/40 flex items-center justify-center text-xl font-bold text-white">
                                        {currentGuess[i] || ''}
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-5 gap-2">
                                {Array.from({ length: maxDigits }).map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleInput(i + 1)}
                                        className="bg-card-bg border border-white/10 hover:bg-white/10 rounded py-3 font-bold text-lg active:scale-95 transition-transform"
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                                <button onClick={handleDelete} className="bg-red-500/20 text-red-300 border border-red-500/50 rounded col-span-2">⌫</button>
                                <button onClick={checkGuess} className="bg-primary/20 text-primary border border-primary/50 rounded col-span-3 font-bold">ENTER</button>
                            </div>
                        </>
                    )}

                    {!active && guesses.length > 0 && (
                        <Button onClick={start} className="w-full">Play Again</Button>
                    )}
                </div>
            )}
        </div>
    );
};

// --- GAME 6: VERBAL VELOCITY (Word Scramble) ---
const WordScramble = ({ onWin, difficulty, onGameOver }: GameProps) => {
    const WORDS = [
        "ALGORITHM", "DATABASE", "NETWORK", "COMPILER", "INTERFACE",
        "VARIABLE", "FUNCTION", "PYTHON", "REACT", "SERVER",
        "FRAMEWORK", "DEBUGGING", "SYNTAX", "BINARY", "LATENCY",
        "ENCRYPTION", "AGILE", "SCRUM", "BACKEND", "FRONTEND"
    ];

    const [currentWord, setCurrentWord] = useState("");
    const [scrambled, setScrambled] = useState("");
    const [input, setInput] = useState("");
    const [score, setScore] = useState(0);
    const [active, setActive] = useState(false);

    const timeLimit = difficulty === 'easy' ? 60 : difficulty === 'moderate' ? 45 : 30;
    const targetScore = difficulty === 'easy' ? 3 : difficulty === 'moderate' ? 5 : 8;

    const scramble = (word: string) => {
        const arr = word.split('');
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr.join('');
    };

    const nextWord = () => {
        const word = WORDS[Math.floor(Math.random() * WORDS.length)];
        setCurrentWord(word);
        setScrambled(scramble(word));
        setInput("");
    };

    const start = () => {
        setScore(0);
        setActive(true);
        nextWord();
    };

    const check = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.toUpperCase().trim() === currentWord) {
            setScore(s => {
                const newScore = s + 1;
                if (newScore >= targetScore) {
                    setActive(false);
                    onWin();
                    toast.success("Vocabulary Mastered!");
                } else {
                    toast.success("Correct!");
                    nextWord();
                }
                return newScore;
            });
        } else {
            setInput("");
            toast.error("Try again!");
        }
    };

    return (
        <div className="flex flex-col items-center w-full max-w-md mx-auto h-[400px]">
            <div className="flex justify-between w-full mb-6 items-center">
                <span className="text-secondary font-bold text-lg">Score: {score}/{targetScore}</span>
                <GameTimer duration={timeLimit} isActive={active} onTimeUp={() => { setActive(false); toast.error("Time Up!"); if (onGameOver) onGameOver(); }} />
            </div>

            {active ? (
                <div className="w-full flex flex-col items-center gap-6">
                    <div className="bg-black/40 p-8 rounded-xl border border-white/10 w-full text-center">
                        <p className="text-xs text-text-muted uppercase tracking-[0.3em] mb-2">Unscramble</p>
                        <h2 className="text-4xl font-display text-white tracking-widest animate-pulse">{scrambled}</h2>
                    </div>

                    <form onSubmit={check} className="w-full flex gap-2">
                        <Input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            className="text-center text-xl uppercase tracking-wider"
                            autoFocus
                            placeholder="Type word..."
                        />
                        <Button type="submit">Submit</Button>
                    </form>
                    <p className="text-xs text-text-muted">Hint: Tech & Career terms</p>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-full">
                    <div className="text-6xl mb-4">🔠</div>
                    <p className="text-center text-text-muted mb-6">Unscramble as many tech words as you can before time runs out.</p>
                    <Button onClick={start} className="w-48 shadow-lg">Start Game</Button>
                </div>
            )}
        </div>
    );
};

// --- GAME CONFIGURATION & TUTORIALS ---
const GAMES = [
    {
        id: 'memory',
        title: 'Memory Matrix',
        description: 'Memorize the grid pattern and repeat it perfectly.',
        instructions: '1. Watch the grid carefully as a pattern lights up.\n2. Once the pattern finishes, click the tiles in the exact same order.\n3. Complete the pattern to advance.',
        icon: '🧠',
        color: 'primary',
        component: MemoryMatrix
    },
    {
        id: 'aptitude',
        title: 'Aptitude Blitz',
        description: 'Rapid-fire quant & logic questions. Speed matters.',
        instructions: '1. A math or logic question will appear.\n2. Type the correct number answer.\n3. Solve 3-5 questions in a row to clear the level.',
        icon: '📊',
        color: 'green',
        component: AptitudeBlitz
    },
    {
        id: 'tally',
        title: 'Equation Bubble',
        description: 'Solve the equation and pop the correct answer bubble.',
        instructions: '1. Read the math equation at the top (e.g., 15 + ? = 20).\n2. Find the floating bubble with the correct missing number.\n3. Click/Tap the bubble to pop it before time runs out.',
        icon: '🫧',
        color: 'secondary',
        component: TallyNumbubbles
    },
    {
        id: 'pathfinder',
        title: 'Path Finder',
        description: 'Navigate the maze efficiently.',
        instructions: '1. You are the Runner (🏃).\n2. Your goal is to reach the Flag (🏁).\n3. Click any adjacent tile (Up/Down/Left/Right) to move there.\n4. Avoid walls (dark blocks).\n5. Try to find the shortest path!',
        icon: '🗺️',
        color: 'secondary',
        component: PathFinder
    },
    {
        id: 'codebreaker',
        title: 'Code Breaker',
        description: 'Use logic to crack the hidden security code.',
        instructions: '1. Guess the 3-4 digit code.\n2. Green = Correct Number in Correct Place.\n3. Yellow = Correct Number but Wrong Place.\n4. Solve within the attempt limit.',
        icon: '🔐',
        color: 'primary',
        component: CodeBreaker
    },
    {
        id: 'verbal',
        title: 'Verbal Velocity',
        description: 'Unscramble tech words against the clock.',
        instructions: '1. A scrambled word will appear (e.g. "CTARE").\n2. Type the correct tech term (e.g. "REACT").\n3. Hit enter to score points.\n4. Reach the target score before time expires.',
        icon: '🔠',
        color: 'green',
        component: WordScramble
    }
];

// --- MAIN PAGE ---
export const ArcadePage = ({ user }: { user: StudentProfile }) => {
    const supabase = useSupabase();
    const [activeGameId, setActiveGameId] = useState<string | null>(null);
    const [difficulty, setDifficulty] = useState<Difficulty>('moderate');
    const [showTutorial, setShowTutorial] = useState(false);
    const [showGameOver, setShowGameOver] = useState(false);

    const handleWin = async (xp: number = 5) => {
        const bonus = difficulty === 'hard' ? 2 : difficulty === 'moderate' ? 1.5 : 1;
        const totalXP = Math.round(xp * bonus);
        await supabase.rpc('award_xp', { user_id: user.id, xp_amount: totalXP });
        toast(`+${totalXP} XP Won!`, { icon: '🏆', style: { borderRadius: '10px', background: '#333', color: '#fff' } });
    };

    const handleGameOver = () => {
        setShowGameOver(true);
    };

    const handleGameSelect = (id: string) => {
        setActiveGameId(id);
        setShowTutorial(true);
        setShowGameOver(false);
    };

    const activeGameConfig = GAMES.find(g => g.id === activeGameId);
    const ActiveGameComponent = activeGameConfig?.component;

    return (
        <div className="min-h-screen p-4 pb-24 font-student-body">
            <header className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-6">
                    <div>
                        <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-2 text-primary">
                            Nexus Arcade
                        </h1>
                        <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                            Gamified Corporate Assessments. Train your analytical, logical, and memory prowess.
                        </p>
                    </div>

                    {/* Difficulty Selector */}
                    <div className="flex bg-black/30 p-1 rounded-lg border border-white/10 shrink-0">
                        {(['easy', 'moderate', 'hard'] as Difficulty[]).map((d) => (
                            <button
                                key={d}
                                onClick={() => setDifficulty(d)}
                                className={`px-4 py-2 rounded capitalize text-sm font-bold transition-colors ${difficulty === d ? 'bg-primary text-black' : 'text-text-muted hover:text-white'}`}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {GAMES.map((game) => (
                    <Card key={game.id} glow={game.color as any} className="flex flex-col h-full hover:scale-105 transition-transform duration-300 cursor-pointer border border-white/10" onClick={() => handleGameSelect(game.id)}>
                        <div className="h-32 bg-gradient-to-br from-black/60 to-black/20 flex items-center justify-center text-6xl rounded-t-md mb-4 border-b border-white/5">
                            {game.icon}
                        </div>
                        <div className="flex-grow">
                            <h3 className={`font-display text-2xl mb-2 ${game.color === 'primary' ? 'text-primary' : game.color === 'secondary' ? 'text-secondary' : 'text-green-400'}`}>
                                {game.title}
                            </h3>
                            <p className="text-text-muted text-sm leading-relaxed">{game.description}</p>
                        </div>
                        <Button className="w-full mt-6" variant={game.color === 'primary' ? 'primary' : 'secondary'}>Start Assessment</Button>
                    </Card>
                ))}
            </div>

            {/* GAME MODAL */}
            {
                activeGameId && ActiveGameComponent && (
                    <Modal isOpen={!!activeGameId} onClose={() => setActiveGameId(null)} title={`${activeGameConfig?.title} (${difficulty})`}>
                        <div className="p-4">
                            {showTutorial ? (
                                <div className="flex flex-col items-center text-center space-y-6 animate-fade-in-up">
                                    <div className="text-6xl mb-2">{activeGameConfig.icon}</div>
                                    <h3 className="text-2xl font-display text-primary">How to Play</h3>
                                    <div className="bg-white/5 p-4 rounded-lg border border-white/10 text-left w-full max-w-sm">
                                        <ul className="space-y-3 text-sm text-text-base">
                                            {activeGameConfig.instructions.split('\n').map((step, i) => (
                                                <li key={i} className="flex gap-3">
                                                    <span className="text-secondary font-bold">{i + 1}.</span>
                                                    {step.substring(3)}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <Button onClick={() => setShowTutorial(false)} className="w-full max-w-xs shadow-primary animate-pulse">
                                        I'm Ready
                                    </Button>
                                </div>
                            ) : showGameOver ? (
                                <div className="flex flex-col items-center text-center space-y-6 animate-fade-in-up">
                                    <span className="text-6xl">💀</span>
                                    <h3 className="text-3xl font-display text-red-500">Game Over</h3>
                                    <p className="text-text-muted">Don't give up! Training takes time.</p>
                                    <div className="flex gap-4 w-full justify-center">
                                        <Button variant="ghost" onClick={() => setActiveGameId(null)}>Exit</Button>
                                        <Button variant="primary" onClick={() => setShowGameOver(false)}>Try Again</Button>
                                    </div>
                                </div>
                            ) : (
                                <ActiveGameComponent onWin={() => handleWin(5)} difficulty={difficulty} onGameOver={handleGameOver} />
                            )}
                        </div>
                    </Modal>
                )
            }
        </div >
    );
};

export default ArcadePage;
