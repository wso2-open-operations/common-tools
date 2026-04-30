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

import { Box, Typography } from '@mui/material';

const Footer = () => {
  return (
    <Box
      component="footer"
      sx={(theme) => ({
        py: 2,
        mt: 'auto',
        borderTop: `1px solid ${theme.palette.surface.border}`,
        textAlign: 'center',
        bgcolor: theme.palette.surface.footerBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      })}
    >
      <Typography
        variant="caption"
        sx={(theme) => ({ color: theme.palette.text.secondary, fontSize: '0.7rem' })}
      >
        Thread Dump Analyzer Tool &copy; {new Date().getFullYear()}
      </Typography>
    </Box>
  );
};

export default Footer;
