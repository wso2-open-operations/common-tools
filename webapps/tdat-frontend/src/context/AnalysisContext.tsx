import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { AnalysisResponse } from '../types/api';

interface AnalysisContextType {
  data: AnalysisResponse | null;
  setAnalysisData: (data: AnalysisResponse) => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export const AnalysisProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AnalysisResponse | null>(null);

  return (
    <AnalysisContext.Provider value={{ data, setAnalysisData: setData }}>
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