// Self-hosted, not a Google Fonts <link> — see the `fonts` tokens in
// panda.config.ts for why. Inter is the body face, Space Grotesk the
// display face, IBM Plex Mono the technical-data face. Plex Mono has no
// variable build on fontsource, so its two used weights are imported
// explicitly; the other two are variable and cover their whole range.
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
// Latin subsets only. The mono face renders nothing but digits, hex CRCs
// and size units, so the Cyrillic/Greek/Vietnamese subsets its default
// entrypoint pulls in were 20-odd font files nothing would ever request.
// The body face (Inter) keeps all of its subsets — game names are real
// text and can be in any script.
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '@/App.js';

const queryClient = new QueryClient();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
