import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@everworker/react-ui/styles';
import '@everworker/react-ui/styles/markdown';
import '@everworker/react-ui/styles/chat';
import '@everworker/react-ui/styles/thinking';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
