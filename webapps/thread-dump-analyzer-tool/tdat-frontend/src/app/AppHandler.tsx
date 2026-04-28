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

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuthContext } from '@asgardeo/auth-react';

import PreLoader from '@component/common/PreLoader';
import LoginScreen from '@component/ui/LoginScreen';
import Layout from '@layout/Layout';
import NotFoundPage from '@layout/pages/404';
import UploadPage from '@pages/upload';
import DashboardHome from '@pages/dashboard/DashboardHome';
import ThreadExplorer from '@pages/dashboard/ThreadExplorer';
import LockContention from '@pages/dashboard/LockContention';

const AppHandler = () => {
  const { state } = useAuthContext();

  if (state.isLoading) {
    return <PreLoader isLoading message="We are getting things ready ..." />;
  }

  if (!state.isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<UploadPage />} />

        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardHome />} />
          <Route path="/thread-explorer" element={<ThreadExplorer />} />
          <Route path="/lock-contention" element={<LockContention />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
};

export default AppHandler;
