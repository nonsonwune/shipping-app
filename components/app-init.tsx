"use client"

import { useEffect } from 'react'

export function AppInitializer() {
  // Simplify the initialization code to avoid any potential issues
  useEffect(() => {
    try {
      console.log("AppInitializer simplified version mounting");
      
      // Simple init only - no async code for now
      const initServices = () => {
        console.log("App initialization simplified");
      };
      
      initServices();
    } catch (error) {
      console.error("Error in AppInitializer:", error);
    }
    
    return () => {
      console.log("AppInitializer unmounting");
    };
  }, []);
  
  // This component doesn't render anything
  return null;
}
