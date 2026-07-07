// ═══════════════════════════════════════════════════════════════
//  Supabase Data Access Layer
//  All CRUD operations for the UPSC Prep Tracker
// ═══════════════════════════════════════════════════════════════

import { supabase } from './supabaseClient'

/* ─────────────────────── Helpers ─────────────────────── */

/** Map a DB task row (snake_case) to the app shape (camelCase). */
function dbTaskToApp(row) {
  return {
    id: row.id,
    subject: row.subject || '',
    topic: row.topic || '',
    targetHours: row.target_hours || 0,
    actualHours: row.actual_hours || 0,
    notes: row.notes || '',
  }
}

/** Map a DB wellbeing row to the app shape. */
function dbWellbeingToApp(row) {
  return {
    sleepHours: row.sleep_hours ?? 7,
    waterLitres: row.water_litres ?? 2,
    exercise: row.exercise ?? false,
    mood: row.mood ?? 2,
  }
}

/** Map a DB settings row to the app shape. */
function dbSettingsToApp(row) {
  return {
    examDate: row.exam_date || '2027-05-23',
    periodName: row.period_name || '30-Day Sprint',
    subjects: row.subjects || ['History','Geography','Polity','Economy','Science & Tech','Environment','CSAT','Ethics','Essay'],
    showWellbeing: row.show_wellbeing ?? true,
    darkMode: row.dark_mode ?? false,
  }
}

/** Map a DB current affairs row to the app shape. */
function dbCAToApp(row) {
  return {
    id: row.id,
    date: row.date || '',
    topic: row.topic || '',
    category: row.category || 'Polity',
    source: row.source || '',
    notes: row.notes || '',
    revised: row.revised ?? false,
  }
}

/** Default wellbeing for a day that has no DB row. */
const DEFAULT_WELLBEING = { sleepHours: 7, waterLitres: 2, exercise: false, mood: 2 }

/* ═══════════════════════════════════════════════════════════════
   FETCH ALL USER DATA
   ═══════════════════════════════════════════════════════════════ */

/**
 * Fetches all data for a user in parallel.
 * @param {string} userId
 * @returns {{ settings: object|null, days: object, mocks: array, currentAffairs: array, error: string|null }}
 */
export async function fetchAllUserData(userId) {
  try {
    const [settingsRes, tasksRes, wellbeingRes, mocksRes, scoresRes, caRes] = await Promise.all([
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('day_tasks').select('*').eq('user_id', userId).order('day_number').order('sort_order'),
      supabase.from('day_wellbeing').select('*').eq('user_id', userId).order('day_number'),
      supabase.from('mock_tests').select('*').eq('user_id', userId).order('created_at'),
      supabase.from('mock_subject_scores').select('*').eq('user_id', userId),
      supabase.from('current_affairs').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ])

    // Check for errors
    for (const res of [settingsRes, tasksRes, wellbeingRes, mocksRes, scoresRes, caRes]) {
      if (res.error) return { settings: null, days: {}, mocks: [], currentAffairs: [], error: res.error.message }
    }

    // ── Transform settings ──
    const settings = settingsRes.data ? dbSettingsToApp(settingsRes.data) : null

    // ── Transform days (tasks + wellbeing) ──
    const days = {}

    // Group tasks by day_number
    const tasksByDay = {}
    for (const row of (tasksRes.data || [])) {
      if (!tasksByDay[row.day_number]) tasksByDay[row.day_number] = []
      tasksByDay[row.day_number].push(dbTaskToApp(row))
    }

    // Index wellbeing by day_number
    const wellbeingByDay = {}
    for (const row of (wellbeingRes.data || [])) {
      wellbeingByDay[row.day_number] = dbWellbeingToApp(row)
    }

    // Build days 1-30
    for (let d = 1; d <= 30; d++) {
      days[d] = {
        tasks: tasksByDay[d] || [],
        wellbeing: wellbeingByDay[d] || { ...DEFAULT_WELLBEING },
      }
    }

    // ── Transform mocks (re-nest subject scores) ──
    const scoresByMock = {}
    for (const row of (scoresRes.data || [])) {
      if (!scoresByMock[row.mock_id]) scoresByMock[row.mock_id] = {}
      scoresByMock[row.mock_id][row.subject] = {
        correct: row.correct || 0,
        wrong: row.wrong || 0,
        skipped: row.skipped || 0,
      }
    }

    const mocks = (mocksRes.data || []).map(m => ({
      id: m.id,
      name: m.name || '',
      date: m.date || '',
      totalScore: m.total_score || 0,
      maxScore: m.max_score || 200,
      subjectScores: scoresByMock[m.id] || {},
    }))

    // ── Transform current affairs ──
    const currentAffairs = (caRes.data || []).map(dbCAToApp)

    return { settings, days, mocks, currentAffairs, error: null }
  } catch (err) {
    return { settings: null, days: {}, mocks: [], currentAffairs: [], error: err.message }
  }
}

