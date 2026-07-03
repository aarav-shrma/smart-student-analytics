import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';

dotenv.config({ path: '.env.local' });

// ---------- Setup ----------
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------- Helpers ----------
function randn(mean: number, std: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

function clip(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function batchInsert<T>(table: string, rows: T[], chunkSize = 500) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      console.error(`❌ Insert into ${table} failed:`, error.message);
      throw error;
    }
  }
}

async function truncateAll() {
  console.log('🧹 Truncating existing data...');
  const tables = ['predictions', 'attendance', 'submissions', 'assignments', 'enrollments', 'courses', 'profiles'];
  for (const t of tables) {
    const { error } = await supabase.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) console.warn(`   (skip ${t}: ${error.message})`);
  }
  const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users?.users) {
    for (const u of users.users) {
      await supabase.auth.admin.deleteUser(u.id);
    }
  }
  console.log('   ✓ Truncated\n');
}

async function seed() {
  await truncateAll();

  // 1. Teachers
  console.log('👨‍🏫 Creating 4 teachers...');
  const teacherIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const fullName = faker.person.fullName();
    const email = `teacher${i + 1}@example.com`;
    const { data, error } = await supabase.auth.admin.createUser({
      email, password: 'password123', email_confirm: true,
    });
    if (error || !data.user) throw error;
    teacherIds.push(data.user.id);
    await supabase.from('profiles').insert({
      id: data.user.id, role: 'teacher', full_name: fullName, email,
    });
  }
  console.log(`   ✓ 4 teachers created\n`);

  // 2. Students
  console.log('👨‍🎓 Creating 200 students...');
  const studentIds: string[] = [];
  for (let i = 0; i < 200; i++) {
    const email = `student${i + 1}@example.com`;
    const { data, error } = await supabase.auth.admin.createUser({
      email, password: 'password123', email_confirm: true,
    });
    if (error || !data.user) throw error;
    studentIds.push(data.user.id);
    if ((i + 1) % 50 === 0) console.log(`   ...${i + 1} students created`);
  }
  const studentProfiles = studentIds.map((id, i) => {
    const useJapaneseName = Math.random() < 0.5;
    const fullName = useJapaneseName
      ? `${pick(['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura'])} ${pick(['Haruki', 'Yuki', 'Sakura', 'Ren', 'Aoi', 'Hina', 'Sora', 'Kaito'])}`
      : faker.person.fullName();
    return { id, role: 'student', full_name: fullName, email: `student${i + 1}@example.com` };
  });
  await batchInsert('profiles', studentProfiles);
  console.log(`   ✓ 200 students created\n`);

  // 3. Courses
  console.log('📚 Creating 8 courses...');
  const courseSpecs = [
    { code: 'CS101', name: 'Introduction to Programming' },
    { code: 'CS201', name: 'Data Structures & Algorithms' },
    { code: 'MATH101', name: 'Calculus I' },
    { code: 'MATH201', name: 'Linear Algebra' },
    { code: 'PHYS101', name: 'Classical Mechanics' },
    { code: 'PHYS201', name: 'Electromagnetism' },
    { code: 'ENG101', name: 'Academic Writing' },
    { code: 'ENG201', name: 'Business Communication' },
  ];
  const courses = courseSpecs.map((c, i) => ({
    code: c.code, name: c.name, term: '2026-S1', teacher_id: teacherIds[Math.floor(i / 2)],
  }));
  const { data: courseRows, error: courseErr } = await supabase.from('courses').insert(courses).select();
  if (courseErr || !courseRows) throw courseErr;
  console.log(`   ✓ 8 courses created\n`);

  // 4. Enrollments
  console.log('📝 Creating enrollments...');
  const enrollments: { student_id: string; course_id: string }[] = [];
  for (const studentId of studentIds) {
    const numCourses = 4 + Math.floor(Math.random() * 3);
    const chosen = shuffle(courseRows).slice(0, numCourses);
    for (const c of chosen) {
      enrollments.push({ student_id: studentId, course_id: c.id });
    }
  }
  await batchInsert('enrollments', enrollments);
  const { data: enrollmentRows } = await supabase.from('enrollments').select();
  console.log(`   ✓ ${enrollments.length} enrollments created\n`);

  // 5. Assignments
  console.log('📄 Creating assignments...');
  const termStart = new Date('2026-04-01');
  const assignments: any[] = [];
  for (const course of courseRows) {
    const specs = [
      { title: 'Quiz 1', type: 'quiz', weight: 10, dayOffset: 14 },
      { title: 'Homework 1', type: 'homework', weight: 15, dayOffset: 30 },
      { title: 'Midterm', type: 'midterm', weight: 20, dayOffset: 60 },
      { title: 'Quiz 2', type: 'quiz', weight: 10, dayOffset: 75 },
      { title: 'Homework 2', type: 'homework', weight: 15, dayOffset: 100 },
      { title: 'Final', type: 'final', weight: 30, dayOffset: 120 },
    ];
    for (const s of specs) {
      const dueDate = new Date(termStart);
      dueDate.setDate(dueDate.getDate() + s.dayOffset);
      assignments.push({
        course_id: course.id, title: s.title, type: s.type,
        weight: s.weight, max_score: 100, due_at: dueDate.toISOString(),
      });
    }
  }
  await batchInsert('assignments', assignments);
  const { data: assignmentRows } = await supabase.from('assignments').select();
  console.log(`   ✓ ${assignments.length} assignments created\n`);

  // 6. Submissions
  console.log('✏️  Creating submissions...');
  const strugglingStudents = new Set(shuffle(studentIds).slice(0, Math.floor(studentIds.length * 0.15)));
  console.log(`   (${strugglingStudents.size} students marked as struggling)`);

  const assignmentsByCourse = new Map<string, any[]>();
  for (const a of assignmentRows!) {
    if (!assignmentsByCourse.has(a.course_id)) assignmentsByCourse.set(a.course_id, []);
    assignmentsByCourse.get(a.course_id)!.push(a);
  }
  for (const [, arr] of assignmentsByCourse) {
    arr.sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  }

  const submissions: any[] = [];
  for (const enrollment of enrollmentRows!) {
    const courseAssignments = assignmentsByCourse.get(enrollment.course_id) || [];
    const isStruggling = strugglingStudents.has(enrollment.student_id);
    for (let idx = 0; idx < courseAssignments.length; idx++) {
      const a = courseAssignments[idx];
      let score = randn(72, 15);
      if (isStruggling) score -= idx * randn(10, 3);
      score = clip(Math.round(score), 0, 100);
      submissions.push({
        assignment_id: a.id, student_id: enrollment.student_id, score,
        submitted_at: a.due_at, graded_at: a.due_at,
      });
    }
  }
  await batchInsert('submissions', submissions);
  console.log(`   ✓ ${submissions.length} submissions created\n`);

  // 7. Attendance
  console.log('📅 Creating attendance records...');
  const attendance: any[] = [];
  const attendanceStart = new Date('2026-04-01');
  for (const enrollment of enrollmentRows!) {
    const isStruggling = strugglingStudents.has(enrollment.student_id);
    const presentRate = isStruggling ? 0.65 : 0.88;
    for (let day = 0; day < 60; day++) {
      const date = new Date(attendanceStart);
      date.setDate(date.getDate() + day);
      let localRate = presentRate;
      if (isStruggling && day > 40) localRate = 0.45;
      const roll = Math.random();
      let status: string;
      if (roll < localRate) status = 'present';
      else if (roll < localRate + 0.05) status = 'late';
      else if (roll < localRate + 0.08) status = 'excused';
      else status = 'absent';
      attendance.push({
        enrollment_id: enrollment.id,
        date: date.toISOString().split('T')[0],
        status,
      });
    }
  }
  await batchInsert('attendance', attendance, 1000);
  console.log(`   ✓ ${attendance.length} attendance records created\n`);

  console.log('✅ Seed complete!\n');
  console.log('Summary:');
  console.log(`   Profiles:    ${teacherIds.length + studentIds.length}`);
  console.log(`   Courses:     ${courseRows.length}`);
  console.log(`   Enrollments: ${enrollments.length}`);
  console.log(`   Assignments: ${assignments.length}`);
  console.log(`   Submissions: ${submissions.length}`);
  console.log(`   Attendance:  ${attendance.length}`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});