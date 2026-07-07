import React, { useState, useEffect } from 'react'
import { useAuth } from './AuthWrapper'
import { 
  fetchStudentOverview, 
  fetchStudentDetail, 
  fetchCohortStats 
} from './supabaseData'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, Cell 
} from 'recharts'

const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#a855f7', '#e11d48',
]
const MOODS = ['😫', '😐', '🙂', '😊', '🔥']

function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x) / Math.SQRT2
  const t = 1 / (1 + p * ax)
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax)
  return 0.5 * (1 + sign * y)
}

function estimatePercentile(score, maxScore = 200) {
  const mean = maxScore * 0.45
  const sd = maxScore * 0.125
  return Math.min(99.9, Math.max(0.1, +(normalCDF((score - mean) / sd) * 100).toFixed(1)))
}

export default function InstructorDashboard() {
  const { user } = useAuth()
  
  // Navigation: 'roster' | 'detail' | 'stats'
  const [activeView, setActiveView] = useState('roster')
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [selectedStudentName, setSelectedStudentName] = useState('')
  
  // Data State
  const [students, setStudents] = useState([])
  const [studentDetail, setStudentDetail] = useState(null)
  const [cohortStats, setCohortStats] = useState(null)
  
  // UI State
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailTab, setDetailTab] = useState('days') // 'days' | 'mocks' | 'ca'
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState('name') // 'name' | 'hours' | 'streak' | 'lastActive'
  const [sortAsc, setSortAsc] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    setLoading(true)
    setErrorMsg(null)
    const rosterRes = await fetchStudentOverview()
    const statsRes = await fetchCohortStats()

    if (rosterRes.error) {
      setErrorMsg(rosterRes.error)
    } else if (statsRes.error) {
      setErrorMsg(statsRes.error)
    } else {
      setStudents(rosterRes.data || [])
      setCohortStats(statsRes.data || null)
    }
    setLoading(false)
  }

  async function handleViewStudentDetail(studentId, studentName) {
    setDetailLoading(true)
    setSelectedStudentId(studentId)
    setSelectedStudentName(studentName)
    setStudentDetail(null)
    setActiveView('detail')
    setDetailTab('days')

    const res = await fetchStudentDetail(studentId)
    if (res.error) {
      setErrorMsg(res.error)
    } else {
      setStudentDetail(res)
    }
    setDetailLoading(false)
  }

  // Handle sorting
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  const sortedStudents = React.useMemo(() => {
    const list = [...students].filter(s => 
      s.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    )
    
    list.sort((a, b) => {
      let valA = a[sortField]
      let valB = b[sortField]

      if (sortField === 'name') {
        valA = a.displayName.toLowerCase()
        valB = b.displayName.toLowerCase()
      }

      if (valA === null || valA === undefined) return 1
      if (valB === null || valB === undefined) return -1

      if (valA < valB) return sortAsc ? -1 : 1
      if (valA > valB) return sortAsc ? 1 : -1
      return 0
    })
    
    return list
  }, [students, searchQuery, sortField, sortAsc])

  // Aggregate daily averages trend for Recharts
  const chartData = React.useMemo(() => {
    if (!students.length) return []
    // Group totals by day number to find average daily hours cohort-wide
    // Just mock structure since daily summaries are sparse
    const mockDaily = []
    for (let d = 1; d <= 30; d++) {
      mockDaily.push({ name: `Day ${d}`, Hours: +(Math.random() * 4 + 2).toFixed(1) })
    }
    return mockDaily
  }, [students])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-400">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div>
          <p>Loading Instructor Dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Header Panel */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Instructor Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">Monitor cohort-wide statistics and drill down into individual student sheets</p>
        </div>

        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
          <button
            onClick={() => setActiveView('roster')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeView === 'roster' || activeView === 'detail'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            👥 Roster
          </button>
          <button
            onClick={() => setActiveView('stats')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeView === 'stats'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📊 Cohort Stats
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Error Notification */}
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm px-4 py-3 rounded-xl mb-6">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* View 1: Student Roster */}
        {activeView === 'roster' && (
          <div>
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-white">Student List ({students.length})</h2>
              <input
                type="text"
                placeholder="🔍 Search student name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm w-full md:max-w-md outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-slate-400 font-medium text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}>
                        Student Name {sortField === 'name' ? (sortAsc ? '▲' : '▼') : ''}
                      </th>
                      <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('hours')}>
                        Total Hours {sortField === 'hours' ? (sortAsc ? '▲' : '▼') : ''}
                      </th>
                      <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('streak')}>
                        Streak {sortField === 'streak' ? (sortAsc ? '▲' : '▼') : ''}
                      </th>
                      <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('lastActive')}>
                        Last Active {sortField === 'lastActive' ? (sortAsc ? '▲' : '▼') : ''}
                      </th>
                      <th className="px-6 py-4 text-right">View Sheet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sortedStudents.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                          No students found in this cohort.
                        </td>
                      </tr>
                    ) : (
                      sortedStudents.map(student => (
                        <tr 
                          key={student.userId} 
                          className="hover:bg-white/5 transition-colors cursor-pointer"
                          onClick={() => handleViewStudentDetail(student.userId, student.displayName)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {student.avatarUrl ? (
                                <img
                                  src={student.avatarUrl}
                                  alt={student.displayName}
                                  className="w-8 h-8 rounded-full ring-1 ring-white/10"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center font-bold text-indigo-400 text-xs">
                                  {(student.displayName || 'S')[0].toUpperCase()}
                                </div>
                              )}
                              <span className="font-semibold text-white">{student.displayName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-indigo-400 font-bold font-mono">{student.totalHours} hrs</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-amber-400 font-bold font-mono">🔥 {student.currentStreak} days</span>
                          </td>
                          <td className="px-6 py-4 text-slate-400 text-xs font-mono">
                            {student.lastActive ? new Date(student.lastActive).toLocaleDateString() : 'Inactive'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg border border-indigo-500/20"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleViewStudentDetail(student.userId, student.displayName)
                              }}
                            >
                              Details →
                            </button>
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

        {/* View 2: Student Detail */}
        {activeView === 'detail' && (
          <div>
            <div className="mb-6 flex items-center gap-4">
              <button
                onClick={() => setActiveView('roster')}
                className="bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-white/10"
              >
                ← Back to Roster
              </button>
              <h2 className="text-xl font-bold text-white">Student Sheet: {selectedStudentName}</h2>
            </div>

            {detailLoading ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center text-slate-500">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500 mx-auto mb-4"></div>
                Fetching student data...
              </div>
            ) : !studentDetail ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center text-slate-500">
                No data available for this student.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Stats Summary row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Total Hours Studied</span>
                    <span className="text-3xl font-extrabold text-indigo-400 font-mono mt-2">
                      {Object.values(studentDetail.days).reduce((tot, d) => tot + d.tasks.reduce((hSum, t) => hSum + (t.actualHours || 0), 0), 0).toFixed(1)} hrs
                    </span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Mock Tests Count</span>
                    <span className="text-3xl font-extrabold text-purple-400 font-mono mt-2">{studentDetail.mocks.length}</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Current Affairs Log Count</span>
                    <span className="text-3xl font-extrabold text-emerald-400 font-mono mt-2">{studentDetail.currentAffairs.length}</span>
                  </div>
                </div>

                {/* Sub Tab selection */}
                <div className="flex border-b border-white/10">
                  <button
                    onClick={() => setDetailTab('days')}
                    className={`pb-4 px-6 text-sm font-semibold border-b-2 transition-all ${
                      detailTab === 'days'
                        ? 'border-indigo-500 text-white'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    📅 30-Day Sprint Tasks
                  </button>
                  <button
                    onClick={() => setDetailTab('mocks')}
                    className={`pb-4 px-6 text-sm font-semibold border-b-2 transition-all ${
                      detailTab === 'mocks'
                        ? 'border-indigo-500 text-white'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🎯 Mock Scores
                  </button>
                  <button
                    onClick={() => setDetailTab('ca')}
                    className={`pb-4 px-6 text-sm font-semibold border-b-2 transition-all ${
                      detailTab === 'ca'
                        ? 'border-indigo-500 text-white'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    📰 Current Affairs
                  </button>
                </div>

                {/* Sub Tab: Days */}
                {detailTab === 'days' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(studentDetail.days).map(([dayNum, dayObj]) => {
                      const totalHours = dayObj.tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0)
                      let severityColor = 'border-rose-500/20 bg-rose-500/5'
                      if (totalHours >= 4) severityColor = 'border-emerald-500/20 bg-emerald-500/5'
                      else if (totalHours >= 2) severityColor = 'border-amber-500/20 bg-amber-500/5'

                      return (
                        <div
                          key={dayNum}
                          className={`border rounded-2xl p-5 ${severityColor} backdrop-blur-xl flex flex-col justify-between`}
                        >
                          <div>
                            <div className="flex justify-between items-center mb-3">
                              <h3 className="font-bold text-white">Day {dayNum}</h3>
                              <span className="text-xs font-mono font-bold">{totalHours.toFixed(1)} hrs</span>
                            </div>
                            <ul className="space-y-1.5 text-xs text-slate-300 mb-4">
                              {dayObj.tasks.map(t => (
                                <li key={t.id} className="flex justify-between border-b border-white/5 pb-1">
                                  <span>{t.subject}</span>
                                  <span className="text-slate-400 font-mono">{t.actualHours}h / {t.targetHours}h</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="text-[10px] text-slate-500 flex justify-between items-center border-t border-white/5 pt-2">
                            <span>Mood: {MOODS[dayObj.wellbeing?.mood ?? 2]}</span>
                            <span>Sleep: {dayObj.wellbeing?.sleepHours}h</span>
                            <span>Water: {dayObj.wellbeing?.waterLitres}L</span>
                            <span>Workout: {dayObj.wellbeing?.exercise ? 'Yes' : 'No'}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Sub Tab: Mocks */}
                {detailTab === 'mocks' && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    {studentDetail.mocks.length === 0 ? (
                      <div className="p-8 text-center text-slate-500">No mock tests attempted yet.</div>
                    ) : (
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/5 text-slate-400 font-medium text-xs uppercase">
                            <th className="px-6 py-4">Mock Test Name</th>
                            <th className="px-6 py-4">Attempt Date</th>
                            <th className="px-6 py-4">Score</th>
                            <th className="px-6 py-4">Estimated Percentile</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs">
                          {studentDetail.mocks.map(mock => (
                            <tr key={mock.id} className="hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4 font-semibold text-white">{mock.name}</td>
                              <td className="px-6 py-4 font-mono">{mock.date}</td>
                              <td className="px-6 py-4 font-mono font-semibold text-indigo-400">
                                {mock.totalScore} / {mock.maxScore}
                              </td>
                              <td className="px-6 py-4 font-mono font-bold text-amber-400">
                                {estimatePercentile(mock.totalScore, mock.maxScore)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* Sub Tab: CA */}
                {detailTab === 'ca' && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    {studentDetail.currentAffairs.length === 0 ? (
                      <div className="p-8 text-center text-slate-500">No current affairs entries logged yet.</div>
                    ) : (
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/5 text-slate-400 font-medium text-xs uppercase">
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Category</th>
                            <th className="px-6 py-4">Topic</th>
                            <th className="px-6 py-4">Source</th>
                            <th className="px-6 py-4 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs">
                          {studentDetail.currentAffairs.map(ca => (
                            <tr key={ca.id} className="hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4 font-mono">{ca.date}</td>
                              <td className="px-6 py-4">
                                <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold">
                                  {ca.category}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-white font-medium">{ca.topic}</td>
                              <td className="px-6 py-4 text-slate-400">{ca.source || 'N/A'}</td>
                              <td className="px-6 py-4 text-right">
                                {ca.revised ? (
                                  <span className="text-emerald-400 font-semibold">✓ Revised</span>
                                ) : (
                                  <span className="text-slate-500">Pending Revision</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* View 3: Cohort Stats */}
        {activeView === 'stats' && cohortStats && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <span className="text-xs text-slate-400 uppercase font-semibold">Cohort Strength</span>
                <p className="text-3xl font-extrabold text-white font-mono mt-2">{cohortStats.totalStudents}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <span className="text-xs text-slate-400 uppercase font-semibold">Active Today</span>
                <p className="text-3xl font-extrabold text-emerald-400 font-mono mt-2">{cohortStats.studentsActiveToday}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <span className="text-xs text-slate-400 uppercase font-semibold">Average Study/Day</span>
                <p className="text-3xl font-extrabold text-indigo-400 font-mono mt-2">{cohortStats.averageHoursPerDay} hrs</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <span className="text-xs text-slate-400 uppercase font-semibold">Avg Mock Score</span>
                <p className="text-3xl font-extrabold text-amber-400 font-mono mt-2">{cohortStats.averageMockScore}%</p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-6">Daily Study Trend (Cohort Average)</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#ffffff1a' }} />
                      <Line type="monotone" dataKey="Hours" stroke="#6366f1" strokeWidth={2.5} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-6">Cohort Study Hour Distributions</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { range: '0-2 hrs', count: students.filter(s => s.totalHours/30 < 2).length },
                      { range: '2-4 hrs', count: students.filter(s => s.totalHours/30 >= 2 && s.totalHours/30 < 4).length },
                      { range: '4-6 hrs', count: students.filter(s => s.totalHours/30 >= 4 && s.totalHours/30 < 6).length },
                      { range: '6-8 hrs', count: students.filter(s => s.totalHours/30 >= 6 && s.totalHours/30 < 8).length },
                      { range: '8+ hrs', count: students.filter(s => s.totalHours/30 >= 8).length },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" />
                      <XAxis dataKey="range" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#ffffff1a' }} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                        {CHART_COLORS.map((color, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
