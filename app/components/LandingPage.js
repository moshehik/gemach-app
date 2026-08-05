'use client';

import React, { useState, useEffect, useCallback } from 'react';

export default function LandingPage() {
  const [isActive, setIsActive] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Set mounted state
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const resetTimer = useCallback((activityEvent = true) => {
    // Only dismiss if the event was an actual user activity (not just setting up the timer)
    if (activityEvent && isActive) {
      setIsActive(false);
    }
    
    // Clear existing timer
    if (window.inactivityTimer) {
      clearTimeout(window.inactivityTimer);
    }

    // Set new timer for 3 minutes (180000 ms)
    window.inactivityTimer = setTimeout(() => {
      setIsActive(true);
      // When automatically activated, we want to prevent immediate dismissal by stray mouse moves
      window.lastActiveTime = Date.now();
    }, 180000);
  }, [isActive]);

  useEffect(() => {
    // Initial setup - don't treat as user activity
    window.lastActiveTime = Date.now();
    resetTimer(false);

    const handleUserActivity = (e) => {
      // Prevent immediate dismissal just after it became active (e.g. from stray mouse move)
      if (Date.now() - window.lastActiveTime < 1000) {
        return;
      }
      resetTimer(true);
    };

    // Listen for custom event to manually show screensaver
    const handleShowScreensaver = () => {
      setIsActive(true);
      window.lastActiveTime = Date.now();
      resetTimer(false);
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    events.forEach((event) => {
      document.addEventListener(event, handleUserActivity, { passive: true });
    });
    window.addEventListener('show-screensaver', handleShowScreensaver);

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleUserActivity);
      });
      window.removeEventListener('show-screensaver', handleShowScreensaver);
      if (window.inactivityTimer) {
        clearTimeout(window.inactivityTimer);
      }
    };
  }, [resetTimer]);

  if (!isMounted) return null;

  if (!isActive) return null;

  return (
    <div data-element-name="לחיץ_LandingPage_1" 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'var(--bg-color, #ffffff)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
        transition: 'opacity 0.3s ease-in-out',
        backgroundImage: 'url(/chuppah_bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
      onClick={() => setIsActive(false)}
    >
      <div style={{ textAlign: 'center', padding: '2rem', borderRadius: '1rem', background: 'rgba(255,255,255,0.8)', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <h1 style={{ fontSize: '3rem', color: 'var(--primary-color)', marginBottom: '1rem' }}>
          ברוכים הבאים לגמ"ח
        </h1>
        <p style={{ fontSize: '1.5rem', color: 'var(--text-color)' }}>
          הקליקו או הזיזו את העכבר כדי להתחיל
        </p>
      </div>
    </div>
  );
}
