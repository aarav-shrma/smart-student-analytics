-- Drop the recursive policy
drop policy if exists "attendance_teacher_read_course" on public.attendance;

-- Helper: does the current user teach the course this enrollment belongs to?
create or replace function public.current_user_teaches_enrollment(enrollment_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from enrollments e
    join courses c on c.id = e.course_id
    where e.id = enrollment_uuid and c.teacher_id = auth.uid()
  );
$$;

-- Recreate the policy using the helper
create policy "attendance_teacher_read_course" on public.attendance
  for select using (public.current_user_teaches_enrollment(attendance.enrollment_id));