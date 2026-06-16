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

import { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { Outlet, useLocation } from 'react-router-dom';

import Header from '@layout/header';
import Sidebar from '@layout/sidebar';
import Footer from '@layout/footer';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/thread-explorer': 'Thread Explorer',
  '/lock-contention': 'Lock Contention',
};

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { pathname } = useLocation();

  useEffect(() => {
    const page = PAGE_TITLES[pathname];
    if (page) document.title = `${page} | WSO2 TDAT`;
  }, [pathname]);

  return (
    <Box
      sx={(theme) => ({
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: theme.palette.surface.pageGradient,
        backgroundAttachment: 'fixed',
        color: theme.palette.text.primary,
      })}
    >
      <Header
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar isSidebarOpen={isSidebarOpen} />

        <Box component="main" sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
          <Outlet />
        </Box>
      </Box>

      <Footer />
    </Box>
  );
};

export default Layout;
