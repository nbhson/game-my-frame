import React from 'react';
import ReactDOM from 'react-dom/client';
// import sớm để polyfill crypto.randomUUID trước mọi lib (socket.io...)
import './net/uid';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