/* ═══════════════════════════════════════════════════════════════
   SETTINGS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Upsert user settings.
 * @param {string} userId
 * @param {object} settings - App-shape settings object
 * @returns {{ error: string|null }}
 */
export async function upsertSettings(userId, settings) {
  try {
    const { error } = await supabase.from('user_settings').upsert({
      user_id: userId,
      exam_date: settings.examDate,
      period_name: settings.periodName,
      subjects: settings.subjects,
      show_wellbeing: settings.showWellbeing,
      dark_mode: settings.darkMode,
    }, { onConflict: 'user_id' })
    return { error: error?.message || null }
  } catch (err) {
    return { error: err.message }
  }
}

/* ═══════════════════════════════════════════════════════════════
   DAY TASKS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Replace all tasks for a given day with new ones (delete + insert).
 * @param {string} userId
 * @param {number} dayNumber - 1-30
 * @param {Array} tasks - App-shape task objects
 * @returns {{ data: Array|null, error: string|null }}
 */
export async function upsertDayTasks(userId, dayNumber, tasks) {
  try {
    // Delete existing tasks for this user+day
    const { error: delErr } = await supabase
      .from('day_tasks')
      .delete()
      .eq('user_id', userId)
      .eq('day_number', dayNumber)
    if (delErr) return { data: null, error: delErr.message }

    // Insert new tasks
    if (tasks.length === 0) return { data: [], error: null }

    const rows = tasks.map((t, i) => {
      const row = {
        user_id: userId,
        day_number: dayNumber,
        sort_order: i,
        subject: t.subject || '',
        topic: t.topic || '',
        target_hours: t.targetHours || 0,
        actual_hours: t.actualHours || 0,
        notes: t.notes || '',
      };
      // Retain task ID if it is a valid UUID to prevent focus loss in React UI on auto-save
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (t.id && uuidRegex.test(t.id)) {
        row.id = t.id;
      }
      return row;
    });

    const { data, error } = await supabase
      .from('day_tasks')
      .insert(rows)
      .select()
      .order('sort_order')

    if (error) return { data: null, error: error.message }
    return { data: (data || []).map(dbTaskToApp), error: null }
  } catch (err) {
    return { data: null, error: err.message }
  }
}

/* ═══════════════════════════════════════════════════════════════
   WELLBEING
   ═══════════════════════════════════════════════════════════════ */

/**
 * Upsert wellbeing for a given day.
 * @param {string} userId
 * @param {number} dayNumber
 * @param {object} wellbeing - App-shape wellbeing object
 * @returns {{ error: string|null }}
 */
export async function upsertWellbeing(userId, dayNumber, wellbeing) {
  try {
    const { error } = await supabase.from('day_wellbeing').upsert({
      user_id: userId,
      day_number: dayNumber,
      sleep_hours: wellbeing.sleepHours,
      water_litres: wellbeing.waterLitres,
      exercise: wellbeing.exercise,
      mood: wellbeing.mood,
    }, { onConflict: 'user_id,day_number' })
    return { error: error?.message || null }
  } catch (err) {
    return { error: err.message }
  }
}

/* ═══════════════════════════════════════════════════════════════
   MOCK TESTS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Insert a mock test with subject scores.
 * @param {string} userId
 * @param {object} mock - App-shape mock object (with subjectScores nested)
 * @returns {{ data: object|null, error: string|null }}
 */
