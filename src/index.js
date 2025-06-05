// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// (任意) Web Vitals の計測を使う場合
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ――― ここから Service Worker の登録 ―――
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')    // public/sw.js を指定
      .then((registration) => {
        console.log('Service Worker 登録成功:', registration);
      })
      .catch((error) => {
        console.error('Service Worker 登録失敗:', error);
      });
  });
}

// (任意) Web Vitals を使う場合
reportWebVitals();
