// Entities from the handoff PDF, chapter 09. Money is always integer cents.

export type Role = 'student' | 'teacher';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type StudentLevel = 'never' | 'basics' | 'comfortable' | 'advanced';
export type Format = 'online' | 'in_person' | 'either';

export interface User {
  id: string;
  name: string;
  email: string;
  dateOfBirth: string; // YYYY-MM-DD
  password: string; // mock only, never shown
  authProvider: 'email' | 'apple';
  roles: Role[];
  activeRole: Role | null;
  lastRouteByRole: Partial<Record<Role, string>>;
  createdAt: number;
  guardianUserId?: string;
}

export interface SavedSearch {
  q: string;
  query: string; // full query string for #/s/search?...
  label: string;
}

export interface StudentProfile {
  userId: string;
  instruments: string[];
  genres: string[];
  level: StudentLevel;
  format: Format;
  approxArea?: string;
  recentSearches: SavedSearch[];
  savedTeacherIds: string[];
  onboardingComplete: boolean;
}

export type IdStatus = 'not_started' | 'pending' | 'passed' | 'failed';

export interface TeacherProfile {
  userId: string;
  teachingType?: 'independent' | 'school';
  instruments: string[];
  levels: Level[];
  formats: Format; // online | in_person | either (Both)
  serviceArea?: string;
  city: string;
  timeZone: string;
  bio?: string;
  teachingSince?: number;
  idStatus: IdStatus;
  idCheckStartedAt?: number;
  backgroundCheck: 'not_started' | 'passed';
  bankAccount?: { label: string; last4: string; closed?: boolean };
  setupStep: number; // 1..5, last unfinished step
  setupComplete: boolean;
  lessonsTaughtBefore: number; // history before Scale (seed)
  replyTime?: string;
  schoolId?: string;
}

export type OfferingStatus = 'draft' | 'published' | 'unpublished';

export interface Offering {
  id: string;
  teacherId: string;
  type: 'course' | 'single' | 'weekly';
  title: string;
  description: string;
  instrument: string;
  level: Level;
  format: Format;
  pricePerLessonCents: number;
  lessonCount: number;
  lessonMinutes: number;
  capacity: number;
  status: OfferingStatus;
  draftStep: number; // 1..4: next step to open
  publishedAt?: number;
  createdAt: number;
  beforeYouStart?: string;
}

export interface CurriculumItem {
  index: number;
  title: string;
  milestone: string;
}

export interface Course {
  offeringId: string;
  outcomes: string[];
  curriculum: CurriculumItem[];
}

export interface Availability {
  id: string;
  teacherId: string;
  weekday: number; // 0 Sunday .. 6 Saturday
  start: string; // HH:mm
  end: string; // HH:mm
  timeZone: string;
}

export type BookingStatus = 'held' | 'confirmed' | 'expired' | 'cancelled';

export interface Booking {
  id: string;
  studentUserId: string;
  payerUserId: string;
  offeringId: string;
  teacherId: string;
  weekday: number;
  startTime: string; // HH:mm teacher time
  startDate: number; // epoch ms of the first lesson
  format: 'online' | 'in_person';
  status: BookingStatus;
  holdExpiresAt: number;
  createdAt: number;
}

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'partially_refunded' | 'refunded';

export interface Payment {
  id: string;
  bookingId: string;
  amountCents: number;
  method: 'apple_pay_sim' | 'card_sim';
  status: PaymentStatus;
  refundedCents: number;
  failureReason?: string;
  paidAt?: number;
}

export type EnrollmentStatus = 'active' | 'cancelled' | 'completed';

export interface Enrollment {
  id: string;
  bookingId: string;
  studentUserId: string;
  teacherId: string;
  offeringId: string;
  status: EnrollmentStatus;
  startedAt: number;
  cancelledAt?: number;
  cancelledBy?: 'student' | 'teacher' | 'account_deleted';
  cancelReason?: string;
  weekday: number;
  startTime: string;
  format: 'online' | 'in_person';
  refundCents?: number;
}

