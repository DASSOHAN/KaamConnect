import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { BrowserRouter } from 'react-router-dom';
import { OpeningAnimation } from './components/OpeningAnimation.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <OpeningAnimation />
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
