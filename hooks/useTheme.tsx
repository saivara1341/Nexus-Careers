import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';

type Theme = 'gamified' | 'professional';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const storedTheme = window.localStorage.getItem('nexus-theme') as Theme | null;
      return storedTheme || 'gamified';
    } catch (error) {
      return 'gamified';
    }
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const isGamified = theme === 'gamified';

    root.classList.remove(isGamified ? 'theme-professional' : 'theme-gamified');
    root.classList.add(isGamified ? 'theme-gamified' : 'theme-professional');
    
    try {
      window.localStorage.setItem('nexus-theme', theme);
    } catch (error) {
      console.error("Could not save theme to localStorage", error);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'gamified' ? 'professional' : 'gamified'));
  };

  const value = useMemo(() => ({ theme, toggleTheme }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};