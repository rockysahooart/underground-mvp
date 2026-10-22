// Developer panel (chapter 11): hidden behind a small "Dev" pill, excluded from screen readers.
import { useState } from 'react';
import { Alert, Sheet } from '../layout/layout';
import { ListRow } from '../components/ui';
import { useDB } from '../data/store';
import * as sel from '../data/selectors';
import { fmtDateTime, now } from '../data/clock';
import { toast } from '../data/ui';
import { navigate, useLocation } from '../router/hashRouter';
import {
  advanceClock,
  createDemoDraft,
  devCompleteAll,
  devSignInAs,
  failPayout,
  jumpToNextLesson,
  passIdCheck,
  resetClock,
  resetDemo,
  runPayout,
  setDev,
  simulateOtherHold,
  signOut,
  switchRole,
} from '../services';
import { ROLE_ROOT } from '../router/routes';

function Toggle({ label, on, onChange, sub }: { label: string; on: boolean; onChange: (v: boolean) => void; sub?: string }) {
  return (
    <button type="button" className="row" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="row__text">
        <span className="row__title">{label}</span>
        {sub && <span className="row__subtitle">{sub}</span>}
      </span>
      <span style={{ width: 51, height: 31, borderRadius: 16, background: on ? 'var(--status-success)' : 'var(--bg-fill-strong)', position: 'relative', flex: 'none', transition: 'background 150ms' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: 14, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.3)', transition: 'left 150ms' }} />
      </span>
    </button>
  );
}

export default function DevPanel() {
  const db = useDB();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const me = sel.currentUser(db);
  const close = () => setOpen(false);
  const report = (r: { ok: boolean; message?: string }, okText: string) => toast(r.ok ? okText : (r as { message: string }).message, { icon: r.ok ? 'check' : 'info' });

  const offeringFromRoute = () => {
    const m = loc.path.match(/\/s\/(?:book|course)\/([^/]+)/);
    if (m) return m[1];
    return db.offerings.find((o) => o.status === 'published' && o.type === 'course' && o.teacherId === 'usr_leo')?.id ?? db.offerings.find((o) => o.status === 'published')?.id;
  };
  const myActiveEnrollment = () =>
    me && db.enrollments.filter((e) => (e.studentUserId === me.id || e.teacherId === me.id) && e.status === 'active').sort((a, b) => b.startedAt - a.startedAt)[0];

  const as = (userId: string, role: 'student' | 'teacher') => {
    devSignInAs(userId);
    switchRole(userId, role);
    const u = sel.user(db, userId);
    navigate(u?.lastRouteByRole[role] ?? ROLE_ROOT[role], { dir: 'none' });
    close();
    toast(`Signed in as ${u?.name}`, { icon: 'check' });
  };

  return (
    <>
      <button type="button" className="dev-pill" aria-hidden="true" tabIndex={-1} onClick={() => setOpen(true)}>
        Dev
      </button>
      <Sheet open={open} large title="Developer panel" onCancel={close} cancelLabel="Close">
        <div className="dev-panel stack" aria-hidden={false}>
          <p className="t-footnote c-secondary">
            Demo clock: {fmtDateTime(now())} Central · Signed in: {me ? `${me.name} (${me.activeRole ?? 'no role'})` : 'nobody'}
          </p>
          <section className="stack-6">
            <h3 className="section-label">Who</h3>
            <div className="group">
              <ListRow title="Alex Rivera · student" subtitle="alex.rivera@email.com · demo-pass-1" chevron onClick={() => as('usr_alex', 'student')} />
              <ListRow title="Leo Park · teacher" subtitle="leo@scale.example · demo-pass-1" chevron onClick={() => as('usr_leo', 'teacher')} />
              {me && me.roles.length > 1 && (
                <ListRow
                  title={`Switch to ${me.activeRole === 'student' ? 'teacher' : 'student'}`}
                  chevron
                  onClick={() => {
                    const r = me.activeRole === 'student' ? 'teacher' : 'student';
                    as(me.id, r);
                  }}
                />
              )}
              {me && (
                <ListRow
                  title="Sign out"
                  onClick={() => {
                    signOut();
                    navigate('/welcome', { replace: true });
                    close();
                  }}
                />
              )}
            </div>
          </section>
          <section className="stack-6">
            <h3 className="section-label">Clock</h3>
            <div className="group">
              <ListRow
                title="Jump to the next lesson start"
                chevron
                onClick={() => {
                  if (!me) return;
                  const r = jumpToNextLesson(me.id);
                  report(r, r.ok ? `Clock moved to ${fmtDateTime(r.value)}` : '');
                }}
              />
              <ListRow title="Add 1 hour" onClick={() => advanceClock(3600000)} />
              <ListRow title="Add 1 day" onClick={() => advanceClock(86400000)} />
              <ListRow title="Add 1 week" onClick={() => advanceClock(7 * 86400000)} />
              <ListRow title="Reset to Mon, Nov 2, 10:00 AM" onClick={() => resetClock()} />
            </div>
          </section>
          <section className="stack-6">
            <h3 className="section-label">Payments and bookings</h3>
            <div className="group">
              <Toggle label="Next payment declines" sub="Simulates a card decline on S12" on={db.dev.declineNextPayment} onChange={(v) => setDev({ declineNextPayment: v })} />
              <ListRow
                title="Another student holds a time"
                subtitle="Booking conflict on the current or newest course"
                onClick={() => {
                  const id = offeringFromRoute();
                  if (!id) return toast('No published course yet', { icon: 'info' });
                  const q = loc.query;
                  const r = simulateOtherHold(id, q.get('day') ? Number(q.get('day')) : undefined, q.get('time') ?? undefined);
                  report(r, r.ok ? `${r.value} is now held by another student` : '');
                }}
              />
              <ListRow
                title="Teach every remaining lesson"
                subtitle="View completed sessions and progress"
                onClick={() => {
                  const e = myActiveEnrollment();
                  if (!e) return toast('No active course for this user', { icon: 'info' });
                  report(devCompleteAll(e.id), 'All lessons taught; course completed');
                }}
              />
            </div>
          </section>
          <section className="stack-6">
            <h3 className="section-label">Teacher money and checks</h3>
            <div className="group">
              <ListRow title="Run Monday payout" subtitle="Available → Paid out" onClick={() => report(runPayout(me?.id ?? 'usr_leo'), 'Payout run')} />
              <ListRow
                title="Fail payout"
                subtitle="Fails the latest payout, or the next one"
                onClick={() => {
                  const r = failPayout(me?.id ?? 'usr_leo');
                  report(r, r.ok && r.value === 'next' ? 'The next payout will fail' : 'Latest payout failed');
                }}
              />
              <ListRow title="Pass the ID check now" onClick={() => me && passIdCheck(me.id)} />
              <ListRow
                title="Create the demo course draft"
                subtitle="Acoustic Guitar Foundations with 8 lessons (Leo)"
                onClick={() => {
                  if (!me?.roles.includes('teacher')) return toast('Sign in as a teacher first', { icon: 'info' });
                  const id = createDemoDraft(me.id);
                  close();
                  navigate(`/t/builder/${id}/basics`);
                }}
              />
            </div>
          </section>
          <section className="stack-6">
            <h3 className="section-label">Network and search</h3>
            <div className="group">
              <Toggle label="Offline" sub="Banner on search; network actions disabled" on={db.dev.offline} onChange={(v) => setDev({ offline: v })} />
              <ListRow
                title="Trigger empty search results"
                onClick={() => {
                  close();
                  navigate('/s/search?q=harp&level=beginner');
                }}
              />
            </div>
          </section>
          <div className="group">
            <ListRow title="Reset demo data" destructive onClick={() => setConfirmReset(true)} />
          </div>
        </div>
      </Sheet>
      <Alert
        open={confirmReset}
        title="Reset demo data?"
        message="Every booking, course, message and payout returns to the seed. You are signed out."
        cancel={{ label: 'Cancel', bold: true, onClick: () => setConfirmReset(false) }}
        confirm={{
          label: 'Reset',
          destructive: true,
          onClick: () => {
            resetDemo();
            setConfirmReset(false);
            close();
            navigate('/welcome', { replace: true });
            toast('Demo data reset', { icon: 'check' });
          },
        }}
      />
    </>
  );
}
