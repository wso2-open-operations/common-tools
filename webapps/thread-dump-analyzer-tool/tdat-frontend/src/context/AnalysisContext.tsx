import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import localforage from 'localforage';
import type { AnalysisResponse } from '@/types/api';
import PreLoader from '@component/common/PreLoader';

interface AnalysisContextType {
  data: AnalysisResponse | null;
  setAnalysisData: (data: AnalysisResponse) => void;
  clearSession: () => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

const STORAGE_KEY = 'tdat_analysis_session';

export const AnalysisProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    localforage.getItem<AnalysisResponse>(STORAGE_KEY)
      .then((saved) => setData(saved ?? null))
      .catch((error) => console.error('Failed to load session from storage:', error))
      .finally(() => setHydrated(true));
  }, []);

  const setAnalysisData = (newData: AnalysisResponse) => {
    setData(newData);
    localforage.setItem(STORAGE_KEY, newData)
      .catch((error) => console.error('Failed to persist session to storage:', error));
  };

  const clearSession = () => {
    setData(null);
    localforage.removeItem(STORAGE_KEY)
      .catch((error) => console.error('Failed to clear session from storage:', error));
  };

  if (!hydrated) {
    return <PreLoader />;
  }

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