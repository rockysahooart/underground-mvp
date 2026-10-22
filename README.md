# Scale by Underground · MVP prototype

A mobile-first web prototype of Underground's music lesson marketplace: students discover teachers and courses, book and pay (simulated), and track progress; teachers publish courses, run their schedule and students, and track earnings. Both roles share one local data store, so a booking made as a student is the same record the teacher sees.

All people, prices and payments are fictional. Nothing is charged, sent or verified.

- **Live site:** https://rockysahooart.github.io/underground-mvp/
- **Stack:** Vite, React 18, TypeScript, plain CSS custom properties. Runtime dependencies: `react` and `react-dom` only.
- **Spec:** built from the implementation handoff PDF (not committed). Every assumption and difference is in [DECISIONS.md](DECISIONS.md).

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173/underground-mvp/ (use your browser's device toolbar at 390 × 844 for the designed size).

```bash
npm test          # money rules (Vitest)
npm run build     # type-check and production build to dist/
npm run preview   # serve the production build
```

## Demo: the connected marketplace journey

Use the small **Dev** pill (top left) to switch between the seeded accounts and move the clock. The demo clock starts Mon, Nov 2, 2026, 10:00 AM Central.

1. Dev › **Leo Park · teacher**. Offerings › **+**, or Dev › **Create the demo course draft** to skip typing the 8 lessons.
2. Basics → Curriculum → Price: enter **260** (8 × $32.50). The preview shows $39.00 fee and $221.00 earnings.
3. Preview: every checklist row is green. **Publish course** › **Publish**.
4. Dev › **Alex Rivera · student**. Discover › search **guitar**: 4 results, with the new course.
5. Open Leo › **View course**: $260 for 8 lessons.
6. **Choose a weekly time** › Thursday **5:00 PM** › **Continue to review** ($260.00, fee $0.00, tax $0.00).
7. **Buy with Apple Pay** › **Confirm** (simulated) › You're booked.
8. **Go to Learning**: next lesson Thu, Nov 5, 5:00 PM. The course page now shows Enrolled.
9. Dev › Leo: Today shows the new enrollment (Paid $260.00); Earnings shows Pending $221.00.
10. Dev › **Jump to the next lesson start**, open the lesson › **Mark complete and update progress**.
11. In the progress sheet, confirm the skill, write a note, add practice › **Save**.
12. Dev › Alex: Learning shows "1 of 8 lessons done · 1 of 4 skills confirmed" and the note; log 15 minutes of practice.
13. Dev › Leo › Earnings: Available $27.63, Pending $193.37. Dev › **Run Monday payout**: Payouts history shows $27.63 on Mon, Nov 9.

Other developer controls: next payment declines, another student holds a time (booking conflict), teach every remaining lesson (completed course and review), fail payout, offline mode, empty search results, reset demo data.

## Project structure

```
src/
  data/        schema, seed, store (localStorage "underground:v1"), selectors, money, clock, search
  services/    the mock "server": every write goes through one service function
  router/      hash router and the route tables from the handoff
  layout/      Screen, tab bar, sheets, alerts, toasts
  components/  Button, TextField, Chip, Segmented, cards, rows, icons …
  screens/     shared (A01–A09), student (S01–S18), teacher (T01–T21)
  dev/         developer panel
tests/         money.test.ts
```

Screen IDs from the handoff (A, S, T) are used as route keys and component names.

## Deployment

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main`. Hash routing means any route survives a refresh on static hosting; assets are served under `/underground-mvp/`.

## Verification

- `npm run build`: passes with no TypeScript errors. First-load JavaScript is about 74 KB gzip (React plus the app shell); the student and teacher screen sets load as separate chunks (about 12 KB and 20 KB gzip). CSS 6.3 KB gzip.
- `npm test`: 4 money tests pass ($260.00 → $39.00 fee, $221.00 net, 7 × $27.63 + $27.59 releases, $227.50 refund).
- The 13-step journey above was run end to end in a 390 × 844 browser viewport with the expected numbers at each step.
- axe-core (WCAG 2.0/2.1/2.2 A and AA rules) reported no violations on every student and teacher screen, the filter sheet and the report sheet.
- Not verified on a physical iPhone in this environment: Safari safe areas, keyboard behavior, Add to Home Screen, VoiceOver.
