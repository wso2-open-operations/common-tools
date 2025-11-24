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
import { Box, Divider, Stack, Tooltip, Typography, useTheme } from "@mui/material";
import { ChevronLeft, ChevronRight, Moon, Sun } from "lucide-react";

import { useMemo, useState } from "react";

import type { NavState } from "@/types/types";
import SidebarNavItem from "@component/layout/SidebarNavItem";
import pJson from "@root/package.json";
import { ColorModeContext } from "@src/App";
import { getActiveRouteDetails } from "@src/route";

interface SidebarProps {
  open: boolean;
  handleDrawer: () => void;
  roles: string[];
  currentPath: string;
}

const Sidebar = (props: SidebarProps) => {
  const allRoutes = useMemo(() => getActiveRouteDetails(props.roles), [props.roles]);

  // Single state object for nav state
  const [navState, setNavState] = useState<NavState>({
    active: null,
    hovered: null,
    expanded: null,
  });

  // Handlers
  const handleClick = (idx: number) => {
    setNavState((prev) => ({
      ...prev,
      expanded: prev.expanded === idx ? null : idx,
    }));
  };

  const handleMouseEnter = (idx: number) => {
    setNavState((prev) => ({ ...prev, hovered: idx }));
  };

  const handleMouseLeave = () => {
    setNavState((prev) => ({ ...prev, hovered: null }));
  };
  const theme = useTheme();

  const renderControlButton = (
    icon: React.ReactNode,
    onClick?: () => void,
    tooltipTitle?: string,
  ) => {
    const button = (
      <Box
        component="button"
        onClick={onClick}
        disabled={!onClick}
        aria-label={tooltipTitle}
        sx={{
          width: props.open ? "100%" : "fit-content",
          padding: theme.spacing(1),
          borderRadius: "8px",
          cursor: onClick ? "pointer" : "default",
          border: "none",
          background: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: theme.spacing(1),
          color: theme.palette.customNavigation.text,
          transition: "all 0.2s ease-in-out",
          ...(onClick && {
            "&:hover": {
              backgroundColor: theme.palette.customNavigation.hoverBg,
              color: theme.palette.customNavigation.hover,
            },
            "&:active": {
              backgroundColor: theme.palette.customNavigation.clickedBg,
              color: theme.palette.customNavigation.clicked,
            },
          }),
        }}
      >
        {icon}
      </Box>
    );

    // Only show tooltip when sidebar is collapsed
    if (tooltipTitle && !props.open) {
      return (
        <Tooltip
          title={tooltipTitle}
          placement="right"
          arrow
          slotProps={{
            tooltip: {
              sx: {
                backgroundColor: theme.palette.neutral[1700],
                color: theme.palette.neutral.white,
                padding: theme.spacing(0.75, 1),
                borderRadius: "4px",
                fontSize: "12px",
                boxShadow: theme.shadows[8],
              },
            },
            arrow: {
              sx: {
                color: theme.palette.neutral[1700],
              },
            },
          }}
        >
          {button}
        </Tooltip>
      );
    }

    return button;
  };

  return (
    <ColorModeContext.Consumer>
      {(colorMode) => {
        const currentYear = new Date().getFullYear();

        return (
          <Box
            sx={{
              height: "100%",
              paddingY: "16px",
              paddingX: "12px",
              backgroundColor: theme.palette.surface.secondary.active,
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              width: props.open ? "200px" : "fit-content",
              overflow: "visible",
            }}
          >
            {/* Navigation List */}
            <Stack
              direction="column"
              gap={1}
              sx={{
                overflow: "visible",
                width: props.open ? "100%" : "fit-content",
              }}
            >
              {allRoutes.map(
                (route, idx) =>
                  !route.bottomNav && (
                    <Box
                      key={idx}
                      onMouseEnter={() => handleMouseEnter(idx)}
                      onMouseLeave={handleMouseLeave}
                      sx={{
                        width: props.open ? "100%" : "fit-content",
                        cursor: props.open ? "pointer" : "default",
                      }}
                    >
                      <SidebarNavItem
                        route={route}
                        open={props.open}
                        isActive={navState.active === idx}
                        isHovered={navState.hovered === idx}
                        isExpanded={navState.expanded === idx}
                        onClick={() => handleClick(idx)}
                      />
                    </Box>
                  ),
              )}
            </Stack>

            {/* Spacer */}
            <Box sx={{ flexGrow: 1 }} />

            {/* Footer Controls */}
            <Stack
              direction="column"
              gap={1}
              sx={{
                paddingBottom: "20px",
                alignItems: "center",
              }}
            >
              {/* Theme Toggle */}
              {renderControlButton(
                colorMode.mode === "dark" ? <Sun size={18} /> : <Moon size={18} />,
                colorMode.toggleColorMode,
                colorMode.mode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
              )}

              {/* Sidebar Toggle */}
              {renderControlButton(
                !props.open ? <ChevronRight size={20} /> : <ChevronLeft size={20} />,
                props.handleDrawer,
                props.open ? "Collapse Sidebar" : "Expand Sidebar",
              )}

              <Divider
                sx={{
                  width: "100%",
                  backgroundColor: theme.palette.customNavigation.clickedBg,
                }}
              />

              {/* Version Info */}
              {renderControlButton(
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: "nowrap",
                    color: "inherit",
                    width: "100%",
                  }}
                >
                  {props.open
                    ? `v${pJson.version} | © ${currentYear} WSO2 LLC`
                    : `v${pJson.version.split(".")[0]}`}
                </Typography>,
                undefined,
                `Version ${pJson.version}`,
              )}
            </Stack>
          </Box>
        );
      }}
    </ColorModeContext.Consumer>
  );
};

export default Sidebar;
