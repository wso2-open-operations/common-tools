import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { AnalysisResponse } from '@/types/api';

interface AnalysisContextType {
  data: AnalysisResponse | null;
  setAnalysisData: (data: AnalysisResponse) => void;
  clearSession: () => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

const STORAGE_KEY = 'tdat_analysis_session';

export const AnalysisProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize state by loading from localStorage
  const [data, setData] = useState<AnalysisResponse | null>(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      return savedData ? JSON.parse(savedData) : null;
    } catch (error) {
      console.error("Failed to load session from storage:", error);
      return null;
    }
  });

  // Wrapper to save data to both State and LocalStorage
  const setAnalysisData = (newData: AnalysisResponse) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      setData(newData);
    } catch (error) {
      console.error("Storage quota exceeded or error:", error);
      // Fallback: Set state anyway so it works for this session at least
      setData(newData); 
      alert("Warning: File is too large to save for refresh. Data will be lost if you reload.");
    }
  };

  // Wrapper to clear session
  const clearSession = () => {
    localStorage.removeItem(STORAGE_KEY);
    setData(null);
  };

  return (
    <AnalysisContext.Provider value={{ data, setAnalysisData, clearSession }}>
      {children}
    </AnalysisContext.Provider>
  );
};

export const useAnalysisData = () => {
  const context = useContext(AnalysisContext);
  if (!context) {
    throw new Error('useAnalysisData must be used within an AnalysisProvider');
  }
  return context;
};