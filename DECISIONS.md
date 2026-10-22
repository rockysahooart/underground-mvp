# Decisions and assumptions

Every value the handoff marks UNSPECIFIED, every prototype assumption (A-nn), and every place the build differs from the handoff, with the reason. Open business decisions (Q-nn) use the prototype defaults from chapter 16 of the handoff.

## Sources

- **Build source:** "MVP IMPLEMENTATION · Design → Development" PDF (v1, Oct 22, 2026, 98 pages). It is the implementation contract and contains all 77 screen images, so it was used for both behavior and visuals.
- **Figma:** the file linked in the brief (`DyQIznmwYwI7OZVdM4d4E9`) was reachable through the Figma MCP, but its pages are `Mobile`, `Assets`, `Desktop` and `drafts`, not the `01 Student / 02 Teacher / 03 Components / 04 Build Reference` pages the PDF cites. Variables could not be read without a selection. Because the PDF is newer and self-contained, it wins; tokens come from the PDF's chapter 08 table.
- **Project folder:** the PDF says `Underground/`; the brief says use the existing `undergroundprototype/` folder. The brief wins.
- **Repository visibility:** the PDF's command uses `--public`; the brief says private by default. The brief wins (see README for the Pages consequence).

## Money (A-01, Q-09, Q-20, Q-22, Q-13)

- Marketplace fee 15% from the teacher (`FEE_RATE = 0.15` in `src/data/money.ts`, the only place it is defined). Student service fee $0.00 and tax $0.00, both lines stay visible.
- Integer cents everywhere. Fee is rounded half up to the cent. Per-lesson release: lessons 1 to n−1 get round-half-up(net ÷ n); lesson n gets the remainder.
- Refunds return the full listed price per untaught lesson; the matching ledger entries move to Refunded (A-03).
- $15 per lesson floor, no ceiling.
- T09 asks for the **course price** (as drawn: "$ 260"); the per-lesson price is derived as course price ÷ lessons and stored as `pricePerLessonCents`.
- T20 / Refunded: the image shows the full $39.00 fee next to a $55.26 share, which does not add up. The build shows the fee on the lessons that were kept, so Student paid − fee − refund = Your share always balances (for the demo: $260.00 − $4.87 − $227.50 = $27.63).

## Time

- One demo zone, America/Chicago, labeled "Central Time" (A-12). Demo clock starts Mon, Nov 2, 2026, 10:00 AM; `clock.now()` = real time + a developer offset that is persisted.
- Break after each lesson: 15 minutes (UNSPECIFIED). Leo's Thursday 4–7 PM and Saturday 10 AM–1 PM windows therefore give 6 weekly times (4, 5, 6 PM; 10, 11, 12).
- Hold length 10 minutes (Q-08). The time remaining is shown on S11 as an Info inline alert ("Held for 9:41") (display UNSPECIFIED, WCAG 2.2.1).
- Holidays that warn on S10 (UNSPECIFIED list): Nov 26, Dec 24, Dec 25, Dec 31, Jan 1. All affected dates are listed.
- Unanswered reschedule requests keep the original time after 48 hours (A-09, Q-14).
- Payouts are dated the next Monday at 9:00 AM.

## Seed data (chapter 13)

