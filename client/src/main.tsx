// React entry point — Chakra Provider + Router

// Polyfills para navegadores antigos (como Android TV)
import ResizeObserver from 'resize-observer-polyfill';

if (typeof window !== 'undefined') {
  if (!window.ResizeObserver) {
    window.ResizeObserver = ResizeObserver;
  }
  if (typeof globalThis === 'undefined') {
    (window as any).globalThis = window;
  }
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider } from '@chakra-ui/react';
import { system } from './theme/system';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChakraProvider value={system}>
      <App />
    </ChakraProvider>
  </React.StrictMode>,
);
