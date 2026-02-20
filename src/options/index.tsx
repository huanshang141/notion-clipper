/**
 * Options Page Entry Point
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import SettingsPage from './SettingsPage';
import './options.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <React.StrictMode>
    <SettingsPage />
  </React.StrictMode>
);
