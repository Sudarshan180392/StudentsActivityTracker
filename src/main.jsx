import { createRoot } from 'react-dom/client'
import { useState, useEffect } from 'react'
import './index.css'
import AuthWrapper from './AuthWrapper'
import UPSCTracker from './upsc_tracker.jsx'
import LandingPage from './LandingPage.jsx'

function App() {
  const [showApp, setShowApp] = useState(false);

  useEffect(() => {
    if (window.location.hash === '#app' || window.location.hash === '#login') {
      setShowApp(true);
    }
    
    const handleHashChange = () => {
      if (window.location.hash === '#app' || window.location.hash === '#login') {
        setShowApp(true);
      } else {
        setShowApp(false);
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (showApp) {
    return (
      <AuthWrapper>
        <UPSCTracker />
      </AuthWrapper>
    );
  }

  return <LandingPage onGetStarted={() => {
    window.location.hash = '#app';
  }} />
}

createRoot(document.getElementById('root')).render(<App />)
