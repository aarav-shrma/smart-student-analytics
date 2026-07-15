import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type TeacherCourse = {
  id: string;
  code: string;
  name: string;
  term: string;
  studentCount: number;
};

export type StudentRow = {
  student_id: string;
  full_name: string;
  weightedAverage: number;
  letterGrade: string;
  attendanceRate: number;
  assignmentsGraded: number;
  assignmentsTotal: number;
  trend: number;
  predictedGrade: number | null;
  riskLabel: 'low' | 'medium' | 'high' | null;
  confidence: number | null;
};

export type CourseInsights = {
  courseId: string;
  students: StudentRow[];
  distribution: { bucket: string; count: number }[];
  atRiskCount: number;
  classAverage: number;
  averageAttendance: number;
};

function toLetter(pct: number): string {
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
}

function computeTrend(scores: number[]): number {
  if (scores.length < 2) return 0;
  const n = scores.length;
  const xMean = (n - 1) / 2;
  const yMean = scores.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (scores[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function useTeacherCourses(teacherId: string | undefined) {
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teacherId) return;
    const tid: string = teacherId;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const { data: courseRows, error: cErr } = await supabase
          .from('courses')
          .select('id, code, name, term')
          .eq('teacher_id', tid);
        if (cErr) throw cErr;

        const withCounts: TeacherCourse[] = [];
        for (const c of courseRows || []) {
          const { count } = await supabase
            .from('enrollments')
            .select('id', { count: 'exact', head: true })
            .eq('course_id', c.id);
          withCounts.push({
            id: c.id, code: c.code, name: c.name, term: c.term,
            studentCount: count ?? 0,
          });
        }
        if (!cancelled) setCourses(withCounts.sort((a, b) => a.code.localeCompare(b.code)));
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [teacherId]);

  return { courses, loading, error };
}

export function useCourseInsights(courseId: string | undefined) {
  const [insights, setInsights] = useState<CourseInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;
    const cid: string = courseId;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const { data: enrollments, error: eErr } = await supabase
          .from('enrollments')
          .select('id, student_id, profiles(full_name)')
          .eq('course_id', cid);
        if (eErr) throw eErr;
        if (!enrollments || enrollments.length === 0) {
          if (!cancelled) setInsights({
            courseId: cid, students: [], distribution: [],
            atRiskCount: 0, classAverage: 0, averageAttendance: 0,
          });
          return;
        }

        const { data: assignments, error: aErr } = await supabase
          .from('assignments')
          .select('id, weight, max_score, due_at')
          .eq('course_id', cid)
          .order('due_at', { ascending: true });
        if (aErr) throw aErr;

        const assignmentIds = (assignments || []).map((a) => a.id);
        const studentIds = enrollments.map((e) => e.student_id);
        const enrollmentIds = enrollments.map((e) => e.id);

        const { data: submissions, error: sErr } = await supabase
          .from('submissions')
          .select('assignment_id, student_id, score')
          .in('student_id', studentIds)
          .in('assignment_id', assignmentIds);
        if (sErr) throw sErr;

        const attendance: { enrollment_id: string; status: string }[] = [];
        const PAGE_SIZE = 1000;
        let from = 0;
        while (true) {
          const { data: batch, error: attErr } = await supabase
            .from('attendance')
            .select('enrollment_id, status')
            .in('enrollment_id', enrollmentIds)
            .range(from, from + PAGE_SIZE - 1);
          if (attErr) throw attErr;
          if (!batch || batch.length === 0) break;
          attendance.push(...batch);
          if (batch.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
        }

        const { data: predictionRows, error: pErr } = await supabase
          .from('predictions')
          .select('student_id, predicted_grade, risk_label, confidence')
          .eq('course_id', cid);
        if (pErr) throw pErr;
        const predictionsByStudent = new Map(
          (predictionRows || []).map((p) => [p.student_id, p])
        );

        if (cancelled) return;

        const submissionsMap = new Map<string, Map<string, number>>();
        for (const s of submissions || []) {
          if (!submissionsMap.has(s.student_id)) submissionsMap.set(s.student_id, new Map());
          submissionsMap.get(s.student_id)!.set(s.assignment_id, Number(s.score));
        }

        const attMap = new Map<string, { present: number; total: number }>();
        for (const a of attendance) {
          const b = attMap.get(a.enrollment_id) ?? { present: 0, total: 0 };
          b.total += 1;
          if (a.status === 'present' || a.status === 'late') b.present += 1;
          attMap.set(a.enrollment_id, b);
        }

        const students: StudentRow[] = enrollments.map((enr) => {
          const scores: number[] = [];
          let weightedSum = 0, weightUsed = 0, graded = 0;

          for (const a of assignments || []) {
            const sc = submissionsMap.get(enr.student_id)?.get(a.id);
            if (sc != null) {
              const pct = (sc / Number(a.max_score)) * 100;
              scores.push(pct);
              weightedSum += pct * Number(a.weight);
              weightUsed += Number(a.weight);
              graded += 1;
            }
          }
          const weightedAverage = weightUsed > 0 ? weightedSum / weightUsed : 0;
          const att = attMap.get(enr.id) ?? { present: 0, total: 0 };
          const attendanceRate = att.total > 0 ? (att.present / att.total) * 100 : 0;
          const trend = computeTrend(scores);

          const profile = enr.profiles as unknown as { full_name: string };
          const prediction = predictionsByStudent.get(enr.student_id);
          return {
            student_id: enr.student_id,
            full_name: profile?.full_name ?? 'Unknown',
            weightedAverage: Math.round(weightedAverage * 10) / 10,
            letterGrade: toLetter(weightedAverage),
            attendanceRate: Math.round(attendanceRate * 10) / 10,
            assignmentsGraded: graded,
            assignmentsTotal: (assignments || []).length,
            trend: Math.round(trend * 100) / 100,
            predictedGrade: prediction ? Number(prediction.predicted_grade) : null,
            riskLabel: prediction ? (prediction.risk_label as 'low' | 'medium' | 'high') : null,
            confidence: prediction ? Number(prediction.confidence) : null,
          };
        });

        const buckets = [
          { bucket: 'F (0–59)', min: 0, max: 60 },
          { bucket: 'D (60–69)', min: 60, max: 70 },
          { bucket: 'C (70–79)', min: 70, max: 80 },
          { bucket: 'B (80–89)', min: 80, max: 90 },
          { bucket: 'A (90+)', min: 90, max: 101 },
        ];
        const distribution = buckets.map((b) => ({
          bucket: b.bucket,
          count: students.filter((s) => s.weightedAverage >= b.min && s.weightedAverage < b.max).length,
        }));

        const classAverage = students.reduce((s, x) => s + x.weightedAverage, 0) / students.length;
        const averageAttendance = students.reduce((s, x) => s + x.attendanceRate, 0) / students.length;
        const atRiskCount = students.filter((s) => s.weightedAverage < 60 || s.trend < -3).length;

        if (!cancelled) setInsights({
          courseId: cid,
          students,
          distribution,
          atRiskCount,
          classAverage: Math.round(classAverage * 10) / 10,
          averageAttendance: Math.round(averageAttendance * 10) / 10,
        });
      } catch (err: any) {
        console.error('[useCourseInsights] error:', err);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [courseId]);

  return { insights, loading, error };
}

export async function refreshPredictions(courseId: string): Promise<{
  ok: boolean;
  predictionsWritten: number;
  summary?: { high: number; medium: number; low: number };
}> {
  const { data, error } = await supabase.functions.invoke('predict', {
    body: { courseId },
  });
  if (error) throw error;
  return data;
}