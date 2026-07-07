import React, { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import AdminPanel from './AdminPanel'
import InstructorDashboard from './InstructorDashboard'
import { joinInstitute } from './supabaseData'

/* ─── Auth Context ─── */
const AuthContext = createContext(null)

/**
 * Hook to access the authenticated user's session, user object, profile, and supabase client.
 * Returns { session, user, profile, setProfile, supabase } or null if not inside AuthWrapper.
 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthWrapper')
  return ctx
}

export default function AuthWrapper({ children }) {
  const [session, setSession]   = useState(null)
  const [profile, setProfile]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState(null)
  const [showInviteModal, setShowInviteModal] = useState(false)

  // Fetch user profile from Supabase
  const loadProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      
      if (!error && data) {
        setProfile(data)
        // If they are not super_admin and have no institute, show invite code onboarding
        if (data.role !== 'super_admin' && !data.institute_id) {
          setShowInviteModal(true)
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Validate session with Supabase server
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        supabase.auth.getUser().then(({ data: { user }, error }) => {
          if (error || !user) {
            setSession(null)
            setProfile(null)
            setLoading(false)
          } else {
            setSession(session)
            loadProfile(user.id)
          }
        })
      } else {
        setSession(null)
        setProfile(null)
        setLoading(false)
      }
    })

    // Listen for login/logout changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session)
        loadProfile(session.user.id)
      } else {
        setSession(null)
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleAuthSuccess = useCallback((session) => {
    setSession(session)
    loadProfile(session.user.id)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }

  const handleJoinInstituteSubmit = async (e) => {
    e.preventDefault()
    if (!inviteCode.trim()) return
    setJoining(true)
    setJoinError(null)
    const { instituteName, error } = await joinInstitute(inviteCode.trim())
    setJoining(false)
    if (error) {
      setJoinError(error)
    } else {
      setShowInviteModal(false)
      // Reload profile to get updated institute_id
      if (session?.user) {
        loadProfile(session.user.id)
      }
    }
  }

  // Still checking session
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center animate-pulse">
            <span className="text-2xl">🎯</span>
          </div>
          <p className="text-slate-400 text-sm">Loading your tracker...</p>
        </div>
      </div>
    )
  }

  // Not logged in → show Auth screen
  if (!session) {
    return <Auth onAuthSuccess={handleAuthSuccess} />
  }

  const user = session.user
  const displayName = profile?.display_name 
    || user.user_metadata?.full_name
    || user.user_metadata?.name
    || user.phone
    || user.email
    || 'User'
  const avatar = profile?.avatar_url || user.user_metadata?.avatar_url || null

  const renderContent = () => {
    if (!profile) return children
    if (profile.role === 'super_admin') {
      return <AdminPanel />
    }
    if (profile.role === 'instructor') {
      return <InstructorDashboard />
    }
    return children
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, setProfile, supabase }}>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* ── User bar at top ── */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-700/50 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {avatar ? (
              <img
                src={avatar}
                alt={displayName}
                className="w-7 h-7 rounded-full ring-2 ring-indigo-500/50"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                {displayName[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-white leading-tight">{displayName}</p>
                {profile?.role && (
                  <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                    profile.role === 'super_admin' 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : profile.role === 'instructor'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                  }`}>
                    {profile.role}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">{user.email || user.phone}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-slate-400 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
          >
            Sign out
          </button>
        </div>

        {/* Spacer so content doesn't hide under user bar */}
        <div className="h-11" />

        {/* Render App Content based on Role */}
        {renderContent()}

        {/* Modal: Join Institute Onboarding */}
        {showInviteModal && profile?.role !== 'super_admin' && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl text-center">
              <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl">
                🏫
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Join a Coaching Institute</h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                If your institute has provided an invite code, enter it below to sync with your cohort dashboard. Otherwise, you can skip and study independently.
              </p>
              
              <form onSubmit={handleJoinInstituteSubmit} className="space-y-4">
                <input
                  type="text"
                  placeholder="Enter 8-character code (e.g. ALPHA123)"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center text-sm text-white font-mono tracking-wider outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  required
                />
                
                {joinError && (
                  <p className="text-rose-400 text-xs text-left">⚠️ {joinError}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 py-3 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors"
                  >
                    Skip & Study Solo
                  </button>
                  <button
                    type="submit"
                    disabled={joining || !inviteCode.trim()}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                  >
                    {joining ? 'Joining...' : 'Submit Code'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AuthContext.Provider>
  )
}