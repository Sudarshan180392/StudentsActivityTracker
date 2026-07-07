# 🎯 UPSC/SPSC PrepSheet — Multi-Tenant Institute Prep Tracker

A premium, full-featured multi-tenant study management platform (SaaS) built with React 19, Tailwind CSS v4, and Supabase. Designed for civil service coaching institutes to monitor their cohorts in real-time, and for aspirants to supercharge their 30-Day study sprints.

---

## 🌟 Architecture & Role Model
The app operates on a 3-tier tenant authorization structure enforced natively via PostgreSQL Row-Level Security (RLS):

1. **Super Admin (Institute Owner)**
   - View, create, and delete coaching institutes.
   - Manage all user accounts, assign users to institutes, and promote roles.
   - Configure custom invite codes (e.g. `DELHI100`, `VAJIRAM50`) or let the system auto-generate them.
2. **Instructor (Mentor / Coach)**
   - Access a read-only cohort dashboard showing all students enrolled in their coaching institute.
   - View roster statistics: total study hours, current streaks, and last active status.
   - Drill down into individual student profiles to inspect day-by-day logs, mock test percentiles, and current affairs revision history.
3. **Student (Aspirant)**
   - Manage a personal 30-day syllabus planner, timers, mock exams, current affairs revision cards, and daily wellbeing metrics.
   - Join an institute using an invite code or study independently.
   - *Can only read and write their own data.*

---

## ✨ Features

### 🏫 Instructor Cohort Dashboard
* **Cohort Overview KPIs**: Average daily study hours, average mock test scores, cohort size, and active ratio.
* **Daily study trend & hour distributions** charts powered by Recharts.
* **Student Drill-Down**: Click on any student row in the roster to view:
  - **Day-by-Day Sheet**: Exact topic studied, target vs. actual hours, and wellbeing logs.
  - **Mock History**: Mock exam scores, dates, and estimated normal-distribution percentiles.
  - **Current Affairs Log**: Read-only ledger of their categorized news logs.

### 📊 Super Admin Operations Panel
* **Institute CRUD**: Register new coaching centers and generate unique, copyable invite codes.
* **Custom Code Management**: Instantly assign custom strings (e.g. `MYCOACHING`) to any institute or regenerate random hex keys.
* **User Promotion**: View user accounts and change their roles or associated institutes in real-time.

### 📅 Student Workspace
* **30-Day Sprint**: Schedule subject-wise study targets.
* **Timers & Notes**: Record exact actual study hours per subject with micro-notes.
* **Wellbeing Profile**: Track sleep, hydration, exercise, and daily mood.
* **Mock Analyzer**: Chart score trends, view correct/incorrect counts, and get percentile estimations.
* **Current Affairs Log**: Save categorized clippings (Polity, Economy, Science, etc.) with a toggleable "Revised" checklist.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React 19 + Vite |
| **Styling** | Tailwind CSS v4 (Glassmorphic dark-mode design system) |
| **Backend / Database** | Supabase (PostgreSQL) |
| **Security** | Row Level Security (RLS) + Security Definer RPCs (no service-role key on client) |
| **Charts** | Recharts |
| **PDF Generation** | jsPDF + jsPDF-autotable |

---

## 🚀 Setup & Installation

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 3. Database Migration Setup
In your Supabase project's **SQL Editor**, run the SQL scripts in this exact order:
1. **[supabase_migration.sql](supabase_migration.sql)** — Sets up base tables and schemas.
2. **[supabase_community_migration.sql](supabase_community_migration.sql)** — Sets up profiles and daily summaries.
3. **[supabase_multi_tenant_migration.sql](supabase_multi_tenant_migration.sql)** — Upgrades schema to multi-tenant RLS, adds roles, helper functions, and secure RPCs.

### 4. Promote Yourself to Super Admin
Run this query in your Supabase SQL Editor to elevate your user account (replace with your account UUID from **Authentication ➜ Users**):
```sql
UPDATE public.profiles 
SET role = 'super_admin' 
WHERE id = 'YOUR_USER_UUID';
```

### 5. Start Development Server
```bash
npm run dev
```

---

## 🧪 Verification & Testing
To verify RLS tenant isolation before testing with real users:
1. Run **[supabase_test_isolation.sql](supabase_test_isolation.sql)** in your Supabase SQL Editor.
2. Follow the test instructions inside the file to simulate JWT user sessions.
3. Check the query results to confirm that instructors cannot access other institutes' student data, and students can only view their own.
4. Clean up mock testing data by running the cleanup script at the bottom of the file.

---
> Best of luck with your preparation. 🇮🇳
