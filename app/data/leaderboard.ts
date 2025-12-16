export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  wordsFound: number;
  isCurrentPlayer?: boolean;
}

// Dummy data for today's leaderboard
export const DUMMY_LEADERBOARD: Omit<LeaderboardEntry, 'rank' | 'isCurrentPlayer'>[] = [
  { name: "Reabetswe", score: 47, wordsFound: 18 },
  { name: "Johan", score: 42, wordsFound: 15 },
  { name: "Martyna", score: 38, wordsFound: 14 },
  { name: "Eric", score: 35, wordsFound: 12 },
  { name: "Talisa", score: 31, wordsFound: 11 },
  { name: "Daphne", score: 28, wordsFound: 10 },
  { name: "Tyler", score: 24, wordsFound: 9 },
];

export function getLeaderboardWithPlayer(
  playerName: string,
  playerScore: number,
  playerWordsFound: number
): LeaderboardEntry[] {
  // Combine dummy data with current player
  const allEntries = [
    ...DUMMY_LEADERBOARD,
    { name: playerName, score: playerScore, wordsFound: playerWordsFound }
  ];
  
  // Sort by score descending, then by words found descending
  const sorted = allEntries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.wordsFound - a.wordsFound;
  });
  
  // Add ranks and mark current player
  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    isCurrentPlayer: entry.name === playerName,
  }));
}