- Leo has 37 reviews (33 × 5 stars, 4 × 4 stars = 4.9), including Jordan M. and Priya S.; 210 lessons taught (206 before Scale plus 4 seeded lessons).
- Maya Chen (3 single lessons) and Jordan Ellis (1) are seeded as completed, paid-out single lessons, so Leo's ledger and payout history are consistent and Leo's Pending starts at $0.00. As a result, every weekly time is open at the start and S08 shows "6 weekly times open" (the S08 image shows 3); the scenario's money values are exact. The S10 "Booked" slot and S08 / No Open Times are demonstrated with the developer panel ("Another student holds a time").
- Other teachers (Ana Ruiz, Marcus Bell, Dana Kim, Sofia Reyes) make S05 show "4 results near Austin, TX" for guitar + beginner once the course is published (names other than Leo and Ana are not in the images). Sofia's "Ukulele in Four Weeks" ($140 for 4 lessons, 30 min) is the course shown on S03.
- Acoustic Guitar Foundations: 8 lessons map to 4 skills (Tune ← L1; Chords ← L2, L4, L5; Strum ← L3, L7; Full song ← L6, L8), so S15 reads "1 of 4 skills" after lesson 1.
- Alex's password and every seeded account's password: `demo-pass-1` (only Alex's is specified).
- Sign in with Apple (simulated, ~600 ms) creates one Apple demo user, "Sam Taylor", on first use and signs back into it afterwards.

## Navigation and screens

- Hash routes from chapters 03 and 04. Unknown routes go to the role root with the toast "That page is not available". A deep link into the user's other role switches role first, with a toast.
- After S13 the payment route is replaced; S10 and S11 redirect to the course once an active enrollment exists, so Back never reopens payment.
- Learning tab: opens the most recent active enrollment; with several courses a chip row switches between them (A-15; the list is not designed).
- S15 adds Lessons, "Message Leo", "Course details" and "Cancel course" rows at the end (A-04 adds Cancel course).
- T12 adds a glass avatar button next to the bell that opens A07 (A-07).
- S06 Level has an "Any" segment so the control can show "no level filter" (the image has three segments and always one selected).
- T03 / T17: one window per day (the image only shows one per day); times are `<input type="time" step="900">`.
- T08: lessons are edited in a sheet (title, milestone, reuse an existing milestone). Reorder uses a Reorder mode with Move up / Move down buttons (the WCAG 2.5.7 alternative); drag reorder is not built.
- T14 / Reschedule: offers the next open times inside the teacher's windows within a week of the chosen lesson (the image shows a Friday time outside Leo's windows).
- T18 lists this lesson's skill plus any skill already Practicing; the lesson's own skill is pre-selected to confirm.
- "Weekly lessons" offering type is accepted in T07 and behaves like a course (fixed lesson count).
- Single lessons book through the same S10 → S13 path with one lesson.
- Messaging before booking is allowed from S07 (A-08). One thread per student and teacher; the latest enrollment is pinned as the course chip.
- Guardian booking (Q-19): choosing "Maya (under 18)" as the student, or a student account under 18, shows the Info notice and blocks payment.
- Undesigned destinations show a disabled control or a "… is not in the prototype" toast (A-14): forgot password, bank editing, most settings rows, receipt, add to calendar, typed delete confirmation (replaced by a Destructive alert), unpublish, editing a published course, background check, photos, materials, attachments.
- Join opens a "Lesson room" placeholder; video is out of scope.
- Attendance values are stored only (A-11, Q-21).

## Design system

- Tokens: `src/styles/tokens.css`, values from chapter 08. Dark values are implemented through `prefers-color-scheme` but no dark screens were designed or reviewed (A-10).
- Glass: `color-mix(in srgb, var(--bg-elevated) 72%, transparent)` + `backdrop-filter: blur(24px) saturate(180%)` on the tab bar, navigation buttons and bottom action bars only; opaque under `prefers-reduced-transparency` (72% is UNSPECIFIED).
- Segmented control track and selected colors (UNSPECIFIED): bg/fill-strong track, bg/elevated raised segment.
- Alert scrim: black at 30% (UNSPECIFIED, 20–40%).
- Motion (UNSPECIFIED): push 300 ms ease-out slide, sheet 350 ms rise, alert 200 ms fade and scale from 1.05, toast 200 ms fade; 150 ms cross-fade under `prefers-reduced-motion`.
- Icons: hand-drawn inline SVG stand-ins for the named SF Symbols (`src/components/Icon.tsx`), since SF Symbols cannot ship on the web. Practicing uses a half-filled ring so the three milestone states differ by shape.
- Fonts: Playfair Display 600, 700 and 700 italic, Latin WOFF2, self-hosted from `@fontsource/playfair-display` (about 70 KB total, slightly over the 60 KB budget; only the 700 weight is preloaded).
- Section labels are drawn at 13 pt regular uppercase to match the images (the spec table names Caption 1 Emphasized 12).

## Not built (out of MVP scope per chapter 02)

Group classes, music schools, saved searches, distance sort, lesson packages, calendar sync, instant payouts, real payments, real identity checks, push notifications, video lessons, multi-device sync.
