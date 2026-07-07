import React, { useState, useEffect } from 'react'
import { useAuth } from './AuthWrapper'
import { 
  fetchInstitutes, 
  createInstitute, 
  regenerateInviteCode, 
  adminUpdateInviteCode,
  deleteInstitute,
  fetchAllProfiles, 
  adminAssignInstitute, 
  adminSetRole 
} from './supabaseData'

export default function AdminPanel() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('institutes') // 'institutes' | 'users'
  const [institutes, setInstitutes] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  
  // Modals / Actions state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newInstName, setNewInstName] = useState('')
  const [newInstCode, setNewInstCode] = useState('')
  const [editingInstId, setEditingInstId] = useState(null)
  const [editingInstCode, setEditingInstCode] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setErrorMsg(null)
    const instRes = await fetchInstitutes()
    const profRes = await fetchAllProfiles()

    if (instRes.error) {
      setErrorMsg(instRes.error)
    } else if (profRes.error) {
      setErrorMsg(profRes.error)
    } else {
      setInstitutes(instRes.data || [])
      setProfiles(profRes.data || [])
    }
    setLoading(false)
  }

  function showSuccess(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  async function handleCreateInstitute(e) {
    e.preventDefault()
    if (!newInstName.trim()) return
    setActionLoading(true)
    setErrorMsg(null)
    const { data, error } = await createInstitute(newInstName.trim(), newInstCode.trim() || null)
    setActionLoading(false)
    if (error) {
      setErrorMsg(error)
    } else {
      showSuccess(`Institute "${newInstName}" created successfully!`)
      setNewInstName('')
      setNewInstCode('')
      setShowCreateModal(false)
      loadData()
    }
  }

  async function handleUpdateCode(instId, name, newCode) {
    if (!newCode.trim()) return
    setActionLoading(true)
    setErrorMsg(null)
    const { error } = await adminUpdateInviteCode(instId, newCode.trim())
    setActionLoading(false)
    if (error) {
      setErrorMsg(error)
    } else {
      showSuccess(`Updated invite code for ${name} to "${newCode.trim()}"`)
      setEditingInstId(null)
      loadData()
    }
  }

  async function handleRegenerateCode(instId, name) {
    if (!confirm(`Are you sure you want to regenerate the invite code for "${name}"? Previous code will no longer work.`)) return
    setActionLoading(true)
    setErrorMsg(null)
    const { code, error } = await regenerateInviteCode(instId)
    setActionLoading(false)
    if (error) {
      setErrorMsg(error)
    } else {
      showSuccess(`Regenerated code for ${name}: ${code}`)
      loadData()
    }
  }

  async function handleDeleteInstitute(instId, name) {
    if (!confirm(`Are you sure you want to delete "${name}"? All student/instructor links to this institute will be cleared.`)) return
    setActionLoading(true)
    setErrorMsg(null)
    const { error } = await deleteInstitute(instId)
    setActionLoading(false)
    if (error) {
      setErrorMsg(error)
    } else {
      showSuccess(`Deleted institute "${name}"`)
      loadData()
    }
  }

  async function handleRoleChange(profileId, name, newRole) {
    if (profileId === user.id) {
      alert("You cannot change your own role.")
      return
    }
    if (!confirm(`Are you sure you want to change ${name}'s role to "${newRole}"?`)) return
    setActionLoading(true)
    setErrorMsg(null)
    const { error } = await adminSetRole(profileId, newRole)
    setActionLoading(false)
    if (error) {
      setErrorMsg(error)
    } else {
      showSuccess(`Changed ${name}'s role to ${newRole}`)
      loadData()
    }
  }

  async function handleAssignInstitute(profileId, name, instId) {
    setActionLoading(true)
    setErrorMsg(null)
    const { error } = await adminAssignInstitute(profileId, instId)
    setActionLoading(false)
    if (error) {
      setErrorMsg(error)
    } else {
      showSuccess(`Updated institute assignment for ${name}`)
      loadData()
    }
  }

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text)
    showSuccess(`Copied invite code for ${label}!`)
  }

  // Filter profiles based on search
  const filteredProfiles = profiles.filter(p => {
    const term = userSearch.toLowerCase()
    return (p.display_name || '').toLowerCase().includes(term) || (p.id || '').toLowerCase().includes(term)
  })

  // Group student/instructor counts client-side
  const instStats = React.useMemo(() => {
    const stats = {}
    institutes.forEach(inst => {
      stats[inst.id] = { students: 0, instructors: 0 }
    })
    profiles.forEach(p => {
      if (p.institute_id && stats[p.institute_id]) {
        if (p.role === 'student') stats[p.institute_id].students++
        if (p.role === 'instructor') stats[p.institute_id].instructors++
      }
    })
    return stats
  }, [institutes, profiles])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-400">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div>
          <p>Loading Admin Dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Super Admin Control Panel
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage Coaching Institutes & User Roles</p>
        </div>

        {/* Success/Error Alerts */}
        <div className="w-full md:w-auto flex flex-col gap-2">
          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-2 rounded-xl animate-pulse">
              ✓ {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs px-4 py-2 rounded-xl">
              ⚠️ {errorMsg}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Navigation Tabs */}
        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 mb-8 max-w-sm">
          <button
            onClick={() => setActiveTab('institutes')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'institutes'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🏫 Institutes ({institutes.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'users'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            👥 Users ({profiles.length})
          </button>
        </div>

        {/* Tab 1: Institutes */}
        {activeTab === 'institutes' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Registered Coaching Institutes</h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-1.5"
              >
                <span>+</span> Add Institute
              </button>
            </div>

            {institutes.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center text-slate-500">
                No institutes registered yet. Click "Add Institute" to get started.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {institutes.map(inst => {
                  const stats = instStats[inst.id] || { students: 0, instructors: 0 }
                  return (
                    <div
                      key={inst.id}
                      className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col justify-between hover:border-indigo-500/30 transition-all shadow-xl"
                    >
                      <div>
                        <h3 className="text-lg font-bold text-white mb-2">{inst.name}</h3>
                        <p className="text-[10px] text-slate-500 mb-4">ID: {inst.id}</p>

                        <div className="mb-4 bg-slate-900/50 border border-white/5 rounded-xl p-3 flex items-center justify-between">
                          {editingInstId === inst.id ? (
                            <div className="flex gap-2 w-full">
                              <input
                                type="text"
                                value={editingInstCode}
                                onChange={e => setEditingInstCode(e.target.value.toUpperCase())}
                                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-amber-400 font-mono font-bold tracking-wider w-full outline-none focus:border-indigo-500"
                                placeholder="CUSTOM_CODE"
                                autoFocus
                              />
                              <button
                                onClick={() => handleUpdateCode(inst.id, inst.name, editingInstCode)}
                                className="text-emerald-400 hover:text-emerald-300 font-bold text-xs px-1"
                                title="Save Code"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setEditingInstId(null)}
                                className="text-slate-500 hover:text-slate-400 font-bold text-xs px-1"
                                title="Cancel"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <>
                              <div>
                                <span className="text-[10px] text-slate-500 block uppercase font-mono">Invite Code</span>
                                <span 
                                  className="text-sm font-mono font-bold tracking-wider text-amber-400 cursor-pointer hover:underline"
                                  onClick={() => {
                                    setEditingInstId(inst.id)
                                    setEditingInstCode(inst.invite_code)
                                  }}
                                  title="Click to edit custom code"
                                >
                                  {inst.invite_code} ✏️
                                </span>
                              </div>
                              <button
                                onClick={() => copyToClipboard(inst.invite_code, inst.name)}
                                className="bg-white/5 hover:bg-white/10 p-2 rounded-lg text-xs"
                                title="Copy Invite Code"
                              >
                                📋
                              </button>
                            </>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="bg-white/5 p-3 rounded-xl text-center">
                            <span className="text-2xl font-bold text-indigo-400">{stats.students}</span>
                            <span className="text-[10px] text-slate-500 block">Students</span>
                          </div>
                          <div className="bg-white/5 p-3 rounded-xl text-center">
                            <span className="text-2xl font-bold text-purple-400">{stats.instructors}</span>
                            <span className="text-[10px] text-slate-500 block">Instructors</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs pt-4 border-t border-white/5">
                        <span className="text-slate-500 font-mono">Joined {new Date(inst.created_at).toLocaleDateString()}</span>
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleRegenerateCode(inst.id, inst.name)}
                            disabled={actionLoading}
                            className="text-amber-500 hover:text-amber-400 font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                            title="Regenerate Random Code"
                          >
                            🔄 Regen
                          </button>
                          <button
                            onClick={() => handleDeleteInstitute(inst.id, inst.name)}
                            disabled={actionLoading}
                            className="text-rose-500 hover:text-rose-400 font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                            title="Delete Institute"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Users */}
        {activeTab === 'users' && (
          <div>
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-white">User Accounts</h2>
              <input
                type="text"
                placeholder="🔍 Search users by name or UUID..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm w-full md:max-w-md outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-slate-400 font-medium text-xs uppercase tracking-wider">
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Linked Institute</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredProfiles.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                          No users found.
                        </td>
                      </tr>
                    ) : (
                      filteredProfiles.map(p => (
                        <tr key={p.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {p.avatar_url ? (
                                <img
                                  src={p.avatar_url}
                                  alt={p.display_name}
                                  className="w-8 h-8 rounded-full ring-1 ring-white/10"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-indigo-400 text-xs">
                                  {(p.display_name || 'U')[0].toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-white">{p.display_name || 'UPSC Aspirant'}</p>
                                <p className="text-[10px] text-slate-500 font-mono">{p.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={p.role}
                              onChange={e => handleRoleChange(p.id, p.display_name, e.target.value)}
                              disabled={actionLoading || p.id === user.id}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider outline-none border border-transparent ${
                                p.role === 'super_admin'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : p.role === 'instructor'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                              }`}
                            >
                              <option value="student" className="bg-slate-950 text-slate-200">Student</option>
                              <option value="instructor" className="bg-slate-950 text-slate-200">Instructor</option>
                              <option value="super_admin" className="bg-slate-950 text-slate-200">Super Admin</option>
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            {p.role === 'super_admin' ? (
                              <span className="text-slate-500 text-xs italic">N/A (Super Admin)</span>
                            ) : (
                              <select
                                value={p.institute_id || ''}
                                onChange={e => handleAssignInstitute(p.id, p.display_name, e.target.value || null)}
                                disabled={actionLoading}
                                className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 max-w-xs outline-none focus:border-indigo-500"
                              >
                                <option value="">No Institute / Independent</option>
                                {institutes.map(inst => (
                                  <option key={inst.id} value={inst.id}>
                                    {inst.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right text-xs text-slate-500 font-mono">
                            Joined {new Date(p.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Create Institute */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-in">
            <h3 className="text-lg font-bold text-white mb-4">Create Coaching Institute</h3>
            <form onSubmit={handleCreateInstitute} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 uppercase font-semibold">Institute Name</label>
                <input
                  type="text"
                  required
                  placeholder="Enter your Institute's name here"
                  value={newInstName}
                  onChange={e => setNewInstName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 mb-3"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 uppercase font-semibold">Custom Invite Code (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. DELHI100 (auto-generated if empty)"
                  value={newInstCode}
                  onChange={e => setNewInstCode(e.target.value.toUpperCase())}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 font-mono tracking-wider"
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                >
                  {actionLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
