import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AnalysisProvider } from '@context/AnalysisContext';
import AppHandler from '@app/AppHandler';
import { themeSettings } from '@src/theme';

const queryClient = new QueryClient();
const theme = themeSettings('light');

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AnalysisProvider>
          <AppHandler />
        </AnalysisProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
