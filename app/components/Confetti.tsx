"use client";

import React, { useEffect, useState } from 'react';

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  duration: number;
}

interface ConfettiProps {
  active: boolean;
  onComplete?: () => void;
}

const COLORS = ['#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#f97316', '#eab308'];

export function Confetti({ active, onComplete }: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  
  useEffect(() => {
    if (active) {
      const newPieces: ConfettiPiece[] = [];
      for (let i = 0; i < 30; i++) {
        newPieces.push({
          id: i,
          x: Math.random() * 100,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          delay: Math.random() * 0.3,
          duration: 1 + Math.random() * 0.5,
        });
      }
      setPieces(newPieces);
      
      const timer = setTimeout(() => {
        setPieces([]);
        onComplete?.();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [active, onComplete]);
  
  if (pieces.length === 0) return null;
  
  return (
    <div className="confetti-container">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="confetti-piece"
          style={{
            left: `${piece.x}%`,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

