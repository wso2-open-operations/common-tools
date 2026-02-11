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
import { Box, useTheme } from "@mui/material";
import { useSnackbar } from "notistack";
import { useSelector } from "react-redux";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { Suspense, useCallback, useEffect, useState } from "react";

import PreLoader from "@component/common/PreLoader";
import { redirectUrl as savedRedirectUrl } from "@config/constant";
import ConfirmationModalContextProvider from "@context/DialogContext";
import Header from "@layout/header";
import Sidebar from "@layout/sidebar";
import { selectRoles } from "@slices/authSlice/auth";
import { type RootState, useAppSelector } from "@slices/store";

export default function Layout() {
  const { enqueueSnackbar } = useSnackbar();
  const common = useAppSelector((state: RootState) => state.common);
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const roles = useSelector(selectRoles);
  const theme = useTheme();

  const showSnackbar = useCallback(() => {
    if (common.timestamp !== null) {
      enqueueSnackbar(common.message, {
        variant: common.type,
        preventDuplicate: true,
        anchorOrigin: { horizontal: "right", vertical: "bottom" },
      });
    }
  }, [common.message, common.type, common.timestamp, enqueueSnackbar]);

  useEffect(() => {
    showSnackbar();
  }, [showSnackbar]);

  useEffect(() => {
    const redirectUrl = localStorage.getItem(savedRedirectUrl);
    if (redirectUrl) {
      navigate(redirectUrl);
      localStorage.removeItem(savedRedirectUrl);
    }
  }, [navigate]);

  return (
    <ConfirmationModalContextProvider>
      {/* Full screen container */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          width: "100vw",
          backgroundColor: theme.palette.surface.primary.active,
        }}
      >
        {/* Header */}
        <Header />

        {/* Main content container */}
        <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Sidebar */}
          <Box sx={{ width: "fit-content", height: "100%" }}>
            <Sidebar
              roles={roles}
              currentPath={location.pathname}
              open={open}
              handleDrawer={() => setOpen(!open)}
            />
          </Box>

          {/* Main content area */}
          <Box
            sx={{
              flex: 1,
              height: "100%",
              padding: "18px",
            }}
          >
            <Suspense fallback={<PreLoader isLoading message="Loading page data" />}>
              <Outlet />
            </Suspense>
          </Box>
        </Box>
      </Box>
    </ConfirmationModalContextProvider>
  );
}