export async function insertMock(userId, mock) {
  try {
    // Insert mock header
    const { data: mockRow, error: mockErr } = await supabase
      .from('mock_tests')
      .insert({
        user_id: userId,
        name: mock.name,
        date: mock.date,
        total_score: mock.totalScore,
        max_score: mock.maxScore,
      })
      .select()
      .single()

    if (mockErr) return { data: null, error: mockErr.message }

    // Insert subject scores
    const scoreEntries = Object.entries(mock.subjectScores || {})
    if (scoreEntries.length > 0) {
      const scoreRows = scoreEntries.map(([subject, scores]) => ({
        mock_id: mockRow.id,
        user_id: userId,
        subject,
        correct: scores.correct || 0,
        wrong: scores.wrong || 0,
        skipped: scores.skipped || 0,
      }))

      const { error: scErr } = await supabase
        .from('mock_subject_scores')
        .insert(scoreRows)
      if (scErr) return { data: null, error: scErr.message }
    }

    return {
      data: {
        id: mockRow.id,
        name: mockRow.name,
        date: mockRow.date,
        totalScore: mockRow.total_score,
        maxScore: mockRow.max_score,
        subjectScores: mock.subjectScores || {},
      },
      error: null,
    }
  } catch (err) {
    return { data: null, error: err.message }
  }
}

/**
 * Delete a mock test (cascades to subject scores).
 * @param {string} userId
 * @param {string} mockId
 * @returns {{ error: string|null }}
 */
export async function deleteMock(userId, mockId) {
  try {
    const { error } = await supabase
      .from('mock_tests')
      .delete()
      .eq('id', mockId)
      .eq('user_id', userId)
    return { error: error?.message || null }
  } catch (err) {
    return { error: err.message }
  }
}

/* ═══════════════════════════════════════════════════════════════
   CURRENT AFFAIRS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Insert a current affairs entry.
 * @param {string} userId
 * @param {object} entry - App-shape CA object (without id)
 * @returns {{ data: object|null, error: string|null }}
 */
export async function insertCA(userId, entry) {
  try {
    const { data, error } = await supabase
      .from('current_affairs')
      .insert({
        user_id: userId,
        date: entry.date || '',
        topic: entry.topic || '',
        category: entry.category || 'Polity',
        source: entry.source || '',
        notes: entry.notes || '',
        revised: entry.revised ?? false,
      })
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    return { data: dbCAToApp(data), error: null }
  } catch (err) {
    return { data: null, error: err.message }
  }
}

/**
 * Update a current affairs entry.
 * @param {string} userId
 * @param {string} caId
 * @param {object} updates - Partial app-shape fields to update
 * @returns {{ error: string|null }}
 */
