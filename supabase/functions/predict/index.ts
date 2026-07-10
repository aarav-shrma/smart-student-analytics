// supabase/functions/predict/index.ts
// Deno + Supabase Edge Runtime — computes and stores predictions for a course

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MODEL_VERSION = 'v1.0-weighted-regression';

// ---------- helpers ----------
function clip(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function linearRegressionSlope(scores: number[]): number {
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

// ---------- CORS ----------
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---------- main handler ----------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { courseId } = await req.json();
    if (!courseId) {
      return new Response(
        JSON.stringify({ error: 'courseId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role key — this function is trusted server-side code
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Fetch enrollments for this course
    const { data: enrollments, error: eErr } = await supabase
      .from('enrollments')
      .select('id, student_id')
      .eq('course_id', courseId);
    if (eErr) throw eErr;
    if (!enrollments || enrollments.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, predictionsWritten: 0, note: 'No enrollments' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fetch assignments for this course (sorted by due date)
    const { data: assignments, error: aErr } = await supabase
      .from('assignments')
      .select('id, weight, max_score, due_at')
      .eq('course_id', courseId)
      .order('due_at', { ascending: true });
    if (aErr) throw aErr;

    const assignmentIds = (assignments || []).map((a) => a.id);
    const studentIds = enrollments.map((e) => e.student_id);
    const enrollmentIds = enrollments.map((e) => e.id);
    const totalWeight = (assignments || []).reduce((s, a) => s + Number(a.weight), 0);

    // 3. Fetch all submissions (paginated)
    const submissions: { assignment_id: string; student_id: string; score: number | null }[] = [];
    let from = 0;
    while (true) {
      const { data: batch, error } = await supabase
        .from('submissions')
        .select('assignment_id, student_id, score')
        .in('assignment_id', assignmentIds)
        .in('student_id', studentIds)
        .range(from, from + 999);
      if (error) throw error;
      if (!batch || batch.length === 0) break;
      submissions.push(...batch);
      if (batch.length < 1000) break;
      from += 1000;
    }

    // 4. Fetch all attendance (paginated)
    const attendance: { enrollment_id: string; status: string }[] = [];
    from = 0;
    while (true) {
      const { data: batch, error } = await supabase
        .from('attendance')
        .select('enrollment_id, status')
        .in('enrollment_id', enrollmentIds)
        .range(from, from + 999);
      if (error) throw error;
      if (!batch || batch.length === 0) break;
      attendance.push(...batch);
      if (batch.length < 1000) break;
      from += 1000;
    }

    // 5. Index submissions and attendance
    const scoresByStudent = new Map<string, Map<string, number>>();
    for (const s of submissions) {
      if (s.score == null) continue;
      if (!scoresByStudent.has(s.student_id)) scoresByStudent.set(s.student_id, new Map());
      scoresByStudent.get(s.student_id)!.set(s.assignment_id, Number(s.score));
    }

    const attByEnrollment = new Map<string, { present: number; total: number }>();
    for (const a of attendance) {
      const b = attByEnrollment.get(a.enrollment_id) ?? { present: 0, total: 0 };
      b.total += 1;
      if (a.status === 'present' || a.status === 'late') b.present += 1;
      attByEnrollment.set(a.enrollment_id, b);
    }

    // 6. Compute predictions
    type Prediction = {
      student_id: string;
      course_id: string;
      predicted_grade: number;
      risk_label: 'low' | 'medium' | 'high';
      confidence: number;
      model_version: string;
    };

    const predictions: Prediction[] = enrollments.map((enr) => {
      const scoreMap = scoresByStudent.get(enr.student_id);
      const scoresChronological: number[] = [];
      let weightedSum = 0;
      let weightUsed = 0;

      for (const a of assignments || []) {
        const raw = scoreMap?.get(a.id);
        if (raw != null) {
          const pct = (raw / Number(a.max_score)) * 100;
          scoresChronological.push(pct);
          weightedSum += pct * Number(a.weight);
          weightUsed += Number(a.weight);
        }
      }

      const currentWeightedAvg = weightUsed > 0 ? weightedSum / weightUsed : 0;
      const trend = linearRegressionSlope(scoresChronological);
      const graded = scoresChronological.length;
      const remaining = (assignments || []).length - graded;

      const att = attByEnrollment.get(enr.id) ?? { present: 0, total: 0 };
      const attendanceRate = att.total > 0 ? (att.present / att.total) * 100 : 0;

      // ---- The model ----
      const projectedGrowth = trend * remaining;
      const attendancePenalty = Math.max(0, (85 - attendanceRate) * 0.3);
      let predicted = currentWeightedAvg + projectedGrowth * 0.7 - attendancePenalty;
      predicted = clip(predicted, 0, 100);

      // ---- Risk label ----
      let risk: 'low' | 'medium' | 'high';
      if (predicted < 60 || trend < -3) risk = 'high';
      else if (predicted < 70 || attendanceRate < 75) risk = 'medium';
      else risk = 'low';

      // ---- Confidence ----
      const weightCoverage = totalWeight > 0 ? weightUsed / totalWeight : 0;
      const confidence = clip(0.5 + 0.5 * weightCoverage, 0, 1);

      return {
        student_id: enr.student_id,
        course_id: courseId,
        predicted_grade: Math.round(predicted * 10) / 10,
        risk_label: risk,
        confidence: Math.round(confidence * 100) / 100,
        model_version: MODEL_VERSION,
      };
    });

    // 7. Upsert into predictions table
    const { error: upErr } = await supabase
      .from('predictions')
      .upsert(predictions, { onConflict: 'student_id,course_id' });
    if (upErr) throw upErr;

    return new Response(
      JSON.stringify({
        ok: true,
        predictionsWritten: predictions.length,
        modelVersion: MODEL_VERSION,
        summary: {
          high: predictions.filter(p => p.risk_label === 'high').length,
          medium: predictions.filter(p => p.risk_label === 'medium').length,
          low: predictions.filter(p => p.risk_label === 'low').length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('predict error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});