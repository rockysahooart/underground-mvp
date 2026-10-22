// Student screen set (lazy chunk): a student never downloads teacher screens.
import type { ScreenProps } from '../../app/hooks';
import { S01Interests, S02LevelFormat } from './Onboarding';
import { S03Home } from './Home';
import { S04Discover, S05SearchResults } from './Discover';
import { S07TeacherProfile, S08CourseDetails, S09Reviews } from './Evaluate';
import { S10ChooseTime, S11ReviewPay, S13Booked, S14CancelCourse } from './Checkout';
import { LessonRoom, S15CourseProgress, S16LessonNotes } from './Learning';

const SCREENS: Record<string, (p: ScreenProps) => JSX.Element | null> = {
  S01: S01Interests,
  S02: S02LevelFormat,
  S03: S03Home,
  S04: S04Discover,
  S05: S05SearchResults,
  S07: S07TeacherProfile,
  S08: S08CourseDetails,
  S09: S09Reviews,
  S10: S10ChooseTime,
  S11: S11ReviewPay,
  S13: S13Booked,
  S14: S14CancelCourse,
  S15: S15CourseProgress,
  S16: S16LessonNotes,
  ROOM: LessonRoom,
};

export default function StudentScreens({ screen, ...props }: ScreenProps & { screen: string }) {
  const C = SCREENS[screen];
  return C ? <C {...props} /> : null;
}
