"use client";

import { useCallback, useRef } from 'react';

interface SoundEffects {
  playTileSelect: () => void;
  playValidWord: () => void;
  playInvalidWord: () => void;
  playDuplicate: () => void;
  playGameStart: () => void;
  playGameEnd: () => void;
}

export function useSoundEffects(): SoundEffects {
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Lazy initialization - create AudioContext on first sound play
  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.error('Failed to create AudioContext:', e);
        return null;
      }
    }
    
    // Resume if suspended (happens after tab loses focus)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    return audioContextRef.current;
  }, []);
  
  const playTone = useCallback((
    frequency: number, 
    duration: number, 
    type: OscillatorType = 'sine', 
    volume: number = 0.3
  ) => {
    const ctx = getAudioContext();
    if (!ctx) return;
    
    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
      console.error('Error playing tone:', e);
    }
  }, [getAudioContext]);
  
  const playTileSelect = useCallback(() => {
    playTone(800, 0.08, 'sine', 0.2);
    setTimeout(() => playTone(1000, 0.05, 'sine', 0.15), 30);
  }, [playTone]);
  
  const playValidWord = useCallback(() => {
    // Triumphant ascending arpeggio
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.15, 'sine', 0.25), i * 80);
    });
  }, [playTone]);
  
  const playInvalidWord = useCallback(() => {
    // Evil laugh - "Mwa-ha-ha-ha" descending pattern
    const ctx = getAudioContext();
    if (!ctx) return;
    
    const laughNotes = [
      { freq: 200, time: 0, dur: 0.12 },
      { freq: 180, time: 0.15, dur: 0.1 },
      { freq: 160, time: 0.28, dur: 0.1 },
      { freq: 140, time: 0.41, dur: 0.15 },
    ];
    
    laughNotes.forEach(({ freq, time, dur }) => {
      setTimeout(() => {
        try {
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
          oscillator.frequency.linearRampToValueAtTime(freq * 0.9, ctx.currentTime + dur);
          
          gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
          
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + dur);
        } catch (e) {
          console.error('Error in evil laugh:', e);
        }
      }, time * 1000);
    });
  }, [getAudioContext]);
  
  const playDuplicate = useCallback(() => {
    playTone(400, 0.1, 'square', 0.15);
    setTimeout(() => playTone(300, 0.15, 'square', 0.15), 120);
  }, [playTone]);
  
  const playGameStart = useCallback(() => {
    const notes = [262, 330, 392, 523]; // C4, E4, G4, C5
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.12, 'sine', 0.25), i * 60);
    });
  }, [playTone]);
  
  const playGameEnd = useCallback(() => {
    const notes = [523, 659, 784, 659, 784, 1047]; // Fanfare
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.2, 'sine', 0.2), i * 100);
    });
  }, [playTone]);
  
  return {
    playTileSelect,
    playValidWord,
    playInvalidWord,
    playDuplicate,
    playGameStart,
    playGameEnd,
  };
}
