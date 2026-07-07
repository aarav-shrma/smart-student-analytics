import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

type Props = { data: { bucket: string; count: number }[] };

const barColors = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#10b981'];

export default function DistributionChart({ data }: Props) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-1">Grade Distribution</h3>
      <p className="text-xs text-gray-500 mb-4">Students grouped by weighted average</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="bucket" fontSize={11} stroke="#9ca3af" />
          <YAxis fontSize={11} stroke="#9ca3af" allowDecimals={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={barColors[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}