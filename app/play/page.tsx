"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSoundEffects } from '../hooks/useSoundEffects';
import { Confetti } from '../components/Confetti';
import { FeedbackToast, getRandomFeedback } from '../components/FeedbackToast';
import { LeaderboardModal } from '../components/LeaderboardModal';
import { getLeaderboardWithPlayer } from '../data/leaderboard';

type Tile = string;
type Grid = Tile[];

interface SolverData {
  allWords: string[];
}

interface DateInfo {
  key: string;
  label: string;
}

interface GameResult {
  score: number;
  foundWords: string[];
  submissions: Submission[];
}

interface Submission {
  word: string;
  delta: number;
  status: "new" | "duplicate" | "invalid";
}

const GAME_SECONDS = 60;

function hashStringToSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

function mulberry32(seed: number) {
  let t = seed || 1;
  return () => {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const LETTER_BAG = [
  "e",
  "e",
  "e",
  "e",
  "e",
  "e",
  "a",
  "a",
  "a",
  "a",
  "i",
  "i",
  "i",
  "o",
  "o",
  "o",
  "n",
  "n",
  "r",
  "r",
  "r",
  "t",
  "t",
  "t",
  "l",
  "l",
  "s",
  "s",
  "d",
  "d",
  "g",
  "b",
  "c",
  "m",
  "p",
  "f",
  "h",
  "v",
  "w",
  "y",
  "k",
  "x",
  "z",
];

function generateGrid(rng: () => number): Grid {
  const grid: Grid = [];
  for (let i = 0; i < 16; i++) {
    // Small chance of "qu" tile
    const quChance = 0.08;
    if (rng() < quChance) {
      grid.push("qu");
      continue;
    }
    const idx = Math.floor(rng() * LETTER_BAG.length);
    grid.push(LETTER_BAG[idx]);
  }
  return grid;
}

function normalizeWord(raw: string): string {
  const onlyLetters = raw.toLowerCase().replace(/[^a-z]/g, "");
  return onlyLetters;
}

function buildDictionary(
  rawText: string
): { words: Set<string>; prefixes: Set<string> } {
  const words = new Set<string>();
  const prefixes = new Set<string>();
  const lines = rawText.split(/\r?\n/);
  for (const line of lines) {
    const w = normalizeWord(line.trim());
    if (!w || w.length < 3) continue;
    if (!/^[a-z]+$/.test(w)) continue;
    words.add(w);
    for (let i = 1; i <= w.length; i++) {
      prefixes.add(w.slice(0, i));
    }
  }
  return { words, prefixes };
}

function indexToCoord(index: number): { row: number; col: number } {
  return { row: Math.floor(index / 4), col: index % 4 };
}

function isAdjacent(a: number, b: number): boolean {
  const ac = indexToCoord(a);
  const bc = indexToCoord(b);
  const dr = Math.abs(ac.row - bc.row);
  const dc = Math.abs(ac.col - bc.col);
  if (dr === 0 && dc === 0) return false;
  return Math.max(dr, dc) === 1;
}

function solveGrid(grid: Grid, dict: Set<string>, prefixes: Set<string>): SolverData {
  const results = new Set<string>();

  const dirs = [
    -5, -4, -3, -1, 1, 3, 4, 5, // conceptual; we'll still check adjacency
  ];

  function dfs(
    index: number,
    visitedMask: number,
    current: string
  ): void {
    const letter = grid[index];
    const nextWord = current + letter;
    if (!prefixes.has(nextWord)) return;
    const bit = 1 << index;
    const nextMask = visitedMask | bit;

    if (nextWord.length >= 3 && dict.has(nextWord)) {
      results.add(nextWord);
    }

    for (let n = 0; n < 16; n++) {
      if (nextMask & (1 << n)) continue;
      if (!isAdjacent(index, n)) continue;
      dfs(n, nextMask, nextWord);
    }
  }

  for (let i = 0; i < 16; i++) {
    dfs(i, 0, "");
  }

  const allWords = Array.from(results).sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return a.localeCompare(b);
  });

  return { allWords };
}

