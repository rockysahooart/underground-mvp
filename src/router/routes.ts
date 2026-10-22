// Route contracts from chapters 03 and 04. Screen IDs are used as route keys.
import type { Role } from '../data/schema';

export type StudentTab = 'home' | 'discover' | 'learning' | 'account';
export type TeacherTab = 'today' | 'schedule' | 'offerings' | 'earnings';

export interface RouteDef {
  pattern: string;
  screen: string;
  role?: Role; // required role; shared screens have none
  tab?: StudentTab | TeacherTab | 'role-root';
  tabbar?: boolean;
  public?: boolean; // reachable without a session
}

export const ROUTES: RouteDef[] = [
  { pattern: '/welcome', screen: 'A01', public: true },
  { pattern: '/signup', screen: 'A02', public: true },
  { pattern: '/signin', screen: 'A04', public: true },
  { pattern: '/role', screen: 'A03' },
  { pattern: '/notifications', screen: 'A05', tab: 'role-root', tabbar: true },
  { pattern: '/messages/:threadId', screen: 'A06' },
  { pattern: '/account', screen: 'A07', tab: 'account', tabbar: true },
  { pattern: '/account/delete', screen: 'A08' },

  { pattern: '/s/onboarding/interests', screen: 'S01', role: 'student' },
  { pattern: '/s/onboarding/level', screen: 'S02', role: 'student' },
  { pattern: '/s/home', screen: 'S03', role: 'student', tab: 'home', tabbar: true },
  { pattern: '/s/discover', screen: 'S04', role: 'student', tab: 'discover', tabbar: true },
  { pattern: '/s/search', screen: 'S05', role: 'student', tab: 'discover', tabbar: true },
  { pattern: '/s/teacher/:teacherId', screen: 'S07', role: 'student', tab: 'discover' },
  { pattern: '/s/teacher/:teacherId/reviews', screen: 'S09', role: 'student', tab: 'discover', tabbar: true },
  { pattern: '/s/course/:offeringId', screen: 'S08', role: 'student', tab: 'discover' },
  { pattern: '/s/book/:offeringId/time', screen: 'S10', role: 'student' },
  { pattern: '/s/book/:offeringId/review', screen: 'S11', role: 'student' },
  { pattern: '/s/booked/:enrollmentId', screen: 'S13', role: 'student' },
  { pattern: '/s/learning', screen: 'S15', role: 'student', tab: 'learning', tabbar: true },
  { pattern: '/s/learning/:enrollmentId', screen: 'S15', role: 'student', tab: 'learning', tabbar: true },
  { pattern: '/s/learning/:enrollmentId/lesson/:lessonId', screen: 'S16', role: 'student', tab: 'learning', tabbar: true },
  { pattern: '/s/learning/:enrollmentId/cancel', screen: 'S14', role: 'student', tab: 'learning' },
  { pattern: '/s/lesson-room/:lessonId', screen: 'ROOM', role: 'student' },

  { pattern: '/t/onboarding/type', screen: 'T01', role: 'teacher' },
  { pattern: '/t/onboarding/specialties', screen: 'T02', role: 'teacher' },
  { pattern: '/t/onboarding/availability', screen: 'T03', role: 'teacher' },
  { pattern: '/t/onboarding/payouts', screen: 'T04', role: 'teacher' },
  { pattern: '/t/onboarding/preview', screen: 'T05', role: 'teacher' },
  { pattern: '/t/today', screen: 'T12', role: 'teacher', tab: 'today', tabbar: true },
  { pattern: '/t/schedule', screen: 'T13', role: 'teacher', tab: 'schedule', tabbar: true },
  { pattern: '/t/students', screen: 'T15', role: 'teacher', tab: 'schedule', tabbar: true },
  { pattern: '/t/students/:studentId', screen: 'T16', role: 'teacher', tab: 'schedule', tabbar: true },
  { pattern: '/t/lesson/:lessonId', screen: 'T14', role: 'teacher', tab: 'schedule' },
  { pattern: '/t/availability', screen: 'T17', role: 'teacher', tab: 'schedule' },
  { pattern: '/t/offerings', screen: 'T06', role: 'teacher', tab: 'offerings', tabbar: true },
  { pattern: '/t/builder/:offeringId/basics', screen: 'T07', role: 'teacher' },
  { pattern: '/t/builder/:offeringId/curriculum', screen: 'T08', role: 'teacher' },
  { pattern: '/t/builder/:offeringId/price', screen: 'T09', role: 'teacher' },
  { pattern: '/t/builder/:offeringId/preview', screen: 'T10', role: 'teacher' },
  { pattern: '/t/builder/:offeringId/published', screen: 'T11', role: 'teacher' },
  { pattern: '/t/earnings', screen: 'T19', role: 'teacher', tab: 'earnings', tabbar: true },
  { pattern: '/t/earnings/booking/:enrollmentId', screen: 'T20', role: 'teacher', tab: 'earnings', tabbar: true },
  { pattern: '/t/payouts', screen: 'T21', role: 'teacher', tab: 'earnings', tabbar: true },
  { pattern: '/t/lesson-room/:lessonId', screen: 'ROOM', role: 'teacher' },
  { pattern: '/t/preview/:offeringId', screen: 'S08P', role: 'teacher' },
];

export const ROLE_ROOT: Record<Role, string> = { student: '/s/home', teacher: '/t/today' };

export const STUDENT_TABS: { key: StudentTab; label: string; icon: string; to: string }[] = [
  { key: 'home', label: 'Home', icon: 'house', to: '/s/home' },
  { key: 'discover', label: 'Discover', icon: 'magnifyingglass', to: '/s/discover' },
  { key: 'learning', label: 'Learning', icon: 'music.note.list', to: '/s/learning' },
  { key: 'account', label: 'Account', icon: 'person.crop.circle', to: '/account' },
];

export const TEACHER_TABS: { key: TeacherTab; label: string; icon: string; to: string }[] = [
  { key: 'today', label: 'Today', icon: 'house', to: '/t/today' },
  { key: 'schedule', label: 'Schedule', icon: 'calendar', to: '/t/schedule' },
  { key: 'offerings', label: 'Offerings', icon: 'music.note.list', to: '/t/offerings' },
  { key: 'earnings', label: 'Earnings', icon: 'dollarsign.circle', to: '/t/earnings' },
];

export const TEACHER_STEPS = ['type', 'specialties', 'availability', 'payouts', 'preview'];
