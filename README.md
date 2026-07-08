# Smart Student Analytics

A full-stack academic performance dashboard that helps students track their own progress and helps teachers identify at-risk students **early — before the failing grade lands**.

Built with React 19, TypeScript, Tailwind CSS, Supabase (Postgres + Auth + Row Level Security), and Recharts.

> **Why this project?** Spreadsheets tell you a student is at 63%. They don't tell you whether that student is *stuck* at 63% or *sliding* from 80% to 63%. This app uses per-assignment linear regression to rank at-risk students by how fast they're declining, so teachers know who to talk to *this week*.

---

## Live Demo

- **URL:** _[deployment coming Day 7]_
- **Demo accounts:**
  - Student: `student1@example.com` / `password123`
  - Teacher: `teacher1@example.com` / `password123`

---

## Features

### Student view
- Personalized dashboard with weighted grade averages across all enrolled courses
- Chronological grade trajectory chart with a "passing" reference line
- Course cards showing letter grade, weighted average, attendance rate, and grading progress
- Overall stats: GPA, attendance %, courses at risk

### Teacher view
- Per-course cohort insights (class average, avg attendance, at-risk count)
- **At-risk student list** — ranked by decline severity, not just current grade
- Grade distribution histogram
- Full sortable roster with search, per-student trend slopes, and letter grades

### Security
- Row Level Security on every table — students literally can't see other students' data at the database level
- All cross-table policies use `security definer` helper functions to avoid RLS recursion
- Auth via Supabase (JWT), session persistence, role-based routing

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | Fast HMR, typed end-to-end |
| Styling | Tailwind CSS v4 (Vite plugin) | Utility-first, no config bloat |
| Routing | react-router-dom v6 | Role-based route guards |
| Charts | Recharts | React-native SVG charts |
| Backend | Supabase (Postgres, Auth, RLS) | One managed service replaces auth + DB + API |
| Types | `supabase gen types` | DB is the source of truth for all TS types |
| Seed data | `@faker-js/faker` + custom TS script | 200 students, 6k+ submissions, realistic distributions |

---

## Architecture

