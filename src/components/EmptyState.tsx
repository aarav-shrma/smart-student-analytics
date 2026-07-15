type Props = {
  icon?: string;
  title: string;
  message?: string;
  action?: React.ReactNode;
};

export default function EmptyState({ icon = '📭', title, message, action }: Props) {
  return (
    <div className="bg-white rounded-lg border border-dashed border-gray-300 p-10 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      {message && <p className="text-sm text-gray-500 max-w-md mx-auto">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}