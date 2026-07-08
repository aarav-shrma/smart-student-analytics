drop policy if exists "predictions_teacher_read_course" on public.predictions;
create policy "predictions_teacher_read_course" on public.predictions
  for select using (
    exists (
      select 1 from public.courses
      where id = predictions.course_id and teacher_id = auth.uid()
    )
  );