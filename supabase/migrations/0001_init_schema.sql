-- =========== TABLES ===========
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'teacher', 'admin')),
  full_name text not null,
  email text not null unique,
  created_at timestamptz default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  term text not null,
  teacher_id uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz default now(),
  unique (student_id, course_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  type text not null check (type in ('quiz', 'homework', 'midterm', 'final', 'project')),
  weight numeric not null check (weight > 0 and weight <= 100),
  max_score numeric not null default 100,
  due_at timestamptz not null,
  created_at timestamptz default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  score numeric,
  submitted_at timestamptz,
  graded_at timestamptz,
  unique (assignment_id, student_id)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  unique (enrollment_id, date)
);

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  predicted_grade numeric not null,
  risk_label text not null check (risk_label in ('low', 'medium', 'high')),
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  model_version text not null,
  generated_at timestamptz default now(),
  unique (student_id, course_id)
);

-- =========== INDEXES ===========
create index idx_submissions_student on public.submissions(student_id);
create index idx_submissions_assignment on public.submissions(assignment_id);
create index idx_enrollments_student on public.enrollments(student_id);
create index idx_enrollments_course on public.enrollments(course_id);
create index idx_attendance_enrollment on public.attendance(enrollment_id);
create index idx_predictions_student on public.predictions(student_id);
create index idx_courses_teacher on public.courses(teacher_id);