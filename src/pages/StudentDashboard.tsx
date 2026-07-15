import { useAuth } from '../hooks/useAuth';
import { useStudentData } from '../hooks/useStudentData';
import StatCard from '../components/StatCard';
import CourseCard from '../components/CourseCard';
import TrajectoryChart from '../components/TrajectoryChart';
import { DashboardSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

export default function StudentDashboard() {
  const { profile, signOut } = useAuth();
  const { courseGrades, trajectory, summary, loading, error } = useStudentData(profile?.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs text-gray-500">Student Dashboard</p>
            <h1 className="text-xl font-semibold text-gray-900">{profile?.full_name}</h1>
          </div>
          <button
            onClick={signOut}
            className="px-4 py-2 text-sm bg-gray-100 rounded-md hover:bg-gray-200 font-medium"
          >
            Sign out
          </button>
        </div>
      </header>

      {loading && <DashboardSkeleton count={6} />}

      {error && (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div>
                <h3 className="font-semibold text-red-900 mb-1">Something went wrong</h3>
                <p className="text-sm text-red-700 mb-3">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="text-sm px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && summary && (
        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* Summary strip */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Overall Average"
              value={`${summary.gpa.toFixed(1)}%`}
              hint="Across all courses"
            />
            <StatCard
              label="Attendance"
              value={`${summary.overallAttendance.toFixed(0)}%`}
              hint="Present + late"
              tone={summary.overallAttendance < 75 ? 'warning' : 'default'}
            />
            <StatCard
              label="Courses"
              value={String(summary.totalCourses)}
              hint="Enrolled this term"
            />
            <StatCard
              label="At Risk"
              value={String(summary.coursesAtRisk)}
              hint="Below 60% weighted"
              tone={summary.coursesAtRisk > 0 ? 'danger' : 'success'}
            />
          </section>

          {/* Trajectory chart */}
          <section className="mb-8">
            <TrajectoryChart points={trajectory} />
          </section>

          {/* Course cards */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Courses</h2>
            {courseGrades.length === 0 ? (
              <EmptyState
                icon="📚"
                title="No courses yet"
                message="You aren't enrolled in any courses this term. Check back after registration opens."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {courseGrades.map((c) => (
                  <CourseCard key={c.course_id} course={c} />
                ))}
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}