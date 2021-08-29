import React from 'react';
import ReactDOM from 'react-dom';
import Srn from './Srn';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then(() => {
        console.log('SW registered');
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

ReactDOM.render(<Srn />, document.getElementById('root'));
