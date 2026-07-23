import { createRoot } from 'react-dom/client'
import { useState, useEffect } from 'react'
import './index.css'
import AuthWrapper from './AuthWrapper'
import UPSCTracker from './upsc_tracker.jsx'
import LandingPage from './LandingPage.jsx'
import { supabase } from './supabaseClient.js'

function App() {
  const [showApp, setShowApp] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const checkSessionAndHash = async () => {
      // Check if user is already logged in
      const { data: { session } } = await supabase.auth.getSession();
      
      const hash = window.location.hash;
      const isAuthCallback = hash.includes('access_token') || hash.includes('error_description') || hash.includes('type=recovery');
      
      if (session || hash === '#app' || hash === '#login' || isAuthCallback) {
        setShowApp(true);
      }
      setIsInitializing(false);
    };
    
    checkSessionAndHash();
    
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#app' || hash === '#login' || hash.includes('access_token')) {
        setShowApp(true);
      } else if (hash === '' || hash === '#') {
        setShowApp(false);
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (isInitializing) {
    return <div className="min-h-screen bg-[#0a0f1c]" /> // Prevent flicker while checking session
  }

  if (showApp) {
    return (
      <AuthWrapper>
        <UPSCTracker />
      </AuthWrapper>
    );
  }

  return <LandingPage onGetStarted={() => {
    window.location.hash = '#login';
  }} />
}

createRoot(document.getElementById('root')).render(<App />)