```
┌─────────────────────────────────────────┐
│      React Frontend (Vite)              │
│  ┌──────────────┐  ┌─────────────────┐ │
│  │  AuthContext │  │  Data Hooks     │ │
│  │  (session)   │  │  (React Query- │ │
│  │              │  │   style state)  │ │
│  └──────┬───────┘  └────────┬────────┘ │
│         │                    │          │
│         └────────┬───────────┘          │
│                  │                       │
│         ┌────────▼─────────┐            │
│         │ supabase-js      │            │
│         │ (anon key only)  │            │
│         └────────┬─────────┘            │
└──────────────────┼──────────────────────┘
                   │ HTTPS + JWT
                   ▼
┌─────────────────────────────────────────┐
│         Supabase (Tokyo region)          │
│  ┌────────────┐  ┌──────────────────┐  │
│  │ PostgREST  │  │ Auth (GoTrue)    │  │
│  └─────┬──────┘  └────────┬─────────┘  │
│        │                   │            │
│        ▼                   ▼            │
│  ┌──────────────────────────────────┐  │
│  │  Postgres 15                      │  │
│  │  - 7 tables                       │  │
│  │  - RLS on every table             │  │
│  │  - security-definer helpers       │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Deliberate architectural choices:**

- **No separate Node backend.** Supabase's PostgREST auto-generates a REST API from the schema; RLS enforces authorization. Adding an Express layer would just proxy without adding value at this scale.
- **RLS over API-layer checks.** Authorization lives in Postgres policies, not React or a middleware. If someone bypasses the UI, the database still refuses.
- **`security definer` for cross-table policies.** Naive RLS policies that JOIN other RLS-protected tables cause infinite recursion. Wrapping those checks in `security definer` functions breaks the loop safely without weakening security.
- **Types generated from schema.** `supabase gen types typescript` produces `database.ts`. Change a table, regenerate, TypeScript flags every affected file.

---

## Database Schema

7 tables in `public`. All have RLS enabled.

### `profiles`
Extends `auth.users`. Every authenticated user has a matching row.

| column | type | notes |
|---|---|---|
| `id` | uuid PK | FK → `auth.users.id` |
| `role` | text | `'student' \| 'teacher' \| 'admin'` |
| `full_name` | text | |
| `email` | text UNIQUE | |
| `created_at` | timestamptz | default now() |

### `courses`
| column | type | notes |
|---|---|---|
| `id` | uuid PK | default gen_random_uuid() |
| `code` | text UNIQUE | e.g. `CS101` |
| `name` | text | e.g. `Introduction to Programming` |
| `term` | text | e.g. `2026-S1` |
| `teacher_id` | uuid | FK → `profiles.id` |

### `enrollments`
Join table: which student is in which course.

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `student_id` | uuid | FK → `profiles.id` |
| `course_id` | uuid | FK → `courses.id` |
| `enrolled_at` | timestamptz | |
| UNIQUE | (student_id, course_id) | |

### `assignments`
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `course_id` | uuid | FK → `courses.id` |
| `title` | text | |
| `type` | text | `'quiz' \| 'homework' \| 'midterm' \| 'final' \| 'project'` |
| `weight` | numeric | 0–100, sums to 100 per course |
| `max_score` | numeric | default 100 |
| `due_at` | timestamptz | |

### `submissions`
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `assignment_id` | uuid | FK → `assignments.id` |
| `student_id` | uuid | FK → `profiles.id` |
| `score` | numeric | raw score, 0–max_score |
| `submitted_at` | timestamptz | |
| `graded_at` | timestamptz | |
| UNIQUE | (assignment_id, student_id) | |

### `attendance`
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `enrollment_id` | uuid | FK → `enrollments.id` |
| `date` | date | |
| `status` | text | `'present' \| 'absent' \| 'late' \| 'excused'` |
| UNIQUE | (enrollment_id, date) | |

### `predictions` _(populated by Day 5 Edge Function)_
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `student_id` | uuid | FK → `profiles.id` |
| `course_id` | uuid | FK → `courses.id` |
| `predicted_grade` | numeric | 0–100 |
| `risk_label` | text | `'low' \| 'medium' \| 'high'` |
| `confidence` | numeric | 0–1 |
| `model_version` | text | |
| `generated_at` | timestamptz | |

### Indexes
```sql
create index idx_submissions_student on submissions(student_id);
create index idx_submissions_assignment on submissions(assignment_id);
create index idx_enrollments_student on enrollments(student_id);
create index idx_enrollments_course on enrollments(course_id);
create index idx_attendance_enrollment on attendance(enrollment_id);
create index idx_predictions_student on predictions(student_id);
create index idx_courses_teacher on courses(teacher_id);
```

---

## Row Level Security

**Every table has RLS enabled.** Policies fall into two shapes:

### Direct checks (no recursion risk)
```sql
create policy "profiles_self_read" on profiles
  for select using (auth.uid() = id);

create policy "submissions_student_read_own" on submissions
  for select using (auth.uid() = student_id);
```

### Cross-table checks via `security definer` functions
Naive cross-table policies cause recursion (`courses` policy queries `enrollments`, whose policy queries `courses`…). Wrapping the check in a `security definer` function bypasses further RLS for the lookup itself, while the outer policy still enforces authorization.

```sql
create or replace function public.current_user_is_enrolled(course_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from enrollments
    where course_id = course_uuid and student_id = auth.uid()
  );
$$;

create policy "courses_enrolled_student_read" on courses
  for select using (public.current_user_is_enrolled(courses.id));
