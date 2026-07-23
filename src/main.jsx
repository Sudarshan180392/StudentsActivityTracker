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
      const search = window.location.search;
      const isAuthCallback = hash.includes('access_token') || search.includes('code=') || hash.includes('error_description') || hash.includes('type=recovery');
      
      if (session || hash === '#app' || hash === '#login' || isAuthCallback) {
        setShowApp(true);
      }
      setIsInitializing(false);
    };
    
    checkSessionAndHash();

    // Listen for auth state changes (crucial for OAuth redirects that process in the background)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setShowApp(true);
      }
    });
    
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#app' || hash === '#login' || hash.includes('access_token')) {
        setShowApp(true);
      } else if (hash === '' || hash === '#') {
        // If they navigate back to root hash, we could hide the app, 
        // but if they are logged in, we shouldn't. 
        // Best to do nothing here and let the auth state handle it.
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      subscription.unsubscribe();
    };
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
