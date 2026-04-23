"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { useModel } from "../hooks/useModel";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

const CLASSES = ["rock", "paper", "scissors"] as const;
type Gesture = (typeof CLASSES)[number];
const BEATS: Record<Gesture, Gesture> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};
const EMOJI: Record<Gesture, string> = {
  rock: "✊",
  paper: "🖐️",
  scissors: "✌️",
};
const WIN_SCORE = 5;

function getAiMove(history: Gesture[]): Gesture {
  if (history.length < 5) return CLASSES[Math.floor(Math.random() * 3)];
  const recent = history.slice(-10);
  const counts = CLASSES.map((c) => ({
    c,
    n: recent.filter((x) => x === c).length,
  }));
  const mostCommon = counts.sort((a, b) => b.n - a.n)[0].c;
  return BEATS[mostCommon];
}

function getWinner(player: Gesture, ai: Gesture): "player" | "ai" | "draw" {
  if (player === ai) return "draw";
  return BEATS[player] === ai ? "player" : "ai";
}

type State = "waiting" | "countdown" | "result" | "gameover";

export default function Game() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const { ready, predict } = useModel();

  const [state, setState] = useState<State>("waiting");
  const [countdown, setCountdown] = useState(3);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [currentGesture, setCurrentGesture] = useState<Gesture | null>(null);
  const [stableGesture, setStableGesture] = useState<Gesture | null>(null);
  const [lastPlayer, setLastPlayer] = useState<Gesture | null>(null);
  const [lastAi, setLastAi] = useState<Gesture | null>(null);
  const [lastResult, setLastResult] = useState<"player" | "ai" | "draw" | null>(
    null,
  );
  const [gameWinner, setGameWinner] = useState<"player" | "ai" | null>(null);
  const [history, setHistory] = useState<Gesture[]>([]);

  const gestureBuffer = useRef<Gesture[]>([]);
  const stateRef = useRef<State>("waiting");
  const currentGestureRef = useRef<Gesture | null>(null);
  const stableGestureRef = useRef<Gesture | null>(null);
  const playerScoreRef = useRef(0);
  const aiScoreRef = useRef(0);
  const historyRef = useRef<Gesture[]>([]);
  const [rounds, setRounds] = useState<
    { player: string; ai: string; result: string }[]
  >([]);
  const [moves, setMoves] = useState({ rock: 0, paper: 0, scissors: 0 });
  const roundsRef = useRef<{ player: string; ai: string; result: string }[]>(
    [],
  );
  const movesRef = useRef({ rock: 0, paper: 0, scissors: 0 });
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  // Sync refs
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    currentGestureRef.current = currentGesture;
  }, [currentGesture]);
  useEffect(() => {
    stableGestureRef.current = stableGesture;
  }, [stableGesture]);
  useEffect(() => {
    playerScoreRef.current = playerScore;
  }, [playerScore]);
  useEffect(() => {
    aiScoreRef.current = aiScore;
  }, [aiScore]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);
  useEffect(() => {
    roundsRef.current = rounds;
  }, [rounds]);
  useEffect(() => {
    movesRef.current = moves;
  }, [moves]);

  // Init MediaPipe
  useEffect(() => {
    async function init() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
      );
      landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        },
        numHands: 1,
        runningMode: "VIDEO",
      });

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    }
    init();
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login");
      else setUserId(user.id);
    });
  }, [router]);

  // Detection loop
  const detect = useCallback(() => {
    if (
      !landmarkerRef.current ||
      !videoRef.current ||
      !canvasRef.current ||
      !ready
    ) {
      requestAnimationFrame(detect);
      return;
    }

    const video = videoRef.current;

    // Attendre que la vidéo soit prête
    if (
      video.readyState < 2 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      requestAnimationFrame(detect);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    // Redimensionne seulement si nécessaire
    if (
      canvas.width !== video.videoWidth ||
      canvas.height !== video.videoHeight
    ) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0);
    ctx.restore();

    try {
      const results = landmarkerRef.current.detectForVideo(
        video,
        performance.now(),
      );

      if (results.landmarks.length > 0) {
        const hand = results.landmarks[0];
        const landmarks = hand.flatMap((lm) => [lm.x, lm.y, lm.z]);
        const { gesture } = predict(landmarks);
        const g = gesture as Gesture;

        gestureBuffer.current.push(g);
        if (gestureBuffer.current.length > 10) gestureBuffer.current.shift();
        const stable =
          gestureBuffer.current.length === 10 &&
          new Set(gestureBuffer.current).size === 1
            ? (gestureBuffer.current[0] as Gesture)
            : null;

        setCurrentGesture(g);
        setStableGesture(stable);

        const W = canvas.width,
          H = canvas.height;
        const connections = [
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 4],
          [0, 5],
          [5, 6],
          [6, 7],
          [7, 8],
          [0, 9],
          [9, 10],
          [10, 11],
          [11, 12],
          [0, 13],
          [13, 14],
          [14, 15],
          [15, 16],
          [0, 17],
          [17, 18],
          [18, 19],
          [19, 20],
          [5, 9],
          [9, 13],
          [13, 17],
        ];

        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth = 2;
        connections.forEach(([a, b]) => {
          const pa = hand[a],
            pb = hand[b];
          ctx.beginPath();
          ctx.moveTo((1 - pa.x) * W, pa.y * H);
          ctx.lineTo((1 - pb.x) * W, pb.y * H);
          ctx.stroke();
        });

        ctx.fillStyle = "#00e5ff";
        hand.forEach((lm) => {
          ctx.beginPath();
          ctx.arc((1 - lm.x) * W, lm.y * H, 5, 0, 2 * Math.PI);
          ctx.fill();
        });
      } else {
        gestureBuffer.current = [];
        setCurrentGesture(null);
        setStableGesture(null);
      }
    } catch (e) {
      // Ignore erreurs MediaPipe pendant le chargement
    }
  }, [ready, predict]);

  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    if (!ready) return;

    const loop = () => {
      detect();
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [ready]); //

  // Countdown logic
  function startRound() {
    if (stateRef.current !== "waiting") return;
    setState("countdown");
    stateRef.current = "countdown";
    setCountdown(3);

    let count = 3;
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(interval);
        resolveRound();
      }
    }, 1000);
  }

  async function resolveRound() {
    const gesture = stableGestureRef.current || currentGestureRef.current;
    if (!gesture) {
      setState("waiting");
      return;
    }

    const aiMove = getAiMove(historyRef.current);
    const result = getWinner(gesture, aiMove);

    const newRound = { player: gesture, ai: aiMove, result };
    const newRounds = [...roundsRef.current, newRound];
    const newMoves = {
      ...movesRef.current,
      [gesture]: movesRef.current[gesture] + 1,
    };
    setRounds(newRounds);
    setMoves(newMoves);
    roundsRef.current = newRounds;
    movesRef.current = newMoves;

    let newPlayerScore = playerScoreRef.current;
    let newAiScore = aiScoreRef.current;
    if (result === "player") newPlayerScore++;
    else if (result === "ai") newAiScore++;

    setLastPlayer(gesture);
    setLastAi(aiMove);
    setLastResult(result);
    setPlayerScore(newPlayerScore);
    setAiScore(newAiScore);
    setHistory((h) => [...h, gesture]);

    if (newPlayerScore >= WIN_SCORE) {
      setGameWinner("player");
      setState("gameover");
      await saveGame(newPlayerScore, newAiScore, "player", newRounds, newMoves);
    } else if (newAiScore >= WIN_SCORE) {
      setGameWinner("ai");
      setState("gameover");
      await saveGame(newPlayerScore, newAiScore, "ai", newRounds, newMoves);
    } else {
      setState("result");
      setTimeout(() => setState("waiting"), 3000);
    }
  }

  function resetGame() {
    setPlayerScore(0);
    setAiScore(0);
    setHistory([]);
    setGameWinner(null);
    setLastPlayer(null);
    setLastAi(null);
    setLastResult(null);
    setState("waiting");
    setRounds([]);
    setMoves({ rock: 0, paper: 0, scissors: 0 });
    roundsRef.current = [];
    movesRef.current = { rock: 0, paper: 0, scissors: 0 };
    playerScoreRef.current = 0;
    aiScoreRef.current = 0;
    historyRef.current = [];
  }

  async function saveGame(
    finalPlayerScore: number,
    finalAiScore: number,
    winner: "player" | "ai",
    rounds: { player: string; ai: string; result: string }[],
    moves: { rock: number; paper: number; scissors: number },
  ) {
    if (!userId) return;
    await supabase.from("games").insert({
      user_id: userId,
      player_score: finalPlayerScore,
      ai_score: finalAiScore,
      winner,
      rounds,
      player_moves: moves,
    });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center">
      {/* Header / Score */}
      <div className="w-full bg-gray-900 px-6 py-3 flex items-center justify-between">
        <div className="flex flex-col items-center">
          <span className="text-sm text-gray-400">YOU</span>
          <span className="text-3xl font-bold text-green-400">
            {playerScore}
          </span>
          <div className="flex gap-1 mt-1">
            {Array.from({ length: WIN_SCORE }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${i < playerScore ? "bg-green-400" : "bg-gray-700"}`}
              />
            ))}
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-xl font-bold tracking-widest text-white">
            RPS vs AI
          </h1>
          <p className="text-xs text-gray-500">First to {WIN_SCORE} wins</p>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-sm text-gray-400">AI</span>
          <span className="text-3xl font-bold text-red-400">{aiScore}</span>
          <div className="flex gap-1 mt-1">
            {Array.from({ length: WIN_SCORE }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${i < aiScore ? "bg-red-400" : "bg-gray-700"}`}
              />
            ))}
          </div>
        </div>
      </div>
      <button
        onClick={() => router.push("/profile")}
        className="text-gray-400 hover:text-white text-xl transition bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-full mt-4"
      >
        Statistiques
      </button>
      {/* Webcam */}
      <div className="relative w-full max-w-2xl mt-4 rounded-xl overflow-hidden border border-gray-800">
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} className="w-full" />

        {/* Gesture indicator */}
        {currentGesture && (
          <div className="absolute bottom-4 right-4 bg-black/70 px-3 py-1 rounded-full text-sm">
            {EMOJI[currentGesture]} {currentGesture} {stableGesture ? "✓" : ""}
          </div>
        )}

        {/* Overlay states */}
        {state === "waiting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
            <p className="text-2xl font-bold mb-2">Ready?</p>
            <p className="text-gray-300 text-sm mb-6">
              First to {WIN_SCORE} wins the match
            </p>
            <button
              onClick={startRound}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-8 py-3 rounded-full text-lg transition"
            >
              PLAY
            </button>
          </div>
        )}

        {state === "countdown" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
            <p className="text-8xl font-black text-cyan-400">{countdown}</p>
            <p className="text-gray-300 mt-4">Show your move!</p>
          </div>
        )}

        {state === "result" && lastPlayer && lastAi && lastResult && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
            <p
              className={`text-4xl font-black mb-4 ${lastResult === "player" ? "text-green-400" : lastResult === "ai" ? "text-red-400" : "text-yellow-400"}`}
            >
              {lastResult === "player"
                ? "YOU WIN!"
                : lastResult === "ai"
                  ? "AI WINS!"
                  : "DRAW!"}
            </p>
            <div className="flex gap-8 text-4xl">
              <div className="text-center">
                <div>{EMOJI[lastPlayer]}</div>
                <div className="text-sm text-gray-400 mt-1">You</div>
              </div>
              <div className="text-2xl self-center text-gray-500">vs</div>
              <div className="text-center">
                <div>{EMOJI[lastAi]}</div>
                <div className="text-sm text-gray-400 mt-1">AI</div>
              </div>
            </div>
          </div>
        )}

        {state === "gameover" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <p
              className={`text-5xl font-black mb-2 ${gameWinner === "player" ? "text-green-400" : "text-red-400"}`}
            >
              {gameWinner === "player" ? "VICTORY! 🏆" : "DEFEAT..."}
            </p>
            <p className="text-gray-300 mb-2">
              {gameWinner === "player" ? "You beat the AI!" : "The AI got you!"}
            </p>
            <p className="text-xl mb-6 text-gray-400">
              {playerScore} - {aiScore}
            </p>
            <button
              onClick={resetGame}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-8 py-3 rounded-full text-lg transition"
            >
              PLAY AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
