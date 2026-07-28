// QueryClient comparte caché, reintentos e invalidaciones entre las páginas.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouter } from './routes/index.jsx';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  );
}

export default App;