```

Same pattern powers:
- `current_user_owns_enrollment(uuid)` → student reading own attendance
- `current_user_teaches_enrollment(uuid)` → teacher reading course attendance
- `is_teacher_of_student(uuid)` → teacher reading a student's profile

### Full policy matrix

| Table | Student can read | Teacher can read |
|---|---|---|
| profiles | own row | own row + rows of students in courses they teach |
| courses | courses they're enrolled in | courses they teach |
| enrollments | own enrollments | enrollments in courses they teach |
| assignments | assignments in courses they're enrolled in | assignments in courses they teach |
| submissions | own submissions | submissions on assignments in courses they teach |
| attendance | own attendance | attendance for enrollments in courses they teach |
| predictions | own predictions | predictions in courses they teach |

Write policies are not yet defined — reads are all this app needs. Adding write policies would follow the same pattern.

---

## Data Flow

### Sign-in
1. User submits email + password on `/login`
2. `supabase.auth.signInWithPassword()` returns a JWT session
3. `AuthContext` fetches the matching `profiles` row (RLS: `profiles_self_read`)
4. `RoleRouter` reads `profile.role` and renders `<StudentDashboard>` or `<TeacherDashboard>`

### Student dashboard (`useStudentData`)
```
1. SELECT enrollments (with courses join)  →  RLS: own enrollments only
2. SELECT assignments IN (courseIds)       →  RLS: assignments in enrolled courses
3. SELECT submissions WHERE student_id     →  RLS: own submissions only
4. SELECT attendance IN (enrollmentIds)    →  RLS: own attendance only
5. Client-side compute:
   - Weighted average per course
   - Letter grade per course
   - Attendance rate per course
   - Trajectory points (all submissions sorted by due_at)
   - Overall summary (GPA, avg attendance, at-risk count)
```

### Teacher dashboard (`useTeacherCourses` + `useCourseInsights`)
```
1. SELECT courses WHERE teacher_id = auth.uid()
2. On course select:
   a. SELECT enrollments (with profiles join) FOR course
   b. SELECT assignments FOR course
   c. SELECT submissions FOR those students × assignments
   d. SELECT attendance FOR those enrollments  ← paginated (1000/page)
3. Client-side compute per student:
   - Weighted average
   - Letter grade
   - Attendance rate
   - Trend slope (linear regression on scores over time)
4. Compute cohort aggregates:
   - Grade distribution histogram (F/D/C/B/A buckets)
   - Class average, avg attendance, at-risk count
```

**Why pagination on attendance?** PostgREST caps queries at 1,000 rows by default. One course × 120 students × 60 days = 7,200 attendance rows. Batched at 1,000/page.

### The trend slope (why this project stands out)
For each student's chronologically-ordered scores in a course:
```
slope = Σ(xᵢ - x̄)(yᵢ - ȳ) / Σ(xᵢ - x̄)²
```
Positive slope = improving; negative = declining. A student at 63% with slope `-3.0` is in worse shape than a student at 55% with slope `+1.5`. The teacher's at-risk list ranks by this signal, not raw grade.

---

## Project Structure

```
smart-student-analytics/
├── scripts/
│   └── seed.ts                           # 200 students, 6k submissions, 60k attendance
├── src/
│   ├── components/
│   │   ├── AtRiskList.tsx                # ranks students by decline severity
│   │   ├── CourseCard.tsx                # per-course grade card (student view)
│   │   ├── DistributionChart.tsx         # F/D/C/B/A histogram (teacher view)
│   │   ├── StatCard.tsx                  # KPI card with tone variants
│   │   ├── StudentRoster.tsx             # sortable, searchable teacher table
│   │   └── TrajectoryChart.tsx           # student's grades over time
│   ├── hooks/
│   │   ├── useAuth.tsx                   # session + profile context
│   │   ├── useStudentData.ts             # student-facing queries + compute
│   │   └── useTeacherData.ts             # teacher-facing queries + compute
│   ├── lib/
│   │   └── supabase.ts                   # typed client, singleton
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── StudentDashboard.tsx
│   │   └── TeacherDashboard.tsx
│   ├── types/
│   │   └── database.ts                   # generated from Supabase schema
│   ├── App.tsx                           # AuthProvider + BrowserRouter + RoleRouter
│   └── main.tsx
├── supabase/
│   └── migrations/
│       ├── 0001_init_schema.sql          # 7 tables + indexes
│       ├── 0002_rls_policies.sql         # initial RLS
│       ├── 0003_more_rls_policies.sql    # enrollments, assignments, attendance
│       ├── 0004_fix_rls_recursion.sql    # security-definer helpers
│       └── 0005_fix_teacher_attendance.sql
├── .env.local                            # gitignored
├── package.json
└── vite.config.ts
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- A Supabase project (free tier is fine)

