import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type CourseGrade = {
  course_id: string;
  code: string;
  name: string;
  weightedAverage: number;
  letterGrade: string;
  attendanceRate: number;
  assignmentsGraded: number;
  assignmentsTotal: number;
};

export type TrajectoryPoint = {
  date: string;         // ISO date
  dateLabel: string;    // "Apr 15"
  courseCode: string;
  score: number;
  assignmentTitle: string;
};

export type StudentSummary = {
  gpa: number;              // weighted avg across all courses
  overallAttendance: number; // %
  coursesAtRisk: number;    // courses with weightedAverage < 60
  totalCourses: number;
};

function toLetter(pct: number): string {
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
}

export function useStudentData(studentId: string | undefined) {
  const [courseGrades, setCourseGrades] = useState<CourseGrade[]>([]);
  const [trajectory, setTrajectory] = useState<TrajectoryPoint[]>([]);
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // 1. Get enrollments + course info
        const { data: enrollments, error: enrollErr } = await supabase
          .from('enrollments')
          .select('id, course_id, courses(id, code, name)')
          .eq('student_id', studentId);
        if (enrollErr) throw enrollErr;
        if (!enrollments || enrollments.length === 0) {
          if (!cancelled) {
            setCourseGrades([]);
            setTrajectory([]);
            setSummary({ gpa: 0, overallAttendance: 0, coursesAtRisk: 0, totalCourses: 0 });
            setLoading(false);
          }
          return;
        }

        const courseIds = enrollments.map((e) => e.course_id);
        const enrollmentIds = enrollments.map((e) => e.id);

        // 2. Get all assignments for those courses
        const { data: assignments, error: aErr } = await supabase
          .from('assignments')
          .select('id, course_id, title, weight, max_score, due_at')
          .in('course_id', courseIds);
        if (aErr) throw aErr;

        // 3. Get this student's submissions for those assignments
        const assignmentIds = (assignments || []).map((a) => a.id);
        const { data: submissions, error: sErr } = await supabase
          .from('submissions')
          .select('assignment_id, score')
          .eq('student_id', studentId)
          .in('assignment_id', assignmentIds);
        if (sErr) throw sErr;

        // 4. Get attendance for this student's enrollments
        const { data: attendance, error: attErr } = await supabase
          .from('attendance')
          .select('enrollment_id, status')
          .in('enrollment_id', enrollmentIds);
        if (attErr) throw attErr;

        if (cancelled) return;

        // ----- Compute course grades -----
        const submissionsByAssignment = new Map((submissions || []).map((s) => [s.assignment_id, s.score]));
        const attendanceByEnrollment = new Map<string, { present: number; total: number }>();
        for (const a of attendance || []) {
          const bucket = attendanceByEnrollment.get(a.enrollment_id) ?? { present: 0, total: 0 };
          bucket.total += 1;
          if (a.status === 'present' || a.status === 'late') bucket.present += 1;
          attendanceByEnrollment.set(a.enrollment_id, bucket);
        }

        const grades: CourseGrade[] = enrollments.map((enrollment) => {
          const course = enrollment.courses as unknown as { id: string; code: string; name: string };
          const courseAssignments = (assignments || []).filter((a) => a.course_id === course.id);

          let weightedSum = 0;
          let weightUsed = 0;
          let graded = 0;
          for (const a of courseAssignments) {
            const score = submissionsByAssignment.get(a.id);
            if (score != null) {
              const pct = (Number(score) / Number(a.max_score)) * 100;
              weightedSum += pct * Number(a.weight);
              weightUsed += Number(a.weight);
              graded += 1;
            }
          }
          const weightedAverage = weightUsed > 0 ? weightedSum / weightUsed : 0;

          const att = attendanceByEnrollment.get(enrollment.id) ?? { present: 0, total: 0 };
          const attendanceRate = att.total > 0 ? (att.present / att.total) * 100 : 0;

          return {
            course_id: course.id,
            code: course.code,
            name: course.name,
            weightedAverage: Math.round(weightedAverage * 10) / 10,
            letterGrade: toLetter(weightedAverage),
            attendanceRate: Math.round(attendanceRate * 10) / 10,
            assignmentsGraded: graded,
            assignmentsTotal: courseAssignments.length,
          };
        });

        // ----- Trajectory: every submission plotted by due date -----
        const courseCodeById = new Map(enrollments.map((e) => [
          e.course_id,
          (e.courses as unknown as { code: string }).code,
        ]));
        const points: TrajectoryPoint[] = [];
        for (const a of assignments || []) {
          const score = submissionsByAssignment.get(a.id);
          if (score == null) continue;
          const date = new Date(a.due_at);
          points.push({
            date: a.due_at,
            dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            courseCode: courseCodeById.get(a.course_id) ?? '?',
            score: Math.round((Number(score) / Number(a.max_score)) * 100),
            assignmentTitle: a.title,
          });
        }
        points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // ----- Summary -----
        const gpaWeightSum = grades.reduce((sum, g) => sum + g.weightedAverage, 0);
        const gpa = grades.length > 0 ? gpaWeightSum / grades.length : 0;
        const attTotal = grades.reduce((sum, g) => sum + g.attendanceRate, 0);
        const overallAttendance = grades.length > 0 ? attTotal / grades.length : 0;
        const coursesAtRisk = grades.filter((g) => g.weightedAverage < 60).length;

        setCourseGrades(grades.sort((a, b) => a.code.localeCompare(b.code)));
        setTrajectory(points);
        setSummary({
          gpa: Math.round(gpa * 10) / 10,
          overallAttendance: Math.round(overallAttendance * 10) / 10,
          coursesAtRisk,
          totalCourses: grades.length,
        });
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [studentId]);

  return { courseGrades, trajectory, summary, loading, error };
}