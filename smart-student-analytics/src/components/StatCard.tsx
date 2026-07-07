type Props = {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'warning' | 'danger' | 'success';
};

export default function StatCard({ label, value, hint, tone = 'default' }: Props) {
  const toneClasses = {
    default: 'bg-white',
    warning: 'bg-amber-50 border-amber-200',
    danger: 'bg-red-50 border-red-200',
    success: 'bg-emerald-50 border-emerald-200',
  }[tone];

  return (
    <div className={`rounded-lg shadow-sm border border-gray-200 p-5 ${toneClasses}`}>
      <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">{label}</p>
      <p className="text-3xl font-semibold mt-1 text-gray-900">{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}