### Setup

```bash
git clone https://github.com/aarav-shrma/smart-student-analytics.git
cd smart-student-analytics
npm install
```

Create `.env.local` in the project root:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # server-only, never in client code
```

Apply the schema and RLS policies via Supabase SQL Editor, running the files in `supabase/migrations/` in order (`0001` → `0005`).

Regenerate types:

```bash
npx supabase gen types typescript --project-id YOUR_REF > src/types/database.ts
```

Seed with realistic data (200 students, 6k submissions, 60k attendance rows, ~15% intentionally "struggling" for the model to detect):

```bash
npm run seed
```

Run:

```bash
npm run dev
```

Open http://localhost:5173. Log in with `student1@example.com` / `password123` or `teacher1@example.com` / `password123`.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server on port 5173 |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview production build locally |
| `npm run seed` | Wipe + reseed the database (idempotent) |
| `npm run lint` | Run ESLint |

---

## Design Decisions Q&A

**Why Supabase over MySQL + Express?**
The rubric was "demonstrate database depth." Supabase gives real Postgres — I still write SQL migrations by hand, write RLS policies by hand, and think about indexes. What it removes is boilerplate (auth, REST layer, hosting) that wouldn't have taught me anything.

**Why RLS instead of authorization in the API layer?**
Two reasons. First, defense in depth — if the UI has a bug that lets a user request another student's data, RLS still refuses. Second, the policies are declarative and colocated with the schema; anyone reading the migrations sees exactly who can access what.

**Why compute grades on the client instead of in a Postgres view?**
Speed of iteration during a one-week build. In production I'd move the computation into a `postgres_function` or a materialized view refreshed nightly, and expose it through a lean REST endpoint. The current shape lets me refactor without changing the schema.

**Why not use a charting library like Chart.js?**
Recharts composes with React's mental model (declarative, prop-driven, hooks-friendly). Chart.js is imperative and needs refs. For a project that will be read and extended, Recharts is clearer.

**Why generate types from Supabase instead of writing them?**
The schema is the source of truth. Any table change would otherwise silently drift out of sync with a hand-written type file until runtime bit me. `supabase gen types` runs in ~2 seconds.

---

## Roadmap

- [x] Day 1 — Schema, RLS, seed script (200 students, 6k submissions, 60k attendance)
- [x] Day 2 — Supabase client, AuthContext, login page, role-based routing
- [x] Day 3 — Student dashboard with grades, attendance, trajectory chart
- [x] Day 4 — Teacher dashboard with at-risk list, cohort histogram, sortable roster
- [ ] Day 5 — Prediction engine (Edge Function: weighted regression → predicted final grade + risk label + confidence)
- [ ] Day 6 — Japanese i18n (react-i18next), loading/empty/error states, responsive polish
- [ ] Day 7 — Deploy to Vercel + bilingual README + demo video

---

## What I'd Do Differently at Scale

- **Move aggregations into Postgres.** Client-side loops are fine at 120 students; at 12,000 they'd get sluggish. `materialized view` refreshed on submission insert.
- **React Query (TanStack Query).** Right now data hooks are hand-rolled `useEffect` + `useState`. React Query would give caching, invalidation, and background refetching essentially for free.
- **End-to-end tests.** Playwright hitting a test project would let me refactor the RLS policies without fear.
- **CI/CD.** GitHub Actions to run `tsc --noEmit`, `eslint`, and (eventually) a Playwright suite on every PR.

---

## License

MIT

---

**Built as part of a portfolio targeting Japanese tech internships. Feedback welcome — open an issue or reach out on [LinkedIn](https://www.linkedin.com/in/aarav-sharma/).**
