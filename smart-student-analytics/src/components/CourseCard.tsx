import type { CourseGrade } from '../hooks/useStudentData';

const gradeColors: Record<string, string> = {
  A: 'text-emerald-600 bg-emerald-50',
  B: 'text-blue-600 bg-blue-50',
  C: 'text-amber-600 bg-amber-50',
  D: 'text-orange-600 bg-orange-50',
  F: 'text-red-600 bg-red-50',
};

export default function CourseCard({ course }: { course: CourseGrade }) {
  const badgeClass = gradeColors[course.letterGrade] ?? 'text-gray-600 bg-gray-50';
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-gray-500 font-medium">{course.code}</p>
          <h3 className="font-semibold text-gray-900">{course.name}</h3>
        </div>
        <div className={`px-3 py-1 rounded-full text-lg font-semibold ${badgeClass}`}>
          {course.letterGrade}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <p className="text-xs text-gray-500">Weighted Avg</p>
          <p className="text-lg font-semibold text-gray-900">{course.weightedAverage.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Attendance</p>
          <p className="text-lg font-semibold text-gray-900">{course.attendanceRate.toFixed(0)}%</p>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-3">
        {course.assignmentsGraded} of {course.assignmentsTotal} assignments graded
      </p>
    </div>
  );
}