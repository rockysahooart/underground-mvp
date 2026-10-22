// Teacher screen set (lazy chunk).
import type { ScreenProps } from '../../app/hooks';
import { useMe } from '../../app/hooks';
import { T01TeachingType, T02Specialties, T03Availability, T04Payouts, T05Preview } from './Setup';
import { T06Offerings, T07Basics, T08Curriculum, T09Price, T10Preview, T11Published } from './Builder';
import { T12Today, T13Schedule, T14SessionDetail, T15Students, T16StudentDetail, T17EditAvailability } from './Schedule';
import { T19Earnings, T20BookingEarnings, T21Payouts } from './Earnings';
import { CourseDetails } from '../student/Evaluate';
import { LessonRoom } from '../student/Learning';

/** T11 "View as a student": read-only S08 with a Preview banner, booking disabled. */
function S08Preview({ params }: ScreenProps) {
  const { db, me } = useMe();
  return <CourseDetails db={db} offeringId={params.offeringId} meId={me.id} preview />;
}

const SCREENS: Record<string, (p: ScreenProps) => JSX.Element | null> = {
  T01: T01TeachingType,
  T02: T02Specialties,
  T03: T03Availability,
  T04: T04Payouts,
  T05: T05Preview,
  T06: T06Offerings,
  T07: T07Basics,
  T08: T08Curriculum,
  T09: T09Price,
  T10: T10Preview,
  T11: T11Published,
  T12: T12Today,
  T13: T13Schedule,
  T14: T14SessionDetail,
  T15: T15Students,
  T16: T16StudentDetail,
  T17: T17EditAvailability,
  T19: T19Earnings,
  T20: T20BookingEarnings,
  T21: T21Payouts,
  S08P: S08Preview,
  ROOM: LessonRoom,
};

export default function TeacherScreens({ screen, ...props }: ScreenProps & { screen: string }) {
  const C = SCREENS[screen];
  return C ? <C {...props} /> : null;
}
