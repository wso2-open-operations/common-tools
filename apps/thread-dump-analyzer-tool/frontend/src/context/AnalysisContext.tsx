// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
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

import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { AnalysisResponse } from '@/types/api';

interface AnalysisContextType {
  data: AnalysisResponse | null;
  setAnalysisData: (data: AnalysisResponse) => void;
  clearSession: () => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export const AnalysisProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AnalysisResponse | null>(null);

  const setAnalysisData = (newData: AnalysisResponse) => {
    setData(newData);
  };

  const clearSession = () => {
    setData(null);
  };

  return (
    <AnalysisContext.Provider value={{ data, setAnalysisData, clearSession }}>
      {children}
    </AnalysisContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAnalysisData = () => {
  const context = useContext(AnalysisContext);
  if (!context) {
    throw new Error('useAnalysisData must be used within an AnalysisProvider');
  }
  return context;
};
