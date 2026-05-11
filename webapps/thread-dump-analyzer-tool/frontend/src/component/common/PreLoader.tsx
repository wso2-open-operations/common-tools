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

import { Box, CircularProgress, Typography } from '@mui/material';

interface PreLoaderProps {
  isLoading?: boolean;
  message?: string;
}

const PreLoader = ({ isLoading = true, message }: PreLoaderProps) => {
  return (
    <Box
      sx={(theme) => ({
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        gap: 2,
        background: theme.palette.mode === 'dark' ? '#0a0d12' : '#0d1117',
      })}
    >
      {isLoading && <CircularProgress sx={(theme) => ({ color: theme.palette.brand.main })} size={36} />}
      {message && (
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
          {message}
        </Typography>
      )}
    </Box>
  );
};

export default PreLoader;