export async function updateCA(userId, caId, updates) {
  try {
    // Map camelCase keys to snake_case
    const mapped = {}
    if ('date' in updates) mapped.date = updates.date
    if ('topic' in updates) mapped.topic = updates.topic
    if ('category' in updates) mapped.category = updates.category
    if ('source' in updates) mapped.source = updates.source
    if ('notes' in updates) mapped.notes = updates.notes
    if ('revised' in updates) mapped.revised = updates.revised

    const { error } = await supabase
      .from('current_affairs')
      .update(mapped)
      .eq('id', caId)
      .eq('user_id', userId)
    return { error: error?.message || null }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Delete a current affairs entry.
 * @param {string} userId
 * @param {string} caId
 * @returns {{ error: string|null }}
 */
export async function deleteCA(userId, caId) {
  try {
    const { error } = await supabase
      .from('current_affairs')
      .delete()
      .eq('id', caId)
      .eq('user_id', userId)
    return { error: error?.message || null }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Batch-update multiple current affairs entries.
 * @param {string} userId
 * @param {string[]} ids - Array of CA entry IDs
 * @param {object} updates - Fields to update (e.g., { revised: true })
 * @returns {{ error: string|null }}
 */
export async function batchUpdateCA(userId, ids, updates) {
  try {
    const mapped = {}
    if ('revised' in updates) mapped.revised = updates.revised

    const { error } = await supabase
      .from('current_affairs')
      .update(mapped)
      .in('id', ids)
      .eq('user_id', userId)
    return { error: error?.message || null }
  } catch (err) {
    return { error: err.message }
  }
}

/* ═══════════════════════════════════════════════════════════════
   BULK OPERATIONS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Delete ALL data for a user across all tables.
 * @param {string} userId
 * @returns {{ error: string|null }}
 */
export async function deleteAllUserData(userId) {
  try {
    // Delete in order (children first due to FK, or rely on CASCADE)
    // mock_subject_scores cascade from mock_tests, so just delete parents
    const results = await Promise.all([
      supabase.from('day_tasks').delete().eq('user_id', userId),
      supabase.from('day_wellbeing').delete().eq('user_id', userId),
      supabase.from('mock_tests').delete().eq('user_id', userId), // cascades mock_subject_scores
      supabase.from('current_affairs').delete().eq('user_id', userId),
      supabase.from('user_settings').delete().eq('user_id', userId),
    ])

    for (const res of results) {
      if (res.error) return { error: res.error.message }
    }
    return { error: null }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Full data import: delete everything then re-insert from app-shape data.
 * @param {string} userId
 * @param {object} data - Full app state { settings, days, mocks, currentAffairs }
 * @returns {{ error: string|null }}
 */
export async function bulkImportData(userId, data) {
  try {
    // 1. Delete all existing data
    const delResult = await deleteAllUserData(userId)
    if (delResult.error) return { error: delResult.error }

    // 2. Insert settings
    if (data.settings) {
      const settingsResult = await upsertSettings(userId, data.settings)
      if (settingsResult.error) return { error: settingsResult.error }
    }

    // 3. Insert day tasks and wellbeing for all 30 days
    const dayPromises = []
    for (let d = 1; d <= 30; d++) {
      const dayData = data.days?.[d]
      if (!dayData) continue

      if (dayData.tasks && dayData.tasks.length > 0) {
        dayPromises.push(upsertDayTasks(userId, d, dayData.tasks))
      }
      if (dayData.wellbeing) {
        dayPromises.push(upsertWellbeing(userId, d, dayData.wellbeing))
      }
    }
    const dayResults = await Promise.all(dayPromises)
    for (const res of dayResults) {
      if (res.error) return { error: res.error }
    }

    // 4. Insert mocks
    for (const mock of (data.mocks || [])) {
      const mockResult = await insertMock(userId, mock)
      if (mockResult.error) return { error: mockResult.error }
    }

    // 5. Insert current affairs
    if (data.currentAffairs && data.currentAffairs.length > 0) {
      const caRows = data.currentAffairs.map(e => ({
        user_id: userId,
        date: e.date || '',
        topic: e.topic || '',
        category: e.category || 'Polity',
        source: e.source || '',
        notes: e.notes || '',
        revised: e.revised ?? false,
      }))
      const { error } = await supabase.from('current_affairs').insert(caRows)
      if (error) return { error: error.message }
    }

    return { error: null }
  } catch (err) {
    return { error: err.message }
  }
}

/* ═══════════════════════════════════════════════════════════════
   COMMUNITY FEATURES
   ═══════════════════════════════════════════════════════════════ */

/**
 * Fetch a user's community profile.
 * @param {string} userId
 * @returns {{ data: object|null, error: string|null }}
 */
export async function fetchProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) return { data: null, error: error.message }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err.message }
  }
}

/**
 * Create a user's community profile.
 * @param {string} userId
 * @param {object} profile - Profile fields
 * @returns {{ data: object|null, error: string|null }}
 */
export async function createProfile(userId, profile) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        display_name: profile.displayName || 'UPSC Aspirant',
        avatar_url: profile.avatarUrl || null,
        is_public: profile.isPublic ?? false,
      })
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err.message }
  }
}

/**
 * Update a user's community profile (display name, avatar, or privacy toggle).
 * @param {string} userId
 * @param {object} updates - Fields to update
 * @returns {{ error: string|null }}
 */
