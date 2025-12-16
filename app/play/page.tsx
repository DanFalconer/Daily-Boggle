"use client";

import React, { useEffect, useMemo, useState } from "react";

type Tile = string;
type Grid = Tile[];

interface SolverData {
  allWords: string[];
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

const GAME_SECONDS = 120;

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

function useParisDateKey(): string | null {
  const [dateKey, setDateKey] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = fmt.formatToParts(now);
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    setDateKey(`${y}-${m}-${d}`);
  }, []);

  return dateKey;
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
  const dateKey = useParisDateKey();

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

  const [grid, solver] = useMemo((): [Grid | null, SolverData | null] => {
    if (!puzzleId || !dict || !prefixes) return [null, null];
    const seed = hashStringToSeed(puzzleId);
    const rng = mulberry32(seed);
    const g = generateGrid(rng);
    const s = solveGrid(g, dict, prefixes);
    return [g, s];
  }, [puzzleId, dict, prefixes]);

  const [selected, setSelected] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  const [restoredResult, setRestoredResult] = useState<GameResult | null>(null);

  // Check if already played today
  useEffect(() => {
    if (!puzzleId) return;
    const raw = window.localStorage.getItem(STORAGE_PREFIX + puzzleId);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as GameResult;
      setRestoredResult(parsed);
      setFinished(true);
      setRunning(false);
      setScore(parsed.score);
      setFoundWords(new Set(parsed.foundWords));
      setSubmissions(parsed.submissions);
    } catch {
      // ignore
    }
  }, [puzzleId]);

  // Timer
  useEffect(() => {
    if (!running || finished) return;
    const start = Date.now();
    const startLeft = timeLeft;

    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = startLeft - elapsed;
      if (remaining <= 0) {
        setTimeLeft(0);
        setRunning(false);
        setFinished(true);
        window.clearInterval(id);
      } else {
        setTimeLeft(remaining);
      }
    }, 250);

    return () => {
      window.clearInterval(id);
    };
  }, [running, finished, timeLeft]);

  const currentWord = useMemo(() => {
    if (!grid || selected.length === 0) return "";
    return selected.map((i) => grid[i]).join("");
  }, [grid, selected]);

  const handleTileClick = (index: number) => {
    if (!running || finished) return;
    if (!grid) return;
    if (selected.includes(index)) return;
    if (selected.length === 0) {
      setSelected([index]);
      return;
    }
    const last = selected[selected.length - 1];
    if (!isAdjacent(last, index)) return;
    setSelected((prev) => [...prev, index]);
  };

  const handleClear = () => {
    setSelected([]);
  };

  const handleSubmit = () => {
    if (!running || finished) return;
    if (!dict) return;
    const word = normalizeWord(currentWord);
    if (word.length < 3) {
      setSubmissions((prev) => [
        {
          word: currentWord || "(too short)",
          delta: 0,
          status: "invalid",
        },
        ...prev,
      ]);
      setSelected([]);
      return;
    }
    let delta = 0;
    let status: Submission["status"] = "invalid";

    if (!dict.has(word)) {
      delta = 0;
      status = "invalid";
    } else if (foundWords.has(word)) {
      delta = -1;
      status = "duplicate";
    } else {
      delta = word.length - 2;
      status = "new";
    }

    if (delta !== 0 || status !== "invalid") {
      setScore((prev) => prev + delta);
    }

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
    if (!grid || !dictLoaded) return;
    if (restoredResult) return;
    setTimeLeft(GAME_SECONDS);
    setScore(0);
    setFoundWords(new Set());
    setSubmissions([]);
    setSelected([]);
    setFinished(false);
    setRunning(true);
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
    <div className="card">
      <div className="game-header">
        <div>
          <div className="pill">
            <span className="pill-label">Puzzle</span>
            <span className="pill-value">
              {dateKey ?? "Loading..."}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.4rem" }}>
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

      {loadError && (
        <div style={{ fontSize: "0.8rem", opacity: 0.7, marginBottom: "0.5rem" }}>
          {loadError}
        </div>
      )}

      {!grid && (
        <div style={{ fontSize: "0.9rem", opacity: 0.7 }}>
          Preparing today&apos;s puzzle…
        </div>
      )}

      {grid && (
        <>
          <div className="game-grid">
            {grid.map((tile, idx) => {
              const isSelected = selected.includes(idx);
              const classes = [
                "tile",
                isSelected ? "selected" : "",
                !canInteract ? "disabled" : "",
              ]
                .filter(Boolean)
                .join(" ");
              const order =
                selected.findIndex((i) => i === idx) >= 0
                  ? selected.findIndex((i) => i === idx) + 1
                  : null;
              return (
                <button
                  key={idx}
                  type="button"
                  className={classes}
                  onClick={() => handleTileClick(idx)}
                  disabled={!canInteract}
                >
                  <span>{tile}</span>
                  {order !== null && (
                    <span className="tile-index">{order}</span>
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
            <div style={{ opacity: 0.6, fontSize: "0.85rem" }}>
              {currentWord.length > 0 ? `${currentWord.length} letters` : "\u00A0"}
            </div>
          </div>

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
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleStart}
              disabled={
                running ||
                !!restoredResult ||
                !grid ||
                !dictLoaded
              }
            >
              {restoredResult ? "Played" : running ? "Running" : "Start"}
            </button>
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
                      {s.status === "invalid"
                        ? "invalid"
                        : s.status === "duplicate"
                        ? "-1"
                        : `+${s.delta}`}
                    </span>
                  </div>
                );
              })
            )}
          </div>

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
                <div>
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
                      <span style={{ opacity: 0.6 }}>No words this time.</span>
                    )}
                  </div>
                </div>
                <div>
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
                      <span style={{ opacity: 0.6 }}>No dictionary words.</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="end-share">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleShare}
                >
                  Copy share text
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}



