import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTeacherCourses, useCourseInsights } from '../hooks/useTeacherData';
import StatCard from '../components/StatCard';
import DistributionChart from '../components/DistributionChart';
import AtRiskList from '../components/AtRiskList';
import StudentRoster from '../components/StudentRoster';

export default function TeacherDashboard() {
  const { profile, signOut } = useAuth();
  const { courses, loading: coursesLoading, error: coursesError } = useTeacherCourses(profile?.id);
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>();
  const { insights, loading: insightsLoading } = useCourseInsights(selectedCourseId);

  // Auto-select first course when loaded
  useEffect(() => {
  if (courses.length > 0 && !selectedCourseId) {
    setSelectedCourseId(courses[0].id);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [courses.length]);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
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

      <main className="max-w-7xl mx-auto px-6 py-8">
        {coursesLoading && <p className="text-gray-500">Loading your courses...</p>}
        {coursesError && <p className="text-red-600 text-sm">{coursesError}</p>}

        {!coursesLoading && courses.length === 0 && (
          <p className="text-sm text-gray-500">You aren't assigned to any courses this term.</p>
        )}

        {courses.length > 0 && (
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

            {selectedCourse && insights && !insightsLoading && (
              <>
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

            {insightsLoading && <p className="text-gray-500">Loading course insights...</p>}
          </>
        )}
      </main>
    </div>
  );
}