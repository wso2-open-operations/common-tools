import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthContext } from '@asgardeo/auth-react';

import PreLoader from '@component/common/PreLoader';
import LoginScreen from '@component/ui/LoginScreen';
import Layout from '@layout/Layout';
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default AppHandler;
