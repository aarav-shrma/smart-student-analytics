import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTeacherCourses, useCourseInsights, refreshPredictions } from '../hooks/useTeacherData';
import StatCard from '../components/StatCard';
import DistributionChart from '../components/DistributionChart';
import AtRiskList from '../components/AtRiskList';
import StudentRoster from '../components/StudentRoster';
import { DashboardSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

export default function TeacherDashboard() {
  const { profile, signOut } = useAuth();
  const { courses, loading: coursesLoading, error: coursesError } = useTeacherCourses(profile?.id);
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const { insights, loading: insightsLoading } = useCourseInsights(selectedCourseId);

  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses.length]);

  async function handleRefresh() {
    if (!selectedCourseId) return;
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const result = await refreshPredictions(selectedCourseId);
      setRefreshMsg(
        `Updated ${result.predictionsWritten} predictions (${result.summary?.high} high · ${result.summary?.medium} med · ${result.summary?.low} low)`
      );
      setTimeout(() => window.location.reload(), 800);
    } catch (err: any) {
      setRefreshMsg(`Error: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  }

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs text-gray-500">Teacher Dashboard</p>
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

      {coursesLoading && <DashboardSkeleton count={4} />}

      {coursesError && (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div>
                <h3 className="font-semibold text-red-900 mb-1">Something went wrong</h3>
                <p className="text-sm text-red-700 mb-3">{coursesError}</p>
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

      {!coursesLoading && !coursesError && (
        <main className="max-w-7xl mx-auto px-6 py-8">
          {courses.length === 0 ? (
            <EmptyState
              icon="👨‍🏫"
              title="No courses assigned"
              message="You aren't teaching any courses this term."
            />
          ) : (
            <>
              {/* Course selector */}
              <section className="mb-6 flex flex-wrap gap-2">
                {courses.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCourseId(c.id)}
                    className={`px-4 py-2 rounded-md text-sm font-medium border transition ${
                      selectedCourseId === c.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {c.code} · {c.name}
                    <span className={`ml-2 text-xs ${selectedCourseId === c.id ? 'text-blue-100' : 'text-gray-500'}`}>
                      {c.studentCount}
                    </span>
                  </button>
                ))}
              </section>

              {insightsLoading && <DashboardSkeleton count={4} />}

              {selectedCourse && insights && !insightsLoading && (
                <>
                  {/* Refresh predictions bar */}
                  <div className="mb-4 flex items-center gap-3 flex-wrap">
                    <button
                      onClick={handleRefresh}
                      disabled={refreshing}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {refreshing ? 'Computing…' : 'Refresh Predictions'}
                    </button>
                    {refreshMsg && <span className="text-xs text-gray-600">{refreshMsg}</span>}
                  </div>

                  {/* KPIs */}
                  <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard
                      label="Class Average"
                      value={`${insights.classAverage.toFixed(1)}%`}
                      hint={`${selectedCourse.code}`}
                    />
                    <StatCard
                      label="Avg Attendance"
                      value={`${insights.averageAttendance.toFixed(0)}%`}
                      tone={insights.averageAttendance < 80 ? 'warning' : 'default'}
                    />
                    <StatCard
                      label="Students"
                      value={String(insights.students.length)}
                      hint="Enrolled"
                    />
                    <StatCard
                      label="At Risk"
                      value={String(insights.atRiskCount)}
                      hint="Failing or declining"
                      tone={insights.atRiskCount > 0 ? 'danger' : 'success'}
                    />
                  </section>

                  {/* Row: distribution + at-risk */}
                  <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
                    <DistributionChart data={insights.distribution} />
                    <AtRiskList students={insights.students} />
                  </section>

                  {/* Roster */}
                  <section>
                    <StudentRoster students={insights.students} />
                  </section>
                </>
              )}
            </>
          )}
        </main>
      )}
    </div>
  );
}