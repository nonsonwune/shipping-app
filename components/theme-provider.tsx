"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, ReactNode } from "react"

type Theme = "light"  // Only light theme is supported now

type ThemeProviderProps = {
  children: ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "light",
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "shipping-theme",
  ...props
}: ThemeProviderProps) {
  // Always use light theme
  const [theme] = useState<Theme>("light")

  useEffect(() => {
    const root = window.document.documentElement
    
    // Remove any other theme classes and always add light
    root.classList.remove("dark")
    root.classList.add("light")
    
    // Force light mode in localStorage
    localStorage.setItem(storageKey, "light")
  }, [storageKey])

  const value = {
    theme: "light" as Theme,
    setTheme: () => {
      // No-op: only light theme is supported
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider")

  return context
}

