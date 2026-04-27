import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AnalysisProvider } from '@context/AnalysisContext';
import { ColorModeProvider } from '@context/ColorModeContext';
import AppHandler from '@app/AppHandler';

const queryClient = new QueryClient();

function App() {
  return (
    <ColorModeProvider>
      <QueryClientProvider client={queryClient}>
        <AnalysisProvider>
          <AppHandler />
        </AnalysisProvider>
      </QueryClientProvider>
    </ColorModeProvider>
  );
}

export default App;