function useParisDateInfo(): DateInfo | null {
  const [info, setInfo] = useState<DateInfo | null>(null);

  useEffect(() => {
    const now = new Date();
    const keyFmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const labelFmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
    const parts = keyFmt.formatToParts(now);
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    const key = `${y}-${m}-${d}`;
    const label = labelFmt.format(now);
    setInfo({ key, label });
  }, []);

  return info;
}

async function loadDictionaryOnce(): Promise<{
  words: Set<string>;
  prefixes: Set<string>;
}> {
  const res = await fetch("/words.txt");
  const text = await res.text();
  return buildDictionary(text);
}

function formatSeconds(total: number): string {
  const clamped = Math.max(0, total);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const STORAGE_PREFIX = "daily-boggle-result-";

export default function PlayPage() {
  const dateInfo = useParisDateInfo();
  const dateKey = dateInfo?.key ?? null;

  const [dictLoaded, setDictLoaded] = useState(false);
  const [dict, setDict] = useState<Set<string> | null>(null);
  const [prefixes, setPrefixes] = useState<Set<string> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDictionaryOnce()
      .then(({ words, prefixes }) => {
        if (cancelled) return;
        setDict(words);
        setPrefixes(prefixes);
        setDictLoaded(true);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) {
          setLoadError("Unable to load dictionary. Game may be limited.");
          setDictLoaded(true);
          setDict(new Set());
          setPrefixes(new Set());
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const puzzleId = dateKey ? `${dateKey}-v1` : null;

  const [grid, solver, validWordSet] = useMemo(
    (): [Grid | null, SolverData | null, Set<string> | null] => {
      if (!puzzleId || !dict || !prefixes) return [null, null, null];
      const seed = hashStringToSeed(puzzleId);
      const rng = mulberry32(seed);
      const g = generateGrid(rng);
      const s = solveGrid(g, dict, prefixes);
      const validSet = new Set(s.allWords);
      return [g, s, validSet];
    },
    [puzzleId, dict, prefixes]
  );

  const [selected, setSelected] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  const [restoredResult, setRestoredResult] = useState<GameResult | null>(null);
  const [playerName, setPlayerName] = useState<string>("");
  const [nameInput, setNameInput] = useState<string>("");
  const [showNameModal, setShowNameModal] = useState<boolean>(true);
  const [gameReady, setGameReady] = useState<boolean>(false);
  
  const [showConfetti, setShowConfetti] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'warning'>('success');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  
  const sounds = useSoundEffects();
  
  // Calculate leaderboard data
  const leaderboardEntries = useMemo(() => {
    if (!playerName) return [];
    return getLeaderboardWithPlayer(playerName, score, foundWords.size);
  }, [playerName, score, foundWords.size]);

  // Check if already played today - only restore if name modal is closed
  useEffect(() => {
    if (!puzzleId || showNameModal) return;
    
    const raw = window.localStorage.getItem(STORAGE_PREFIX + puzzleId);
    
    // If no saved result, ensure we're in a fresh state
    if (!raw) {
      setRestoredResult(null);
      setFinished(false);
      setRunning(false);
      setGameReady(true);
      return;
    }
    
    try {
      const parsed = JSON.parse(raw) as GameResult;
      // Only restore if there's actual valid data
      if (parsed && typeof parsed.score === 'number' && Array.isArray(parsed.foundWords)) {
        setRestoredResult(parsed);
        setFinished(true);
        setRunning(false);
        setScore(parsed.score);
        setFoundWords(new Set(parsed.foundWords));
        setSubmissions(parsed.submissions || []);
      } else {
        // Invalid data, reset to fresh state
        setRestoredResult(null);
        setFinished(false);
        setGameReady(true);
      }
    } catch {
      // Parse error, reset to fresh state
      setRestoredResult(null);
      setFinished(false);
      setGameReady(true);
    }
  }, [puzzleId, showNameModal]);

  // Timer - only runs when game is actively running
  useEffect(() => {
    if (!running || finished) return;

    const id = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          setFinished(true);
          sounds.playGameEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(id);
    };
  }, [running, finished, sounds]);

  const currentWord = useMemo(() => {
    if (!grid || selected.length === 0) return "";
    return selected.map((i) => grid[i]).join("");
  }, [grid, selected]);

  const handleTileClick = (index: number) => {
    if (!running || finished) return;
    if (!grid) return;
    const existingIndex = selected.indexOf(index);
    // If tile is already in the path, treat click as undo/backtrack.
    if (existingIndex !== -1) {
      // Clicking the last tile removes just that tile.
      if (existingIndex === selected.length - 1) {
        setSelected((prev) => prev.slice(0, -1));
      } else {
        // Clicking an earlier tile trims the path back to that tile.
        setSelected((prev) => prev.slice(0, existingIndex + 1));
      }
      sounds.playTileSelect();
      return;
    }
    if (selected.length === 0) {
      setSelected([index]);
      sounds.playTileSelect();
      return;
    }
    const last = selected[selected.length - 1];
    if (!isAdjacent(last, index)) return;
    setSelected((prev) => [...prev, index]);
    sounds.playTileSelect();
  };

  const handleClear = () => {
    setSelected([]);
  };

  const handleSubmit = () => {
    if (!running || finished) return;
    if (!solver || !validWordSet) return;

    const word = normalizeWord(currentWord);

    if (word.length < 3) {
      setSubmissions((prev) => [
        {
          word: currentWord || "(too short)",
          delta: -1,
          status: "invalid",
        },
        ...prev,
      ]);
      setScore((prev) => Math.max(0, prev - 1));
      setSelected([]);
      sounds.playInvalidWord();
      setFeedbackType('error');
      setFeedbackMessage(getRandomFeedback('error'));
      return;
    }

    let delta = 0;
    let status: Submission["status"] = "invalid";

    if (foundWords.has(word)) {
      // Duplicate
      delta = -1;
      status = "duplicate";
      sounds.playDuplicate();
      setFeedbackType('warning');
      setFeedbackMessage(getRandomFeedback('warning'));
    } else if (validWordSet.has(word)) {
      // Valid new word: in dictionary AND formable on this grid
      delta = word.length - 2;
      status = "new";
      sounds.playValidWord();
      setShowConfetti(true);
      setFeedbackType('success');
      // Vary message based on word length
      if (word.length >= 7) {
        setFeedbackMessage('INCREDIBLE!');
      } else if (word.length >= 5) {
        setFeedbackMessage('Fantastic!');
      } else {
        setFeedbackMessage(getRandomFeedback('success'));
      }
    } else {
      // Invalid word
      delta = -1;
      status = "invalid";
      sounds.playInvalidWord();
      setFeedbackType('error');
      setFeedbackMessage(getRandomFeedback('error'));
    }

    setScore((prev) => Math.max(0, prev + delta));

    setSubmissions((prev) => [
      { word, delta, status },
      ...prev,
    ]);

    if (status === "new") {
      setFoundWords((prev) => {
        const next = new Set(prev);
        next.add(word);
        return next;
      });
    }

    setSelected([]);
  };

  const handleStart = () => {
    if (!grid || !dictLoaded || !gameReady) return;
    if (restoredResult) return;
    if (running || finished) return; // Already in progress or done
    
    // Reset all game state
    setTimeLeft(GAME_SECONDS);
    setScore(0);
    setFoundWords(new Set());
    setSubmissions([]);
    setSelected([]);
    setFinished(false);
    sounds.playGameStart();
    setRunning(true); // This triggers the timer to start
  };

  const handleShare = () => {
    if (!puzzleId || !solver) return;
    const share = `Daily Boggle ${puzzleId} — Score ${score} — Words ${foundWords.size}/${solver.allWords.length}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(share).catch(() => {
        // ignore
      });
    } else {
      window.prompt("Copy your result:", share);
    }
  };

  // Persist result when finished (only once per puzzle)
  useEffect(() => {
    if (!finished || !puzzleId) return;
    const data: GameResult = {
      score,
      foundWords: Array.from(foundWords),
      submissions,
    };
    try {
      window.localStorage.setItem(STORAGE_PREFIX + puzzleId, JSON.stringify(data));
    } catch {
      // ignore
    }
  }, [finished, puzzleId, score, foundWords, submissions]);

  const canInteract = running && !finished;

  return (
    <>
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
      <FeedbackToast 
        message={feedbackMessage} 
        type={feedbackType} 
        onComplete={() => setFeedbackMessage(null)} 
      />
      <div className="card">
      <div className="game-header">
        <div className="header-left">
          <div className="pill">
            <span className="pill-label">Puzzle</span>
            <span className="pill-value">
              {dateInfo?.label ?? "Loading..."}
            </span>
          </div>
        </div>
        <div className="header-right">
          {!showNameModal && playerName && (
            <button 
              className="btn btn-ghost leaderboard-btn"
              onClick={() => setShowLeaderboard(true)}
              type="button"
            >
              🏆
            </button>
          )}
          <div className="pill">
            <span className="pill-label">Time</span>
            <span className="pill-value">{formatSeconds(timeLeft)}</span>
          </div>
          <div className="pill">
            <span className="pill-label">Score</span>
            <span className="pill-value">{score}</span>
          </div>
        </div>
      </div>

      {!showNameModal && playerName && (
        <div className="player-name-banner">
          Playing as <strong>{playerName}</strong>
        </div>
      )}

      {showNameModal && (
        <div className="name-modal-backdrop">
          <div className="name-modal">
            <div className="name-modal-title">Welcome to Daily Boggle</div>
            <div className="name-modal-subtitle">
              Enter your name to get today&apos;s puzzle.
            </div>
            <input
              className="name-input"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Enter your name"
            />
            <button
              type="button"
              className="btn btn-primary name-continue"
              onClick={() => {
                const trimmed = nameInput.trim();
                if (!trimmed) return;
                setPlayerName(trimmed);
                setShowNameModal(false);
                setGameReady(true);
              }}
              disabled={!nameInput.trim()}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {finished && (
        <div className="finish-banner">
          <span className="finish-banner-label">Round complete</span>
          <span className="finish-banner-text">
            Well done — you scored <strong>{score}</strong> point
            {score === 1 ? "" : "s"} today.
          </span>
        </div>
      )}

      {loadError && (
        <div style={{ fontSize: "0.8rem", opacity: 0.7, marginBottom: "0.5rem" }}>
          {loadError}
        </div>
      )}

      {!showNameModal && !grid && (
        <div style={{ fontSize: "0.9rem", opacity: 0.7 }}>
          Preparing today&apos;s puzzle…
        </div>
      )}

      {!showNameModal && grid && (
        <>
          <div className="game-grid">
            {grid.map((tile, idx) => {
              const selectionPosition = selected.indexOf(idx);
              const isSelected = selectionPosition !== -1;
              const showLetters = running || finished;
              
              // Calculate color class based on position in selection (1-indexed, wraps at 10)
              const colorClass = isSelected ? `selected-${(selectionPosition % 10) + 1}` : '';
              
              const classes = [
                "tile",
                isSelected ? "selected" : "",
                colorClass,
                !canInteract ? "disabled" : "",
                !showLetters ? "tile-hidden" : "",
              ]
                .filter(Boolean)
                .join(" ");
              
              return (
                <button
                  key={idx}
                  type="button"
                  className={classes}
                  onClick={() => handleTileClick(idx)}
                  disabled={!canInteract}
                >
                  <span>{showLetters ? tile : ""}</span>
                  {isSelected && (
                    <span className="tile-index">{selectionPosition + 1}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="current-word">
            <div className="current-word-text">
              {currentWord ? (
                currentWord.toUpperCase()
              ) : (
                <span className="current-word-muted">Tap tiles to build a word</span>
              )}
            </div>
            <div>
              {currentWord.length > 0 ? `${currentWord.length} letters` : "\u00A0"}
            </div>
          </div>

          {/* Pre-game prompt - shows below grid before start */}
          {!running && !finished && !restoredResult && gameReady && (
            <div className="pre-game-prompt">
              <span className="pre-game-icon">▶</span>
              <span className="pre-game-text">Tap Start to reveal today&apos;s letters</span>
            </div>
          )}

          <div className="buttons-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClear}
              disabled={!canInteract || selected.length === 0}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!canInteract || !currentWord}
            >
              Submit
            </button>
            {/* Start button - only show when game hasn't started */}
            {!running && !finished && !restoredResult && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStart}
                disabled={!grid || !dictLoaded || !gameReady}
              >
                Start
              </button>
            )}
            {/* Show "Played" if already played today */}
            {restoredResult && (
              <button type="button" className="btn btn-ghost" disabled>
                Played
              </button>
            )}
          </div>

          <div className="submissions">
            {submissions.length === 0 ? (
              <div
                style={{
                  fontSize: "0.8rem",
                  opacity: 0.65,
                  paddingTop: "0.2rem",
                }}
              >
                Your recent words will appear here.
              </div>
            ) : (
              submissions.map((s, idx) => {
                let statusClass = "submission-bad";
                if (s.status === "new") statusClass = "submission-good";
                else if (s.status === "duplicate") statusClass = "submission-duplicate";
                return (
                  <div key={idx} className="submission-row">
                    <span className={`submission-word ${statusClass}`}>
                      {s.word.toUpperCase()}
                    </span>
                    <span className="submission-meta">
                      {s.delta > 0 ? `+${s.delta}` : s.delta}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {foundWords.size > 0 && (
            <div className="found-words-live">
              <div className="found-words-title">
                Found words ({foundWords.size})
              </div>
              <div className="found-words-chips">
                {Array.from(foundWords)
                  .sort((a, b) => b.length - a.length || a.localeCompare(b))
                  .map((w) => (
                    <span key={w} className="word-chip valid">
                      {w.toUpperCase()}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {finished && solver && (
            <div className="end-screen">
              <div className="end-summary">
                <span>
                  Final score <strong>{score}</strong>
                </span>
                <span>
                  Words {foundWords.size}/{solver.allWords.length}
                </span>
              </div>
              <div className="end-columns">
                <div className="end-column">
                  <div className="list-title">You found</div>
                  <div className="word-list">
                    {Array.from(foundWords)
                      .sort((a, b) => {
                        if (b.length !== a.length) return b.length - a.length;
                        return a.localeCompare(b);
                      })
                      .map((w) => (
                        <span key={w} className="word-list-item found">
                          {w.toUpperCase()}
                        </span>
                      ))}
                    {foundWords.size === 0 && (
                      <span className="muted-text">No words this time.</span>
                    )}
                  </div>
                </div>
                <div className="end-column">
                  <div className="list-title">All possible words</div>
                  <div className="word-list">
                    {solver.allWords.map((w) => (
                      <span
                        key={w}
                        className={
                          "word-list-item" +
                          (foundWords.has(w) ? " found" : "")
                        }
                      >
                        {w.toUpperCase()}
                      </span>
                    ))}
                    {solver.allWords.length === 0 && (
                      <span className="muted-text">No dictionary words.</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="end-share">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowLeaderboard(true)}
                >
                  🏆 View Leaderboard
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleShare}
                >
                  Copy Share Text
                </button>
              </div>
            </div>
          )}

        </>
      )}

      {/* DEV Clear Button - Always visible for testing */}
      {process.env.NODE_ENV === 'development' && (
        <button
          type="button"
          className="dev-clear-btn"
          onClick={() => {
            if (puzzleId) {
              window.localStorage.removeItem(STORAGE_PREFIX + puzzleId);
              setRestoredResult(null);
              setFinished(false);
              setRunning(false);
              setTimeLeft(GAME_SECONDS);
              setScore(0);
              setFoundWords(new Set());
              setSubmissions([]);
              setSelected([]);
              setGameReady(true);
            }
          }}
        >
          [DEV] Clear Today&apos;s Data & Play Again
        </button>
      )}
      </div>
      <LeaderboardModal
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        entries={leaderboardEntries}
        dateLabel={dateInfo?.label ?? ''}
      />
    </>
  );
}



