"use client";

import React from 'react';
import { LeaderboardEntry } from '../data/leaderboard';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: LeaderboardEntry[];
  dateLabel: string;
}

export function LeaderboardModal({ isOpen, onClose, entries, dateLabel }: LeaderboardModalProps) {
  if (!isOpen) return null;
  
  const currentPlayerEntry = entries.find(e => e.isCurrentPlayer);
  
  return (
    <div className="leaderboard-backdrop" onClick={onClose}>
      <div className="leaderboard-modal" onClick={(e) => e.stopPropagation()}>
        <div className="leaderboard-header">
          <div className="leaderboard-title">Today&apos;s Leaderboard</div>
          <div className="leaderboard-date">{dateLabel}</div>
          <button className="leaderboard-close" onClick={onClose}>
            ✕
          </button>
        </div>
        
        {currentPlayerEntry && (
          <div className="leaderboard-player-rank">
            You are ranked <span className="rank-highlight">#{currentPlayerEntry.rank}</span> today!
          </div>
        )}
        
        <div className="leaderboard-list">
          {entries.map((entry) => (
            <div 
              key={entry.name} 
              className={`leaderboard-row ${entry.isCurrentPlayer ? 'leaderboard-row-current' : ''}`}
            >
              <div className="leaderboard-rank">
                {entry.rank === 1 && <span className="medal gold">🥇</span>}
                {entry.rank === 2 && <span className="medal silver">🥈</span>}
                {entry.rank === 3 && <span className="medal bronze">🥉</span>}
                {entry.rank > 3 && <span className="rank-number">#{entry.rank}</span>}
              </div>
              <div className="leaderboard-name">
                {entry.name}
                {entry.isCurrentPlayer && <span className="you-badge">YOU</span>}
              </div>
              <div className="leaderboard-stats">
                <span className="leaderboard-score">{entry.score} pts</span>
                <span className="leaderboard-words">{entry.wordsFound} words</span>
              </div>
            </div>
          ))}
        </div>
        
        <div className="leaderboard-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

