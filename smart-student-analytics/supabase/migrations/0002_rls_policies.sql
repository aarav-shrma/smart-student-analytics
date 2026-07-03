-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.attendance enable row level security;
alter table public.predictions enable row level security;

-- Helper: get current user's role
create or replace function public.current_role()
returns text language sql security definer stable as $$
  select role from public.profiles where id = auth.uid()
$$;

-- PROFILES
create policy "profiles_self_read" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_teacher_read_their_students" on public.profiles
  for select using (
    exists (
      select 1 from public.enrollments e
      join public.courses c on c.id = e.course_id
      where e.student_id = profiles.id and c.teacher_id = auth.uid()
    )
  );

-- COURSES
create policy "courses_enrolled_student_read" on public.courses
  for select using (
    exists (select 1 from public.enrollments where course_id = courses.id and student_id = auth.uid())
  );

create policy "courses_teacher_read_own" on public.courses
  for select using (teacher_id = auth.uid());

-- SUBMISSIONS
create policy "submissions_student_read_own" on public.submissions
  for select using (auth.uid() = student_id);

create policy "submissions_teacher_read_course" on public.submissions
  for select using (
    exists (
      select 1 from public.assignments a
      join public.courses c on c.id = a.course_id
      where a.id = submissions.assignment_id and c.teacher_id = auth.uid()
    )
  );

-- PREDICTIONS
create policy "predictions_student_read_own" on public.predictions
  for select using (auth.uid() = student_id);

create policy "predictions_teacher_read_course" on public.predictions
  for select using (
    exists (select 1 from public.courses where id = predictions.course_id and teacher_id = auth.uid())
  );