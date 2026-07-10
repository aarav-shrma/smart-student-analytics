import type { StudentRow } from '../hooks/useTeacherData';

const gradeColors: Record<string, string> = {
  A: 'text-emerald-600 bg-emerald-50',
  B: 'text-blue-600 bg-blue-50',
  C: 'text-amber-600 bg-amber-50',
  D: 'text-orange-600 bg-orange-50',
  F: 'text-red-600 bg-red-50',
};

export default function AtRiskList({ students }: { students: StudentRow[] }) {
  // At-risk = failing OR declining hard
  const atRisk = students
    .filter((s) => s.weightedAverage < 60 || s.trend < -3)
    .sort((a, b) => a.weightedAverage - b.weightedAverage)
    .slice(0, 10);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">At-Risk Students</h3>
        <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-700 font-medium">
          {atRisk.length} flagged
        </span>
      </div>

      {atRisk.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          No students currently at risk 🎉
        </p>
      ) : (
        <ul className="space-y-3">
          {atRisk.map((s) => (
            <li key={s.student_id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div className="flex-1">
                <p className="font-medium text-sm text-gray-900">{s.full_name}</p>
                <p className="text-xs text-gray-500">
                  {s.weightedAverage.toFixed(1)}% • Attendance {s.attendanceRate.toFixed(0)}%
                  {s.trend < -3 && <span className="ml-2 text-red-600">↓ declining ({s.trend.toFixed(1)}/assignment)</span>}
                </p>
              </div>
              <span className={`ml-3 px-2 py-1 rounded text-sm font-semibold ${gradeColors[s.letterGrade]}`}>
                {s.letterGrade}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}