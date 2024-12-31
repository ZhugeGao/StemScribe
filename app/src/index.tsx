import React from 'react';
import { createRoot } from 'react-dom/client';
import EducationalMaterialGenerator from './components/EducationalMaterialGenerator';
import ErrorBoundary from './components/ErrorBoundary';

const container = document.getElementById('root');
if (!container) throw new Error('Failed to find the root element');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <EducationalMaterialGenerator />
    </ErrorBoundary>
  </React.StrictMode>
);