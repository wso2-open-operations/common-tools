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
import { Box, Tooltip, Typography, useTheme } from "@mui/material";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import { Link, useLocation } from "react-router-dom";

export default function BasicBreadcrumbs() {
  const MAX_LENGTH = 5;

  const location = useLocation();
  const theme = useTheme();

  const { pathname } = location;
  const pathnames = pathname === "/" ? [] : pathname.split("/");

  const renderBreadCrumbs = () => {
    let routeTo = "";

    return (
      <Box
        sx={{
          display: "flex",
          gap: 1,
        }}
      >
        <Breadcrumbs
          separator="›"
          aria-label="breadcrumb"
          sx={{
            "& .MuiBreadcrumbs-separator": {
              mx: "8px",
            },
          }}
        >
          {pathnames.map((path, index) => {
            const isLong = path.length > MAX_LENGTH;
            const isLast = pathnames.length - 1 === index;
            routeTo += `${path}/`;

            const label =
              !isLast && isLong ? (
                <Typography
                  key={`${path}-short`}
                  variant="caption"
                  sx={{ color: theme.palette.customText.primary.p3.active }}
                >
                  {path.slice(0, 4)}...
                </Typography>
              ) : (
                <Typography
                  key={`${path}-full`}
                  variant="caption"
                  sx={{ color: theme.palette.customText.primary.p3.active }}
                >
                  {path}
                </Typography>
              );

            return isLong && !isLast ? (
              <Tooltip key={path} title={path} placement="bottom">
                <Box
                  component={Link}
                  to={routeTo}
                  sx={{
                    textDecoration: "none",
                    color: theme.palette.customText.primary.p3.active,
                    padding: theme.spacing(0.5),
                    borderRadius: "4px",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    "&:hover": {
                      color: theme.palette.customText.primary.p2.active,
                    },
                  }}
                >
                  {label}
                </Box>
              </Tooltip>
            ) : (
              <Box
                component={Link}
                to={routeTo}
                key={index}
                sx={{
                  textDecoration: "none",
                  padding: theme.spacing(0.5),
                  borderRadius: "4px",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  "&:hover": {
                    color: theme.palette.customText.primary.p2.active,
                  },
                }}
              >
                {label}
              </Box>
            );
          })}
        </Breadcrumbs>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        ml: -0.5,
      }}
    >
      {renderBreadCrumbs()}
    </Box>
  );
}
