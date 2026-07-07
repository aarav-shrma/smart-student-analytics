import { useAuth } from '../hooks/useAuth';

export default function StudentDashboard() {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen p-6">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Student Dashboard</h1>
        <button
          onClick={signOut}
          className="px-4 py-2 text-sm bg-gray-200 rounded-md hover:bg-gray-300"
        >
          Sign out
        </button>
      </header>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl mb-2">Hello, {profile?.full_name}!</h2>
        <p className="text-gray-600">Role: {profile?.role}</p>
        <p className="text-gray-600 mt-4 text-sm">
          Your grades, attendance, and predictions will appear here soon.
        </p>
      </div>
    </div>
  );
}