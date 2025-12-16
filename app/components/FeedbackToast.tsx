"use client";

import React, { useEffect, useState } from 'react';

interface FeedbackToastProps {
  message: string | null;
  type: 'success' | 'error' | 'warning';
  onComplete?: () => void;
}

const MESSAGES = {
  success: ['Nice!', 'Great!', 'Awesome!', 'Brilliant!', 'Superb!', 'Fantastic!'],
  error: ['Nope!', 'Try again!', 'Not quite!', 'Oops!'],
  warning: ['Already found!', 'Duplicate!'],
};

export function FeedbackToast({ message, type, onComplete }: FeedbackToastProps) {
  const [visible, setVisible] = useState(false);
  const [displayMessage, setDisplayMessage] = useState('');
  
  useEffect(() => {
    if (message) {
      setDisplayMessage(message);
      setVisible(true);
      
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 1200);
      
      return () => clearTimeout(timer);
    }
  }, [message, onComplete]);
  
  if (!visible) return null;
  
  return (
    <div className={`feedback-toast feedback-toast-${type}`}>
      {displayMessage}
    </div>
  );
}

// Helper to get random message
export function getRandomFeedback(type: 'success' | 'error' | 'warning'): string {
  const messages = MESSAGES[type];
  return messages[Math.floor(Math.random() * messages.length)];
}

