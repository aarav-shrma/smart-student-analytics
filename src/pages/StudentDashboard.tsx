import { useAuth } from '../hooks/useAuth';
import { useStudentData } from '../hooks/useStudentData';
import StatCard from '../components/StatCard';
import CourseCard from '../components/CourseCard';
import TrajectoryChart from '../components/TrajectoryChart';

export default function StudentDashboard() {
  const { profile, signOut } = useAuth();
  const { courseGrades, trajectory, summary, loading, error } = useStudentData(profile?.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
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

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading && <p className="text-gray-500">Loading your data...</p>}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && summary && (
          <>
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
                <p className="text-sm text-gray-500">You're not enrolled in any courses.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {courseGrades.map((c) => (
                    <CourseCard key={c.course_id} course={c} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}