export interface RescheduleRequest {
  proposedAt: number;
  message: string;
  expiresAt: number;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  acceptAt?: number; // accept takes effect after the 5-second undo window
}

export type LessonStatus = 'scheduled' | 'taught' | 'cancelled';

export interface Material {
  title: string;
  kind: string; // PDF, link
  detail: string;
}

export interface Lesson {
  id: string;
  enrollmentId: string;
  index: number; // 1-based
  scheduledAt: number;
  durationMin: number;
  status: LessonStatus;
  attendance?: 'attended' | 'no_show' | 'teacher_cancelled';
  rescheduleRequest?: RescheduleRequest;
  note?: string;
  noteAt?: number;
  taughtAt?: number;
  materials: Material[];
}

export type TxnState = 'pending' | 'available' | 'paid_out' | 'refunded';

export interface Transaction {
  id: string;
  teacherId: string;
  enrollmentId: string;
  lessonId: string;
  grossCents: number;
  feeCents: number;
  netCents: number;
  state: TxnState;
  payoutId?: string;
  updatedAt: number;
}

export interface Payout {
  id: string;
  teacherId: string;
  amountCents: number;
  scheduledFor: number;
  status: 'scheduled' | 'paid' | 'failed';
  transactionIds: string[];
  failureReason?: string;
}

export interface ProgressRecord {
  id: string;
  enrollmentId: string;
  milestoneIndex: number; // index into the unique skill list
  state: 'upcoming' | 'practicing' | 'confirmed';
  confirmedAt?: number;
}

export interface PracticeAssignment {
  id: string;
  enrollmentId: string;
  lessonId: string;
  title: string;
  minutesPerDay?: number;
  daysPerWeek?: number;
  createdAt: number;
}

export interface PracticeLog {
  id: string;
  assignmentId: string;
  studentUserId: string;
  minutes: number;
  comment?: string;
  loggedAt: number;
}

export interface Review {
  id: string;
  enrollmentId: string;
  studentUserId?: string;
  studentFirstName: string;
  teacherId: string;
  offeringTitle: string;
  rating: number;
  text?: string;
  createdAt: number;
}

export interface Notification {
  id: string;
  userId: string;
  role: Role;
  type: string;
  title: string;
  body: string;
  targetRoute: string;
  readAt?: number;
  createdAt: number;
  lessonId?: string;
}

export interface Thread {
  id: string;
  studentUserId: string;
  teacherId: string;
  enrollmentId?: string;
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  text: string;
  sentAt: number;
  failed?: boolean;
}

export interface Report {
  id: string;
  reporterId: string;
  subjectUserId: string;
  category: string;
  details?: string;
  createdAt: number;
}

export interface OpenTimeAlert {
  id: string;
  studentUserId: string;
  offeringId: string;
  createdAt: number;
}

export interface Session {
  userId: string;
  expiresAt: number;
}

export interface DevSettings {
  clockOffsetMs: number;
  declineNextPayment: boolean;
  failNextPayout: boolean;
  offline: boolean;
}

export interface DB {
  schemaVersion: number;
  session: Session | null;
  users: User[];
  studentProfiles: StudentProfile[];
  teacherProfiles: TeacherProfile[];
  offerings: Offering[];
  courses: Course[];
  availability: Availability[];
  bookings: Booking[];
  payments: Payment[];
  enrollments: Enrollment[];
  lessons: Lesson[];
  transactions: Transaction[];
  payouts: Payout[];
  progress: ProgressRecord[];
  assignments: PracticeAssignment[];
  practiceLogs: PracticeLog[];
  reviews: Review[];
  notifications: Notification[];
  threads: Thread[];
  messages: Message[];
  reports: Report[];
  openTimeAlerts: OpenTimeAlert[];
  drafts: Record<string, unknown>; // onboarding drafts per user and step, message drafts
  dev: DevSettings;
}

export type Result<T = undefined> = { ok: true; value: T } | { ok: false; code: string; message: string };
