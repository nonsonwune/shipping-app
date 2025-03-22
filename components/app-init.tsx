"use client"

import { useEffect } from 'react'

export function AppInitializer() {
  useEffect(() => {
    // Initialize app services
    async function initializeApp() {
      try {
        const response = await fetch('/api/init', { method: 'GET' });
        if (!response.ok) {
          console.error('Failed to initialize app services');
        }
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    }
    
    initializeApp();
  }, []);
  
  // This component doesn't render anything
  return null;
}
