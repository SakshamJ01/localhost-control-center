import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { setupMockApiIfNeeded } from './mock/mockApi';
import './index.css';
import './styles/app.css';

setupMockApiIfNeeded();

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
