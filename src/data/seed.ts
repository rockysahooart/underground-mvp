// Seed data from chapter 13. "Acoustic Guitar Foundations" is not seeded: Leo creates it in the demo.
import type { DB, Lesson, Offering, Review, Transaction, Payout, Enrollment, Booking, Payment } from './schema';
import { DEMO_START, TZ, zonedEpoch, addDays, zoned, atTime } from './clock';
import { FEE_RATE, feeCents } from './money';

export const SCHEMA_VERSION = 3;
export const INSTRUMENTS = ['Guitar', 'Piano', 'Voice', 'Ukulele', 'Bass', 'Drums', 'Violin', 'DJ and production', 'Music theory'];
export const GENRES = ['Rock', 'Folk', 'Pop', 'Jazz', 'Classical', 'Hip-hop', 'R&B'];

const DAY = 86400000;

interface TeacherSeed {
  id: string;
  name: string;
  email: string;
  city: string;
  area: string;
  instruments: string[];
  levels: ('beginner' | 'intermediate' | 'advanced')[];
  formats: 'online' | 'in_person' | 'either';
  since: number;
  taught: number;
  bio: string;
  reviews: number[]; // ratings
  windows: [number, string, string][];
  offering: Partial<Offering> & { title: string; pricePerLessonCents: number };
}

const OTHER_TEACHERS: TeacherSeed[] = [
  {
    id: 'usr_ana',
    name: 'Ana Ruiz',
    email: 'ana@scale.example',
    city: 'Austin, TX',
    area: 'East Austin',
    instruments: ['Guitar', 'Voice'],
    levels: ['beginner', 'intermediate'],
    formats: 'in_person',
    since: 2016,
    taught: 480,
    bio: 'Classical and fingerstyle guitar, plus singing while you play. Patient with first-timers and adult beginners.',
    reviews: [5, 5, 5, 5, 5, 4, 5, 5, 5, 4, 5, 5, 5, 5, 4, 5, 5, 5, 5, 4, 5, 5, 5, 4],
    windows: [
      [1, '17:00', '20:00'],
      [3, '17:00', '20:00'],
    ],
    offering: { title: 'Guitar or voice lesson', pricePerLessonCents: 4000, instrument: 'Guitar', format: 'in_person', level: 'beginner' },
  },
  {
    id: 'usr_marcus',
    name: 'Marcus Bell',
    email: 'marcus@scale.example',
    city: 'Austin, TX',
    area: 'North Loop',
    instruments: ['Guitar', 'Bass'],
    levels: ['beginner', 'intermediate', 'advanced'],
    formats: 'online',
    since: 2018,
    taught: 320,
    bio: 'Session bassist and guitar teacher. Rock, funk and blues, taught online with screen-shared tab.',
    reviews: [5, 5, 4, 5, 4, 5, 5, 4, 5, 5, 4, 5],
    windows: [
      [2, '18:00', '21:00'],
      [0, '12:00', '15:00'],
    ],
    offering: { title: 'Online guitar or bass lesson', pricePerLessonCents: 3500, instrument: 'Guitar', format: 'online', level: 'beginner' },
  },
  {
    id: 'usr_dana',
    name: 'Dana Kim',
    email: 'dana@scale.example',
    city: 'Austin, TX',
    area: 'Hyde Park',
    instruments: ['Piano', 'Music theory'],
    levels: ['beginner', 'intermediate', 'advanced'],
    formats: 'either',
    since: 2021,
    taught: 60,
    bio: 'Piano and theory for curious adults. Jazz voicings, reading, and composing your own pieces.',
    reviews: [5, 5],
    windows: [
      [1, '09:00', '12:00'],
      [4, '09:00', '12:00'],
    ],
    offering: { title: 'Private piano lesson', pricePerLessonCents: 5000, instrument: 'Piano', format: 'either', level: 'beginner' },
  },
  {
    id: 'usr_sofia',
    name: 'Sofia Reyes',
    email: 'sofia@scale.example',
    city: 'Austin, TX',
    area: 'Mueller',
    instruments: ['Ukulele', 'Voice'],
    levels: ['beginner'],
    formats: 'either',
    since: 2020,
    taught: 150,
    bio: 'Ukulele and singing for total beginners. Four short weeks to your first campfire songs.',
    reviews: [5, 5, 5, 5, 4, 5, 5, 5, 5],
    windows: [
      [2, '16:00', '18:15'],
      [4, '16:00', '17:30'],
    ],
    offering: {
      title: 'Ukulele in Four Weeks',
      type: 'course',
      pricePerLessonCents: 3500,
      lessonCount: 4,
      lessonMinutes: 30,
      instrument: 'Ukulele',
      format: 'either',
      level: 'beginner',
      description: 'Four short lessons from your first chord to strumming along with your favorite songs.',
    },
  },
];

