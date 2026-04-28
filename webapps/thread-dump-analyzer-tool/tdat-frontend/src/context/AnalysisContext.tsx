// Copyright (c) 2025 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

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
