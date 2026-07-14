import { useMemo, useState } from 'react';
import type { StudentRow } from '../hooks/useTeacherData';

type SortKey = 'name' | 'grade' | 'attendance' | 'trend';

export default function StudentRoster({ students }: { students: StudentRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('grade');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

  const sorted = useMemo(() => {
    const filtered = students.filter((s) =>
      s.full_name.toLowerCase().includes(search.toLowerCase())
    );
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'name': return dir * a.full_name.localeCompare(b.full_name);
        case 'grade': return dir * (a.weightedAverage - b.weightedAverage);
        case 'attendance': return dir * (a.attendanceRate - b.attendanceRate);
        case 'trend': return dir * (a.trend - b.trend);
      }
    });
  }, [students, sortKey, sortDir, search]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function arrow(key: SortKey) {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Full Roster ({students.length})</h3>
        <input
          type="text"
          placeholder="Search students..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200">
              <th className="pb-3 cursor-pointer hover:text-gray-700" onClick={() => toggleSort('name')}>Student{arrow('name')}</th>
              <th className="pb-3 cursor-pointer hover:text-gray-700" onClick={() => toggleSort('grade')}>Grade{arrow('grade')}</th>
              <th className="pb-3 cursor-pointer hover:text-gray-700" onClick={() => toggleSort('attendance')}>Attendance{arrow('attendance')}</th>
              <th className="pb-3 cursor-pointer hover:text-gray-700" onClick={() => toggleSort('trend')}>Trend{arrow('trend')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.student_id} className="border-b border-gray-100 last:border-0">
                <td className="py-3 font-medium text-gray-900">{s.full_name}</td>
                <td className="py-3">
                  <span className="font-semibold">{s.weightedAverage.toFixed(1)}%</span>
                  <span className="text-gray-400 ml-1">({s.letterGrade})</span>
                </td>
                <td className="py-3">{s.attendanceRate.toFixed(0)}%</td>
                <td className={`py-3 ${s.trend < -1 ? 'text-red-600' : s.trend > 1 ? 'text-emerald-600' : 'text-gray-500'}`}>
                  {s.trend > 0 ? '+' : ''}{s.trend.toFixed(1)}
                </td>
                <td className="py-3">
  {s.predictedGrade != null ? (
    <div className="flex items-center gap-2">
      <span className="font-semibold">{s.predictedGrade.toFixed(1)}%</span>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        s.riskLabel === 'high' ? 'bg-red-100 text-red-700' :
        s.riskLabel === 'medium' ? 'bg-amber-100 text-amber-700' :
        'bg-emerald-100 text-emerald-700'
      }`}>
        {s.riskLabel}
      </span>
    </div>
  ) : (
    <span className="text-gray-400 text-xs">—</span>
  )}
</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}