const REVIEW_TEXT = [
  'Relaxed lessons and a clear plan every week.',
  'Explains things simply and never rushes.',
  'Great feedback between lessons.',
  'I finally practice regularly.',
  'Fun, focused and encouraging.',
  'Really good at picking songs I like.',
];
const FIRST_NAMES = ['Sam', 'Riley', 'Chris', 'Taylor', 'Morgan', 'Avery', 'Jamie', 'Casey', 'Quinn', 'Drew', 'Harper', 'Rowan'];

export function createSeed(): DB {
  const t0 = DEMO_START;
  const db: DB = {
    schemaVersion: SCHEMA_VERSION,
    session: null,
    users: [],
    studentProfiles: [],
    teacherProfiles: [],
    offerings: [],
    courses: [],
    availability: [],
    bookings: [],
    payments: [],
    enrollments: [],
    lessons: [],
    transactions: [],
    payouts: [],
    progress: [],
    assignments: [],
    practiceLogs: [],
    reviews: [],
    notifications: [],
    threads: [],
    messages: [],
    reports: [],
    openTimeAlerts: [],
    drafts: {},
    dev: { clockOffsetMs: 0, declineNextPayment: false, failNextPayout: false, offline: false },
  };

  // ---- Alex Rivera (student) ----
  db.users.push({
    id: 'usr_alex',
    name: 'Alex Rivera',
    email: 'alex.rivera@email.com',
    dateOfBirth: '1996-03-14',
    password: 'demo-pass-1',
    authProvider: 'email',
    roles: ['student'],
    activeRole: 'student',
    lastRouteByRole: { student: '/s/home' },
    createdAt: t0 - 3 * DAY,
  });
  db.studentProfiles.push({
    userId: 'usr_alex',
    instruments: ['Guitar'],
    genres: ['Folk'],
    level: 'never',
    format: 'either',
    approxArea: 'Austin, TX',
    recentSearches: [
      { q: 'guitar', query: 'q=guitar&instrument=Guitar&level=beginner&format=online', label: 'Beginner · Online' },
      { q: 'ukulele', query: 'q=ukulele&instrument=Ukulele', label: 'Any level' },
    ],
    savedTeacherIds: [],
    onboardingComplete: true,
  });

  // ---- Leo Park (teacher) ----
  db.users.push({
    id: 'usr_leo',
    name: 'Leo Park',
    email: 'leo@scale.example',
    dateOfBirth: '1990-06-02',
    password: 'demo-pass-1',
    authProvider: 'email',
    roles: ['teacher'],
    activeRole: 'teacher',
    lastRouteByRole: { teacher: '/t/today' },
    createdAt: t0 - 120 * DAY,
  });
  db.teacherProfiles.push({
    userId: 'usr_leo',
    teachingType: 'independent',
    instruments: ['Guitar', 'Ukulele'],
    levels: ['beginner', 'intermediate'],
    formats: 'either',
    serviceArea: 'South Austin',
    city: 'Austin, TX',
    timeZone: TZ,
    bio: 'I teach adults and teens who have always wanted to play but never knew where to start. Lessons are relaxed, song-first, and built around music you actually like. Berklee Online certificate in guitar, six years teaching in Austin.',
    teachingSince: 2019,
    idStatus: 'passed',
    backgroundCheck: 'passed',
    bankAccount: { label: 'Chase checking', last4: '0932' },
    setupStep: 5,
    setupComplete: true,
    lessonsTaughtBefore: 206,
    replyTime: '< 2 hr',
  });
  db.availability.push(
    { id: 'av_leo_thu', teacherId: 'usr_leo', weekday: 4, start: '16:00', end: '19:00', timeZone: TZ },
    { id: 'av_leo_sat', teacherId: 'usr_leo', weekday: 6, start: '10:00', end: '13:00', timeZone: TZ },
  );
  db.offerings.push({
    id: 'off_leo_private',
    teacherId: 'usr_leo',
    type: 'single',
    title: 'Private guitar lesson',
    description: 'One-on-one guitar lesson built around a song you choose. Online or at my South Austin studio.',
    instrument: 'Guitar',
    level: 'beginner',
    format: 'either',
    pricePerLessonCents: 4500,
    lessonCount: 1,
    lessonMinutes: 45,
    capacity: 6,
    status: 'published',
    draftStep: 4,
    publishedAt: t0 - 60 * DAY,
    createdAt: t0 - 61 * DAY,
  });

  // Leo's 37 reviews average 4.9, including Jordan M. and Priya S. shown on S07.
  const leoReviews: Review[] = [
    {
      id: 'rev_leo_jordan',
      enrollmentId: 'legacy',
      studentFirstName: 'Jordan M.',
      teacherId: 'usr_leo',
      offeringTitle: 'Private guitar lesson',
      rating: 5,
      text: 'I came in knowing zero chords. Four lessons later I played Riptide for my partner. Leo is patient and never makes you feel slow.',
      createdAt: t0 - 14 * DAY,
    },
    {
      id: 'rev_leo_priya',
      enrollmentId: 'legacy',
      studentFirstName: 'Priya S.',
      teacherId: 'usr_leo',
      offeringTitle: 'Private guitar lesson',
      rating: 5,
      text: 'Clear plan every week and practice notes in the app afterward, so I always know what to work on.',
      createdAt: t0 - 31 * DAY,
    },
  ];
  for (let i = 0; i < 35; i++) {
    leoReviews.push({
      id: `rev_leo_${i}`,
      enrollmentId: 'legacy',
      studentFirstName: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${String.fromCharCode(65 + ((i * 7) % 26))}.`,
      teacherId: 'usr_leo',
      offeringTitle: 'Private guitar lesson',
      rating: i < 4 ? 4 : 5,
      text: REVIEW_TEXT[i % REVIEW_TEXT.length],
      createdAt: t0 - (35 + i * 6) * DAY,
    });
  }
  db.reviews.push(...leoReviews);

  // ---- Leo's single-lesson students (T15), with a consistent ledger ----
  const students = [
    { id: 'usr_maya', name: 'Maya Chen', email: 'maya@email.example', lessons: [zonedEpoch(2026, 10, 15, 18), zonedEpoch(2026, 10, 22, 18), zonedEpoch(2026, 10, 29, 18)] },
    { id: 'usr_jordan', name: 'Jordan Ellis', email: 'jordan@email.example', lessons: [zonedEpoch(2026, 10, 24, 10)] },
  ];
  const payoutsByDate = new Map<number, Payout>();
  for (const s of students) {
    db.users.push({
      id: s.id,
      name: s.name,
      email: s.email,
      dateOfBirth: '1994-01-01',
      password: 'demo-pass-1',
      authProvider: 'email',
      roles: ['student'],
      activeRole: 'student',
      lastRouteByRole: { student: '/s/home' },
      createdAt: t0 - 40 * DAY,
    });
    db.studentProfiles.push({
      userId: s.id,
      instruments: ['Guitar'],
      genres: [],
      level: 'basics',
      format: 'either',
      approxArea: 'Austin, TX',
      recentSearches: [],
      savedTeacherIds: [],
      onboardingComplete: true,
    });
    s.lessons.forEach((at, i) => {
      const n = `${s.id.slice(4)}_${i}`;
      const booking: Booking = {
        id: `bkg_${n}`,
        studentUserId: s.id,
        payerUserId: s.id,
        offeringId: 'off_leo_private',
        teacherId: 'usr_leo',
        weekday: zoned(at).weekday,
        startTime: '18:00',
        startDate: at,
        format: 'in_person',
        status: 'confirmed',
        holdExpiresAt: at - 7 * DAY,
        createdAt: at - 7 * DAY,
      };
      const payment: Payment = { id: `pay_${n}`, bookingId: booking.id, amountCents: 4500, method: 'apple_pay_sim', status: 'succeeded', refundedCents: 0, paidAt: booking.createdAt };
      const enr: Enrollment = {
        id: `enr_${n}`,
        bookingId: booking.id,
        studentUserId: s.id,
        teacherId: 'usr_leo',
        offeringId: 'off_leo_private',
        status: 'completed',
        startedAt: booking.createdAt,
        weekday: booking.weekday,
        startTime: booking.startTime,
        format: 'in_person',
      };
      const lesson: Lesson = { id: `les_${n}`, enrollmentId: enr.id, index: 1, scheduledAt: at, durationMin: 45, status: 'taught', attendance: 'attended', taughtAt: at + 45 * 60000, materials: [] };
      const fee = feeCents(4500, FEE_RATE);
      // Paid out on the Monday after the lesson.
      let monday = atTime(addDays(at, 1), '09:00');
      while (zoned(monday).weekday !== 1) monday = addDays(monday, 1);
      let po = payoutsByDate.get(monday);
      if (!po) {
        po = { id: `po_${monday}`, teacherId: 'usr_leo', amountCents: 0, scheduledFor: monday, status: 'paid', transactionIds: [] };
        payoutsByDate.set(monday, po);
      }
      const txn: Transaction = {
        id: `txn_${n}`,
        teacherId: 'usr_leo',
        enrollmentId: enr.id,
        lessonId: lesson.id,
        grossCents: 4500,
        feeCents: fee,
        netCents: 4500 - fee,
        state: 'paid_out',
        payoutId: po.id,
        updatedAt: monday,
      };
      po.amountCents += txn.netCents;
      po.transactionIds.push(txn.id);
      db.bookings.push(booking);
      db.payments.push(payment);
      db.enrollments.push(enr);
      db.lessons.push(lesson);
      db.transactions.push(txn);
    });
    db.threads.push({ id: `thr_${s.id.slice(4)}_leo`, studentUserId: s.id, teacherId: 'usr_leo', enrollmentId: `enr_${s.id.slice(4)}_0` });
  }
  db.payouts.push(...[...payoutsByDate.values()].filter((p) => p.scheduledFor <= t0));
  // Any payout dated after the demo start would not have happened yet: keep those entries available.
  for (const p of payoutsByDate.values()) {
    if (p.scheduledFor > t0) {
      for (const t of db.transactions) if (t.payoutId === p.id) Object.assign(t, { state: 'available', payoutId: undefined });
    }
  }
  db.messages.push(
    { id: 'msg_maya_1', threadId: 'thr_maya_leo', senderId: 'usr_leo', text: 'Great work tonight, Maya. Keep the barre chord light.', sentAt: zonedEpoch(2026, 10, 29, 19) },
    { id: 'msg_maya_2', threadId: 'thr_maya_leo', senderId: 'usr_maya', text: 'Could we look at the bridge of the song on Saturday, if you have a slot?', sentAt: t0 - 0.6 * DAY },
  );

  // ---- Other teachers, so discovery has real results ----
  for (const t of OTHER_TEACHERS) {
    db.users.push({
      id: t.id,
      name: t.name,
      email: t.email,
      dateOfBirth: '1988-01-01',
      password: 'demo-pass-1',
      authProvider: 'email',
      roles: ['teacher'],
      activeRole: 'teacher',
      lastRouteByRole: { teacher: '/t/today' },
      createdAt: t0 - 200 * DAY,
    });
    db.teacherProfiles.push({
      userId: t.id,
      teachingType: 'independent',
      instruments: t.instruments,
      levels: t.levels,
      formats: t.formats,
      serviceArea: t.area,
      city: t.city,
      timeZone: TZ,
      bio: t.bio,
      teachingSince: t.since,
      idStatus: 'passed',
      backgroundCheck: 'passed',
      bankAccount: { label: 'Checking', last4: '1188' },
      setupStep: 5,
      setupComplete: true,
      lessonsTaughtBefore: t.taught,
      replyTime: '< 4 hr',
    });
    t.windows.forEach(([wd, s, e], i) => db.availability.push({ id: `av_${t.id}_${i}`, teacherId: t.id, weekday: wd, start: s, end: e, timeZone: TZ }));
    const offId = `off_${t.id.slice(4)}`;
    const isCourse = t.offering.type === 'course';
    db.offerings.push({
      id: offId,
      teacherId: t.id,
      type: t.offering.type ?? 'single',
      title: t.offering.title,
      description: t.offering.description ?? t.bio,
      instrument: t.offering.instrument ?? t.instruments[0],
      level: t.offering.level ?? 'beginner',
      format: t.offering.format ?? t.formats,
      pricePerLessonCents: t.offering.pricePerLessonCents,
      lessonCount: t.offering.lessonCount ?? 1,
      lessonMinutes: t.offering.lessonMinutes ?? 45,
      capacity: 6,
      status: 'published',
      draftStep: 4,
      publishedAt: isCourse ? t0 - 3 * DAY : t0 - 90 * DAY,
      createdAt: t0 - 95 * DAY,
    });
    if (isCourse) {
      db.courses.push({
        offeringId: offId,
        outcomes: ['Hold the ukulele and tune it', 'Play C, Am, F and G', 'Strum a steady down-up pattern', 'Sing and play a full song'],
        curriculum: [
          { index: 1, title: 'Tuning and your first chord', milestone: 'Hold the ukulele and tune it' },
          { index: 2, title: 'Four chords', milestone: 'Play C, Am, F and G' },
          { index: 3, title: 'Strumming', milestone: 'Strum a steady down-up pattern' },
          { index: 4, title: 'Your first song', milestone: 'Sing and play a full song' },
        ],
      });
    }
    t.reviews.forEach((rating, i) =>
      db.reviews.push({
        id: `rev_${t.id.slice(4)}_${i}`,
        enrollmentId: 'legacy',
        studentFirstName: `${FIRST_NAMES[(i + 3) % FIRST_NAMES.length]} ${String.fromCharCode(66 + ((i * 5) % 24))}.`,
        teacherId: t.id,
        offeringTitle: t.offering.title,
        rating,
        text: REVIEW_TEXT[(i + 2) % REVIEW_TEXT.length],
        createdAt: t0 - (10 + i * 9) * DAY,
      }),
    );
  }

  return db;
}