export async function updateProfile(userId, updates) {
  try {
    const mapped = {}
    if ('displayName' in updates) mapped.display_name = updates.displayName
    if ('avatarUrl' in updates) mapped.avatar_url = updates.avatarUrl
    if ('isPublic' in updates) mapped.is_public = updates.isPublic

    const { error } = await supabase
      .from('profiles')
      .update(mapped)
      .eq('id', userId)

    return { error: error?.message || null }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Upsert a daily study summary.
 * @param {string} userId
 * @param {number} dayNumber
 * @param {string} date - YYYY-MM-DD
 * @param {number} totalHours
 * @param {string[]} subjects - Array of active subjects studied
 * @param {number} streak
 * @returns {{ error: string|null }}
 */
export async function upsertDailySummary(userId, dayNumber, date, totalHours, subjects, streak) {
  try {
    const { error } = await supabase
      .from('daily_summaries')
      .upsert({
        user_id: userId,
        day_number: dayNumber,
        date,
        total_hours: totalHours,
        subjects,
        streak,
      }, { onConflict: 'user_id,day_number' })

    return { error: error?.message || null }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Fetch the community feed from the secure masked database view public_daily_activities.
 * Joins user cheers (reactions) client-side.
 * @param {string} currentUserId - The active user's ID
 * @returns {{ data: array|null, error: string|null }}
 */
export async function fetchCommunityFeed(currentUserId) {
  try {
    // 1. Fetch recent activities from secure view
    const { data: activities, error: actErr } = await supabase
      .from('public_daily_activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (actErr) return { data: null, error: actErr.message }
    if (!activities || activities.length === 0) return { data: [], error: null }

    // 2. Fetch all cheers for these summaries
    const summaryIds = activities.map(a => a.id)
    const { data: cheers, error: cheerErr } = await supabase
      .from('cheers')
      .select('*')
      .in('summary_id', summaryIds)

    if (cheerErr) return { data: null, error: cheerErr.message }

    // 3. Group cheers by summary_id client-side
    const cheersMap = {}
    for (const c of (cheers || [])) {
      if (!cheersMap[c.summary_id]) cheersMap[c.summary_id] = []
      cheersMap[c.summary_id].push(c)
    }

    // 4. Enrich activities with reaction counts and user's own cheer states
    const enriched = activities.map(act => {
      const actCheers = cheersMap[act.id] || []
      
      // Count totals for each emoji (e.g. { '👏': 3, '🔥': 1 })
      const counts = {}
      // Track if the current user reacted (e.g. { '👏': true })
      const userReacted = {}

      for (const c of actCheers) {
        counts[c.emoji] = (counts[c.emoji] || 0) + 1
        if (c.user_id === currentUserId) {
          userReacted[c.emoji] = true
        }
      }

      return {
        ...act,
        cheers: counts,
        userReacted,
      }
    })

    return { data: enriched, error: null }
  } catch (err) {
    return { data: null, error: err.message }
  }
}

/**
 * Fetch leaderboard ranking of public users based on total hours studied.
 * @returns {{ data: array|null, error: string|null }}
 */
export async function fetchLeaderboard() {
  try {
    // Fetch all summaries from public view where the user has opted in
    const { data, error } = await supabase
      .from('public_daily_activities')
      .select('user_id, display_name, avatar_url, total_hours')
      .eq('is_public', true)

    if (error) return { data: null, error: error.message }
    if (!data || data.length === 0) return { data: [], error: null }

    // Group and aggregate hours per user in Javascript
    const userMap = {}
    for (const row of data) {
      if (!userMap[row.user_id]) {
        userMap[row.user_id] = {
          userId: row.user_id,
          displayName: row.display_name || 'UPSC Aspirant',
          avatarUrl: row.avatar_url,
          totalHours: 0,
        }
      }
      userMap[row.user_id].totalHours += row.total_hours || 0
    }

    // Convert map to array, round values, and sort descending
    const leaderboard = Object.values(userMap)
      .map(u => ({ ...u, totalHours: +u.totalHours.toFixed(1) }))
      .sort((a, b) => b.totalHours - a.totalHours)

    return { data: leaderboard, error: null }
  } catch (err) {
    return { data: null, error: err.message }
  }
}

/**
 * Toggle an emoji reaction (cheer) on a summary.
 * @param {string} userId
 * @param {string} summaryId
 * @param {string} emoji
 * @returns {{ error: string|null }}
 */
export async function toggleCheer(userId, summaryId, emoji) {
  try {
    // Check if cheer already exists
    const { data: existing, error: checkErr } = await supabase
      .from('cheers')
      .select('id')
      .eq('summary_id', summaryId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .maybeSingle()

    if (checkErr) return { error: checkErr.message }

    if (existing) {
      // Delete existing cheer (unlike)
      const { error: delErr } = await supabase
        .from('cheers')
        .delete()
        .eq('id', existing.id)
      return { error: delErr?.message || null }
    } else {
      // Insert new cheer (like)
      const { error: insErr } = await supabase
        .from('cheers')
        .insert({
          summary_id: summaryId,
          user_id: userId,
          emoji,
        })
      return { error: insErr?.message || null }
    }
  } catch (err) {
    return { error: err.message }
  }
}

/* ═══════════════════════════════════════════════════════════════
   INVITE CODE / ONBOARDING
   ═══════════════════════════════════════════════════════════════ */

/**
 * Join an institute by invite code.
 * Calls the `join_institute` Postgres RPC which validates the code,
 * associates the current user with the institute, and returns its name.
 * @param {string} code - The invite code to redeem
 * @returns {{ instituteName: string|null, error: string|null }}
 */
export async function joinInstitute(code) {
  try {
    const { data, error } = await supabase.rpc('join_institute', {
      code: code,
    })

    if (error) return { instituteName: null, error: error.message }
    return { instituteName: data, error: null }
  } catch (err) {
    return { instituteName: null, error: err.message }
  }
}

/* ═══════════════════════════════════════════════════════════════
   INSTITUTE MANAGEMENT (Super Admin)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Fetch all institutes, ordered by most recently created.
 * @returns {{ data: array|null, error: string|null }}
 */
export async function fetchInstitutes() {
  try {
    const { data, error } = await supabase
      .from('institutes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return { data: null, error: error.message }
    return { data: data || [], error: null }
  } catch (err) {
    return { data: null, error: err.message }
  }
}

/**
 * Create a new institute.
 * @param {string} name - Institute name
 * @param {string|null} customCode - Optional custom invite code
 * @returns {{ data: object|null, error: string|null }}
 */
export async function createInstitute(name, customCode = null) {
  try {
    const payload = { name }
    if (customCode && customCode.trim()) {
      payload.invite_code = customCode.trim()
    }

    const { data, error } = await supabase
      .from('institutes')
      .insert(payload)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err.message }
  }
}

/**
 * Regenerate the invite code for an institute.
 * Calls the `admin_regenerate_invite_code` Postgres RPC.
 * @param {string} instituteId - UUID of the institute
 * @returns {{ code: string|null, error: string|null }}
 */
export async function regenerateInviteCode(instituteId) {
  try {
    const { data, error } = await supabase.rpc('admin_regenerate_invite_code', {
      target_institute_id: instituteId,
    })

    if (error) return { code: null, error: error.message }
    return { code: data, error: null }
  } catch (err) {
    return { code: null, error: err.message }
  }
}

/**
 * Set a custom invite code for an institute (super admin only).
 * Calls the `admin_update_invite_code` Postgres RPC.
 * @param {string} instituteId - UUID of the institute
 * @param {string} newCode - Custom invite code
 * @returns {{ error: string|null }}
 */
export async function adminUpdateInviteCode(instituteId, newCode) {
  try {
    const { error } = await supabase.rpc('admin_update_invite_code', {
      target_institute_id: instituteId,
      new_code: newCode,
    })

    return { error: error?.message || null }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Delete an institute (super admin only).
 * RLS allows deletion for super admins.
 * @param {string} instituteId - UUID of the institute to delete
 * @returns {{ error: string|null }}
 */
export async function deleteInstitute(instituteId) {
  try {
    const { error } = await supabase
      .from('institutes')
      .delete()
      .eq('id', instituteId)

    return { error: error?.message || null }
  } catch (err) {
    return { error: err.message }
  }
}

/* ═══════════════════════════════════════════════════════════════
   USER MANAGEMENT (Super Admin)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Fetch all user profiles with institute names, ordered by most recently created.
 * Joins profiles with institutes to include the institute name.
 * @returns {{ data: array|null, error: string|null }}
 */
export async function fetchAllProfiles() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, institutes(name)')
      .order('created_at', { ascending: false })

    if (error) return { data: null, error: error.message }

    // Flatten the nested institutes join into a top-level institute_name field
    const enriched = (data || []).map(row => ({
      ...row,
      institute_name: row.institutes?.name || null,
    }))

    return { data: enriched, error: null }
  } catch (err) {
    return { data: null, error: err.message }
  }
}

/**
 * Assign a user to an institute (super admin only).
 * Calls the `admin_assign_institute` Postgres RPC.
 * @param {string} targetUserId - UUID of the user to assign
 * @param {string} instituteId - UUID of the institute
 * @returns {{ error: string|null }}
 */
export async function adminAssignInstitute(targetUserId, instituteId) {
  try {
    const { error } = await supabase.rpc('admin_assign_institute', {
      target_user_id: targetUserId,
      target_institute_id: instituteId,
    })

    return { error: error?.message || null }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Set a user's role (super admin only).
 * Calls the `admin_set_role` Postgres RPC.
 * @param {string} targetUserId - UUID of the user
 * @param {'student'|'instructor'|'super_admin'} newRole - New role to assign
 * @returns {{ error: string|null }}
 */
export async function adminSetRole(targetUserId, newRole) {
  try {
    const { error } = await supabase.rpc('admin_set_role', {
      target_user_id: targetUserId,
      new_role: newRole,
    })

    return { error: error?.message || null }
  } catch (err) {
    return { error: err.message }
  }
}

/* ═══════════════════════════════════════════════════════════════
   INSTRUCTOR DASHBOARD
   ═══════════════════════════════════════════════════════════════ */

/**
 * Fetch all students in the instructor's institute.
 * RLS auto-filters to the same institute.
 * @returns {{ data: array|null, error: string|null }}
 */
export async function fetchInstituteStudents() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('created_at', { ascending: false })

    if (error) return { data: null, error: error.message }
    return { data: data || [], error: null }
  } catch (err) {
    return { data: null, error: err.message }
  }
}

/**
 * Fetch an overview of all students in the instructor's institute.
 * Computes per-student metrics: totalHours, currentStreak, lastActive.
 * RLS auto-filters profiles and daily_summaries to same institute.
 * @returns {{ data: array|null, error: string|null }}
 */
export async function fetchStudentOverview() {
  try {
    // 1. Fetch all student profiles in the institute (RLS filters)
    const { data: students, error: studErr } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .eq('role', 'student')

    if (studErr) return { data: null, error: studErr.message }
    if (!students || students.length === 0) return { data: [], error: null }

    // 2. Fetch all daily_summaries for these students
    const studentIds = students.map(s => s.id)
    const { data: summaries, error: sumErr } = await supabase
      .from('daily_summaries')
      .select('user_id, date, total_hours, streak')
      .in('user_id', studentIds)
      .order('date', { ascending: false })

    if (sumErr) return { data: null, error: sumErr.message }

    // 3. Group summaries by user_id
    const summariesByUser = {}
    for (const s of (summaries || [])) {
      if (!summariesByUser[s.user_id]) summariesByUser[s.user_id] = []
      summariesByUser[s.user_id].push(s)
    }

    // 4. Compute per-student metrics
    const today = new Date().toISOString().slice(0, 10)
    const overview = students.map(student => {
      const userSummaries = summariesByUser[student.id] || []

      // Total hours across all days
      const totalHours = +(userSummaries.reduce((sum, s) => sum + (s.total_hours || 0), 0)).toFixed(1)

      // Current streak: the highest streak value from the most recent summary
      const currentStreak = userSummaries.length > 0 ? (userSummaries[0].streak || 0) : 0

      // Last active: date of the most recent summary
      const lastActive = userSummaries.length > 0 ? userSummaries[0].date : null

      return {
        userId: student.id,
        displayName: student.display_name || 'UPSC Aspirant',
        avatarUrl: student.avatar_url || null,
        totalHours,
        currentStreak,
        lastActive,
      }
    })

    return { data: overview, error: null }
  } catch (err) {
    return { data: null, error: err.message }
  }
}

/**
 * Fetch full study data for a specific student (instructor view).
 * Reuses the same query logic as fetchAllUserData but for a different userId.
 * RLS allows instructors to read data of students in the same institute.
 * @param {string} studentUserId - UUID of the student to view
 * @returns {{ settings: object|null, days: object, mocks: array, currentAffairs: array, error: string|null }}
 */
export async function fetchStudentDetail(studentUserId) {
  try {
    const [settingsRes, tasksRes, wellbeingRes, mocksRes, scoresRes, caRes] = await Promise.all([
      supabase.from('user_settings').select('*').eq('user_id', studentUserId).maybeSingle(),
      supabase.from('day_tasks').select('*').eq('user_id', studentUserId).order('day_number').order('sort_order'),
      supabase.from('day_wellbeing').select('*').eq('user_id', studentUserId).order('day_number'),
      supabase.from('mock_tests').select('*').eq('user_id', studentUserId).order('created_at'),
      supabase.from('mock_subject_scores').select('*').eq('user_id', studentUserId),
      supabase.from('current_affairs').select('*').eq('user_id', studentUserId).order('created_at', { ascending: false }),
    ])

    // Check for errors
    for (const res of [settingsRes, tasksRes, wellbeingRes, mocksRes, scoresRes, caRes]) {
      if (res.error) return { settings: null, days: {}, mocks: [], currentAffairs: [], error: res.error.message }
    }

    // ── Transform settings ──
    const settings = settingsRes.data ? dbSettingsToApp(settingsRes.data) : null

    // ── Transform days (tasks + wellbeing) ──
    const days = {}

    // Group tasks by day_number
    const tasksByDay = {}
    for (const row of (tasksRes.data || [])) {
      if (!tasksByDay[row.day_number]) tasksByDay[row.day_number] = []
      tasksByDay[row.day_number].push(dbTaskToApp(row))
    }

    // Index wellbeing by day_number
    const wellbeingByDay = {}
    for (const row of (wellbeingRes.data || [])) {
      wellbeingByDay[row.day_number] = dbWellbeingToApp(row)
    }

    // Build days 1-30
    for (let d = 1; d <= 30; d++) {
      days[d] = {
        tasks: tasksByDay[d] || [],
        wellbeing: wellbeingByDay[d] || { ...DEFAULT_WELLBEING },
      }
    }

    // ── Transform mocks (re-nest subject scores) ──
    const scoresByMock = {}
    for (const row of (scoresRes.data || [])) {
      if (!scoresByMock[row.mock_id]) scoresByMock[row.mock_id] = {}
      scoresByMock[row.mock_id][row.subject] = {
        correct: row.correct || 0,
        wrong: row.wrong || 0,
        skipped: row.skipped || 0,
      }
    }

    const mocks = (mocksRes.data || []).map(m => ({
      id: m.id,
      name: m.name || '',
      date: m.date || '',
      totalScore: m.total_score || 0,
      maxScore: m.max_score || 200,
      subjectScores: scoresByMock[m.id] || {},
    }))

    // ── Transform current affairs ──
    const currentAffairs = (caRes.data || []).map(dbCAToApp)

    return { settings, days, mocks, currentAffairs, error: null }
  } catch (err) {
    return { settings: null, days: {}, mocks: [], currentAffairs: [], error: err.message }
  }
}

/**
 * Fetch aggregate cohort statistics for the instructor's institute.
 * Computes: averageHoursPerDay, averageMockScore, totalStudents, studentsActiveToday.
 * RLS auto-filters to the same institute.
 * @returns {{ data: object|null, error: string|null }}
 */
export async function fetchCohortStats() {
  try {
    const today = new Date().toISOString().slice(0, 10)

    // 1. Fetch all student profiles in the institute
    const { data: students, error: studErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'student')

    if (studErr) return { data: null, error: studErr.message }

    const totalStudents = (students || []).length
    if (totalStudents === 0) {
      return {
        data: { averageHoursPerDay: 0, averageMockScore: 0, totalStudents: 0, studentsActiveToday: 0 },
        error: null,
      }
    }

    const studentIds = students.map(s => s.id)

    // 2. Fetch daily summaries and mock tests in parallel
    const [summariesRes, mocksRes] = await Promise.all([
      supabase
        .from('daily_summaries')
        .select('user_id, date, total_hours')
        .in('user_id', studentIds),
      supabase
        .from('mock_tests')
        .select('user_id, total_score, max_score')
        .in('user_id', studentIds),
    ])

    if (summariesRes.error) return { data: null, error: summariesRes.error.message }
    if (mocksRes.error) return { data: null, error: mocksRes.error.message }

    const allSummaries = summariesRes.data || []
    const allMocks = mocksRes.data || []

    // 3. Compute averageHoursPerDay
    //    Sum all hours across all students and all days, divided by distinct (user, date) pairs
    const totalHours = allSummaries.reduce((sum, s) => sum + (s.total_hours || 0), 0)
    const totalDayEntries = allSummaries.length
    const averageHoursPerDay = totalDayEntries > 0
      ? +(totalHours / totalDayEntries).toFixed(1)
      : 0

    // 4. Compute averageMockScore (as percentage)
    let totalScorePercentage = 0
    for (const m of allMocks) {
      const maxScore = m.max_score || 200
      totalScorePercentage += ((m.total_score || 0) / maxScore) * 100
    }
    const averageMockScore = allMocks.length > 0
      ? +(totalScorePercentage / allMocks.length).toFixed(1)
      : 0

    // 5. Count students active today
    const activeToday = new Set()
    for (const s of allSummaries) {
      if (s.date === today) activeToday.add(s.user_id)
    }
    const studentsActiveToday = activeToday.size

    return {
      data: {
        averageHoursPerDay,
        averageMockScore,
        totalStudents,
        studentsActiveToday,
      },
      error: null,
    }
  } catch (err) {
    return { data: null, error: err.message }
  }
}

