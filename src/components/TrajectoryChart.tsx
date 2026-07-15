import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import type { TrajectoryPoint } from '../hooks/useStudentData';

export default function TrajectoryChart({ points }: { points: TrajectoryPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex items-center justify-center h-64">
        <p className="text-sm text-gray-500">No graded assignments yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-1">Grade Trajectory</h3>
      <p className="text-xs text-gray-500 mb-4">
        Every assignment score plotted by due date, across all courses
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={points} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="dateLabel" fontSize={11} stroke="#9ca3af" />
          <YAxis domain={[0, 100]} fontSize={11} stroke="#9ca3af" />
          <ReferenceLine y={60} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Passing', fontSize: 10, fill: '#ef4444', position: 'insideTopRight' }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 6 }}
            labelFormatter={(label) => `Due: ${label}`}
            formatter={(value, _name, entry: any) => [
              `${value}% (${entry.payload.courseCode} — ${entry.payload.assignmentTitle})`,
              'Score',
            ]}
          />
          <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}