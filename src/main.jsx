import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './prototype.css';
import './collection.css';
import './collection-footer.css';
import './collection/page-turn.css';
import './ui-skin.css';
import './motion.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);

