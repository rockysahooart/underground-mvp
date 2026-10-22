// Flow 04: S10 Choose Time (+ Time Taken), S11 Review and Pay (+ Card Declined, Guardian Booking),
// S12 simulated payment sheet, S13 Booked, S14 Cancel Course.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Screen, Sheet } from '../../layout/layout';
import { Button, InlineAlert, ListRow, Segmented, TimeSlot } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useMe, type ScreenProps } from '../../app/hooks';
import { back as routerBack, navigate } from '../../router/hashRouter';
import * as sel from '../../data/selectors';
import { addDays, fmtDate, fmtHM, fmtMonthDay, fmtRange, fmtTime, isHoliday, nextOccurrence, now, TZ_LABEL, WEEKDAYS } from '../../data/clock';
import { fmt, studentTotal } from '../../data/money';
import { toast, useNow, wait } from '../../data/ui';
import { cancelCourse, cancelHold, confirmPayment, getOrCreateThread, holdSlot, refundPreview } from '../../services';
import { goBack } from '../../layout/layout';

function useEnrolledRedirect(offeringId: string) {
  const { db, me } = useMe();
  const enr = sel.activeEnrollmentFor(db, me.id, offeringId);
  useEffect(() => {
    // After booking, Back never reopens checkout.
    if (enr) navigate(`/s/learning/${enr.id}`, { replace: true, dir: 'back' });
  }, [enr]);
  return enr;
}

export function S10ChooseTime({ params, query }: ScreenProps) {
  const { db, me } = useMe();
  const t = useNow(5000);
  const enr = useEnrolledRedirect(params.offeringId);
  const off = sel.offering(db, params.offeringId);
  const slots = off ? sel.slotsFor(db, off, t, me.id) : [];
  const days = [...new Set(slots.map((s) => s.weekday))];
  const [day, setDay] = useState<number>(() => Number(query.get('day') ?? days[0] ?? 4));
  const selTime = query.get('time');
  const selDay = query.get('day') ? Number(query.get('day')) : undefined;
  const [where, setWhere] = useState<'online' | 'in_person'>((query.get('where') as 'online' | 'in_person') ?? (off?.format === 'in_person' ? 'in_person' : 'online'));
  const [taken, setTaken] = useState<string | null>(query.get('taken'));
  const expired = query.get('expired') === '1';
  const selected = slots.find((s) => s.weekday === selDay && s.time === selTime);

  // Time Taken: the selected slot greys out live and the selection clears.
  useEffect(() => {
    if (selTime && selected && selected.status === 'taken') {
      setTaken(`${fmtHM(selTime)} was just booked by another student. Pick another time.`);
      navigate(`/s/book/${params.offeringId}/time?day=${selDay}&where=${where}`, { replace: true, dir: 'none' });
    }
  }, [selected, selTime, selDay, params.offeringId, where]);

  useEffect(() => {
    if (!off || off.status !== 'published') navigate(`/s/course/${params.offeringId}`, { replace: true });
  }, [off, params.offeringId]);
  if (!off || enr) return null;

  const pick = (time: string) => {
    setTaken(null);
    navigate(`/s/book/${off.id}/time?day=${day}&time=${time}&where=${where}`, { replace: true, dir: 'none' });
  };
  const first = selected && selTime ? nextOccurrence(t, selDay!, selTime) : undefined;
  const last = first ? addDays(first, 7 * (off.lessonCount - 1)) : undefined;
  const lessonDates = first ? Array.from({ length: off.lessonCount }, (_, i) => addDays(first, 7 * i)) : [];
  const holidays = lessonDates.filter(isHoliday);
  const weekStart = days.length ? Math.min(...days.map((d) => nextOccurrence(t, d, slots.find((s) => s.weekday === d)!.time))) : t;
  const anyOpen = slots.some((s) => s.status === 'open');
  const isCourse = off.lessonCount > 1;
  const daySlots = slots.filter((s) => s.weekday === day);

  return (
    <Screen
      title="Book course"
      navTitle
      ownHeading
      back
      bottom={
        <>
          {(taken || expired) && (
            <div className="toast" role="status" style={{ marginBottom: 6 }}>
              <Icon name="info.circle.fill" size={20} />
              <span>{taken ?? 'Your hold ended. Pick a time again.'}</span>
            </div>
          )}
          <Button disabled={!selected || selected.status !== 'open'} onClick={() => navigate(`/s/book/${off.id}/review?day=${selDay}&time=${selTime}&where=${where}`)}>
            {selected ? 'Continue to review' : 'Choose a time to continue'}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="title-block">
          <h1 className="t-title1">Pick your {isCourse ? 'weekly ' : ''}time</h1>
          <p className="t-body c-secondary">
            {isCourse ? `Same time every week for ${off.lessonCount} weeks, starting the week of ${fmtMonthDay(weekStart)}.` : `One ${off.lessonMinutes}-minute lesson.`} Times are in {TZ_LABEL}.
          </p>
        </div>
        {days.length > 1 && (
          <Segmented
            label="Day of the week"
            value={String(day)}
            onChange={(v) => setDay(Number(v))}
            options={days.map((d) => ({ value: String(d), label: `${WEEKDAYS[d]}s` }))}
          />
        )}
        {!anyOpen && <InlineAlert tone="warning" title="No weekly times open">Every weekly time is booked or held right now.</InlineAlert>}
        <div className="slots" role="radiogroup" aria-label={`${WEEKDAYS[day]} times`}>
          {daySlots.map((s) => (
            <TimeSlot key={s.time} time={fmtHM(s.time)} status={s.status} selected={s.weekday === selDay && s.time === selTime} onSelect={() => pick(s.time)} />
          ))}
        </div>
        {off.format === 'either' && (
          <div className="stack-8">
            <p className="field__label" id="where-l">
              Where
            </p>
            <Segmented
              label="Where"
              value={where}
              onChange={(v) => {
                setWhere(v);
                if (selTime) navigate(`/s/book/${off.id}/time?day=${selDay}&time=${selTime}&where=${v}`, { replace: true, dir: 'none' });
              }}
              options={[
                { value: 'online', label: 'Online' },
                { value: 'in_person', label: 'In person' },
              ]}
            />
          </div>
        )}
        {first && last && (
          <section className="card" aria-labelledby="sched-h">
            <h2 id="sched-h" className="t-headline">
              Your schedule
            </h2>
            <div className="kv t-body">
              <span>First lesson</span>
              <span>
                {fmtDate(first)} · {fmtTime(first)}
              </span>
            </div>
            {isCourse && (
              <div className="kv t-body">
                <span>Last lesson</span>
                <span>
                  {fmtDate(last)} · {fmtTime(last)}
                </span>
              </div>
            )}
            {holidays.length > 0 && (
              <p className="t-subhead c-warning">
                {holidays.map(fmtMonthDay).join(' and ')} {holidays.length === 1 ? 'falls on a holiday' : 'fall on holidays'}. You can move {holidays.length === 1 ? 'that lesson' : 'those lessons'} after booking.
              </p>
            )}
          </section>
        )}
      </div>
    </Screen>
  );
}

export function S11ReviewPay({ params, query }: ScreenProps) {
  const { db, me } = useMe();
  const t = useNow(1000);
  const enr = useEnrolledRedirect(params.offeringId);
  const off = sel.offering(db, params.offeringId);
  const day = Number(query.get('day'));
  const time = query.get('time') ?? '';
  const where = (query.get('where') as 'online' | 'in_person') ?? 'online';
  const holdId = query.get('hold');
  const hold = holdId ? db.bookings.find((b) => b.id === holdId) : undefined;
  const slot = off ? sel.slotsFor(db, off, t, me.id).find((s) => s.weekday === day && s.time === time) : undefined;
  const [paying, setPaying] = useState(false);
  const [sheet, setSheet] = useState<null | 'apple_pay_sim' | 'card_sim'>(null);
  const [declined, setDeclined] = useState(false);
  const [guardian, setGuardian] = useState(() => sel.isMinor(me, now()));
  const [studentPicker, setStudentPicker] = useState(false);
  const offline = db.dev.offline;

  // Direct routes without a valid slot go back to S08; an expired hold goes to S10 with a message.
  useEffect(() => {
    if (enr) return;
    if (!off || !slot) navigate(`/s/course/${params.offeringId}`, { replace: true });
  }, [off, slot, enr, params.offeringId]);
  useEffect(() => {
    if (hold && hold.status === 'expired') {
      setSheet(null);
      navigate(`/s/book/${params.offeringId}/time?day=${day}&where=${where}&expired=1`, { replace: true, dir: 'back' });
    }
  }, [hold, params.offeringId, day, where]);
  if (!off || enr || !slot) return null;

  const teacher = sel.user(db, off.teacherId)!;
  const first = hold?.status === 'held' ? hold.startDate : nextOccurrence(t, day, time);
  const last = addDays(first, 7 * (off.lessonCount - 1));
  const totals = studentTotal(off.pricePerLessonCents, off.lessonCount);
  const holdActive = hold?.status === 'held' && hold.holdExpiresAt > t;
  const remaining = holdActive ? Math.max(0, hold!.holdExpiresAt - t) : 0;
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const tFirst = sel.firstName(teacher.name);

  const pay = async (method: 'apple_pay_sim' | 'card_sim') => {
    if (holdActive) {
      setSheet(method);
      return;
    }
    setPaying(true);
    const r = await holdSlot({ studentUserId: me.id, offeringId: off.id, weekday: day, time, format: where });
    setPaying(false);
    if (!r.ok) {
      if (r.code === 'slot_taken') navigate(`/s/book/${off.id}/time?day=${day}&where=${where}&taken=${encodeURIComponent(r.message)}`, { replace: true, dir: 'back' });
      else toast(r.message, { icon: 'warning' });
      return;
    }
    navigate(`/s/book/${off.id}/review?day=${day}&time=${time}&where=${where}&hold=${r.value}`, { replace: true, dir: 'none' });
    setDeclined(false);
    setSheet(method);
  };

  const payDisabled = guardian || offline;
  return (
    <Screen
      title="Review"
      navTitle
      back
      bottom={
        <>
          <Button onClick={() => pay('apple_pay_sim')} loading={paying} disabled={payDisabled} describedBy="pay-note" label={`Buy with Apple Pay, total ${fmt(totals.total)}`} icon={undefined}>
            Buy with <Icon name="apple.logo" size={20} /> Pay
          </Button>
          <Button variant="plain" onClick={() => pay('card_sim')} disabled={payDisabled} describedBy="pay-note">
            {declined ? 'Use a different card' : 'Pay with card'}
          </Button>
          <p id="pay-note" className="bottombar__note">
            {guardian
              ? 'Guardian approval is not in the prototype. Change the student to an adult to pay.'
              : offline
                ? 'You are offline. Payment needs a connection; nothing was charged.'
                : `You are charged ${fmt(totals.total)} now. ${tFirst} is notified immediately and your lessons appear in Learning.`}
          </p>
        </>
      }
    >
      <div className="stack">
        {declined && (
          <InlineAlert tone="danger" title="Your card was declined">
            You were not charged. Your {WEEKDAYS[day]} {fmtHM(time)} time is held for {Math.max(1, Math.ceil(remaining / 60000))} more minutes.
          </InlineAlert>
        )}
        {holdActive && !declined && (
          <InlineAlert tone="info" title={`Held for ${mins}:${String(secs).padStart(2, '0')}`}>
            This time is held for you while you pay. If the hold ends, you pick a time again.
          </InlineAlert>
        )}
        <section className="stack-6" aria-labelledby="booking-h">
          <h2 id="booking-h" className="section-label">
            Booking
          </h2>
          <div className="group">
            <ListRow title={off.title} subtitle={`with ${teacher.name} · ${off.lessonCount} one-on-one lesson${off.lessonCount === 1 ? '' : 's'}`} />
            <ListRow
              title={off.lessonCount > 1 ? `${WEEKDAYS[day]}s at ${fmtHM(time)}` : `${fmtDate(first)} at ${fmtHM(time)}`}
              subtitle={`${off.lessonCount > 1 ? `${fmtMonthDay(first)} to ${fmtMonthDay(last)}` : fmtRange(first, off.lessonMinutes)} · ${where === 'online' ? 'Online' : 'In person'}`}
              value="Change"
              chevron
              onClick={() => {
                if (holdActive) cancelHold(hold!.id);
                routerBack(`/s/book/${off.id}/time`);
              }}
            />
            <ListRow title="Student" subtitle={guardian ? 'Maya (under 18)' : `${me.name} (you)`} value="Change" chevron onClick={() => setStudentPicker(true)} />
          </div>
          <p className="helper">Booking for someone under 18? Choose them as the student and a parent or guardian account confirms the booking.</p>
        </section>
        {guardian && (
          <InlineAlert tone="info" title="Maya gets a linked student profile">
            You pay and approve bookings. Messages between Maya and {tFirst} are visible to you. {tFirst} has a completed background check, required for students under 18.
          </InlineAlert>
        )}
        <section className="card" aria-label="Payment summary">
          <div className="kv t-body">
            <span>
              {off.lessonCount} lesson{off.lessonCount === 1 ? '' : 's'} × {fmt(off.pricePerLessonCents)}
            </span>
            <span className="tabular">{fmt(totals.subtotal)}</span>
          </div>
          <div className="kv t-body">
            <span>Service fee</span>
            <span className="tabular">{fmt(totals.serviceFee)}</span>
          </div>
          <div className="kv t-body">
            <span>Tax</span>
            <span className="tabular">{fmt(totals.tax)}</span>
          </div>
          <hr style={{ border: 0, borderTop: '1px solid var(--border-default)', margin: '4px 0' }} />
          <div className="kv t-body semibold" aria-label={`Total, ${fmt(totals.total)}`} style={{ fontSize: '1.06rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Total</span>
            <span className="tabular">{fmt(totals.total)}</span>
          </div>
          <p className="t-footnote c-secondary">Charged today. Free cancellation until 24 hours before lesson 1; after that, untaught lessons are refunded.</p>
        </section>
      </div>
      <Sheet open={studentPicker} title="Who are the lessons for?" onCancel={() => setStudentPicker(false)}>
        <div className="group" role="radiogroup" aria-label="Student">
          {[
            { v: false, title: `${me.name} (you)`, sub: 'Adult student' },
            { v: true, title: 'Maya (under 18)', sub: 'A parent or guardian approves and pays' },
          ].map((o) => (
            <button
              key={o.title}
              type="button"
              role="radio"
              aria-checked={guardian === o.v}
              className="row"
              onClick={() => {
                setGuardian(o.v);
                setStudentPicker(false);
              }}
            >
              <span className="row__text">
                <span className="row__title">{o.title}</span>
                <span className="row__subtitle">{o.sub}</span>
              </span>
              {guardian === o.v && <Icon name="checkmark" size={20} />}
            </button>
          ))}
        </div>
      </Sheet>
      {sheet && hold && (
        <PaymentSheet
          method={sheet}
          total={totals.total}
          email={me.email}
          bookingId={hold.id}
          onCancel={() => {
            cancelHold(hold.id);
            setSheet(null);
            navigate(`/s/book/${off.id}/review?day=${day}&time=${time}&where=${where}`, { replace: true, dir: 'none' });
          }}
          onDeclined={() => {
            setSheet(null);
            setDeclined(true);
          }}
          onExpired={() => setSheet(null)}
          onSuccess={(enrollmentId) => navigate(`/s/booked/${enrollmentId}`, { replace: true })}
        />
      )}
    </Screen>
  );
}

/** S12: Apple Pay cannot run in a web prototype; a custom bottom sheet labeled "Simulated payment". */
function PaymentSheet({ method, total, email, bookingId, onCancel, onDeclined, onSuccess, onExpired }: { method: 'apple_pay_sim' | 'card_sim'; total: number; email: string; bookingId: string; onCancel: () => void; onDeclined: () => void; onSuccess: (id: string) => void; onExpired: () => void }) {
  const [phase, setPhase] = useState<'ready' | 'processing' | 'done'>('ready');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    window.setTimeout(() => ref.current?.querySelector<HTMLElement>('button')?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase === 'ready') onCancel();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [phase, onCancel]);
  const confirm = async () => {
    setPhase('processing');
    const r = await confirmPayment(bookingId, method);
    if (!r.ok) {
      if (r.code === 'declined') onDeclined();
      else {
        toast(r.message, { icon: 'warning' });
        if (r.code === 'hold_expired') onExpired();
        else setPhase('ready');
      }
      return;
    }
    setPhase('done');
    await wait(500);
    onSuccess(r.value);
  };
  const card = method === 'apple_pay_sim' ? 'Visa ending 4417' : 'Card ending 4242 (simulated)';
  return createPortal(
    <div className="overlay">
      <div className="scrim" onClick={() => phase === 'ready' && onCancel()} />
      <div ref={ref} className="sheet sheet--white" role="dialog" aria-modal="true" aria-label="Simulated payment" style={{ padding: '18px 16px max(28px, env(safe-area-inset-bottom))', gap: 0 }}>
        <div className="spread" style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-default)' }}>
          <span className="hstack" style={{ gap: 4, fontWeight: 600, fontSize: '1.3rem' }}>
            {method === 'apple_pay_sim' ? (
              <>
                <Icon name="apple.logo" size={26} /> Pay
              </>
            ) : (
              'Card payment'
            )}
          </span>
          <button type="button" className="glass-btn" style={{ background: 'var(--bg-fill)', width: 34, height: 34 }} aria-label="Cancel payment" onClick={() => phase === 'ready' && onCancel()}>
            <Icon name="xmark" size={16} />
          </button>
        </div>
        {[
          ['Card', card],
          ['Contact', email],
        ].map(([k, v]) => (
          <div key={k} className="spread" style={{ padding: '14px 0', borderBottom: '1px solid var(--border-default)' }}>
            <span className="t-subhead c-secondary" style={{ textTransform: 'uppercase' }}>
              {k}
            </span>
            <span className="t-body">{v}</span>
          </div>
        ))}
        <div className="spread" style={{ padding: '14px 0 18px' }}>
          <span className="t-subhead c-secondary" style={{ textTransform: 'uppercase' }}>
            Pay Scale by Underground
          </span>
          <span className="t-headline" style={{ fontSize: '1.2rem' }}>
            {fmt(total)}
          </span>
        </div>
        <div className="stack-8" style={{ alignItems: 'center' }} aria-live="polite">
          {phase === 'ready' && (
            <Button onClick={confirm} label={`Confirm payment of ${fmt(total)}, simulated`}>
              Confirm with Side Button
            </Button>
          )}
          {phase === 'processing' && (
            <div className="hstack" style={{ minHeight: 50 }} role="status">
              <span className="spinner" /> Processing
            </div>
          )}
          {phase === 'done' && (
            <div className="hstack c-success semibold" style={{ minHeight: 50 }} role="status">
              <Icon name="checkmark.circle.fill" size={30} /> Done
            </div>
          )}
          <p className="t-footnote c-secondary">Simulated payment · nothing is charged</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function S13Booked({ params }: ScreenProps) {
  const { db, me } = useMe();
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setChecking(false), 700);
    return () => window.clearTimeout(id);
  }, []);
  const enr = sel.enrollment(db, params.enrollmentId);
  useEffect(() => {
    if (!enr || enr.studentUserId !== me.id) navigate('/s/home', { replace: true });
  }, [enr, me.id]);
  if (!enr) return null;
  const off = sel.offering(db, enr.offeringId)!;
  const teacher = sel.user(db, enr.teacherId)!;
  const first = sel.lessonsOf(db, enr.id)[0];
  const pay = db.payments.find((p) => p.bookingId === enr.bookingId && p.status !== 'failed');
  const tFirst = sel.firstName(teacher.name);
  const dayName = WEEKDAYS[enr.weekday];
  if (checking)
    return (
      <Screen title="Checking your booking" noNav>
        <div className="empty" style={{ paddingTop: 200 }} role="status">
          <span className="spinner" />
          <h1 className="t-title3">Checking your booking</h1>
        </div>
      </Screen>
    );
  return (
    <Screen
      title="You're booked"
      noNav
      bottom={
        <div className="bottombar__row">
          <Button variant="gray" onClick={() => navigate(`/messages/${getOrCreateThread(me.id, teacher.id)}`)}>
            Message {tFirst}
          </Button>
          <Button onClick={() => navigate(`/s/learning/${enr.id}`, { replace: true })}>Go to Learning</Button>
        </div>
      }
    >
      <div className="stack" style={{ paddingTop: 60 }}>
        <div className="stack-12 center">
          <span className="check-circle" style={{ width: 54, height: 54 }} aria-hidden="true">
            <Icon name="checkmark" size={30} />
          </span>
          <h1 className="t-title1" role="alert">
            You're booked
          </h1>
          <p className="t-body c-secondary" style={{ fontSize: '1.06rem' }}>
            {tFirst} has your enrollment and will see you {dayName}.
          </p>
        </div>
        <div className="group">
          <ListRow
            title={`Lesson 1 · ${fmtDate(first.scheduledAt)}`}
            subtitle={`${fmtRange(first.scheduledAt, first.durationMin)} · ${enr.format === 'online' ? 'Online · link opens 10 min before' : 'In person'}`}
            value="Add"
            chevron
            onClick={() => toast('Add to calendar is not in the prototype.', { icon: 'info' })}
          />
          <ListRow title="Receipt" subtitle={`${fmt(pay?.amountCents ?? 0)} · ${pay?.method === 'card_sim' ? 'Card' : 'Apple Pay'}`} value="View" chevron onClick={() => toast('Receipts are not in the prototype.', { icon: 'info' })} />
        </div>
        <section className="card" aria-labelledby="prep-h">
          <h2 id="prep-h" className="t-headline">
            Before {dayName}
          </h2>
          <p className="t-body c-secondary">Have your {off.instrument.toLowerCase().replace('acoustic ', '')} nearby and download any free tuner app. {tFirst} may send a short welcome message.</p>
        </section>
      </div>
    </Screen>
  );
}

const REASONS = ['Schedule no longer works', 'Not the right fit', 'Something else'];

export function S14CancelCourse({ params }: ScreenProps) {
  const { db, me } = useMe();
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const enr = sel.enrollment(db, params.enrollmentId);
  useEffect(() => {
    if (!enr || enr.studentUserId !== me.id || enr.status !== 'active') navigate(enr ? `/s/learning/${enr.id}` : '/s/learning', { replace: true });
  }, [enr, me.id]);
  if (!enr || enr.status !== 'active') return null;
  const off = sel.offering(db, enr.offeringId)!;
  const teacher = sel.user(db, enr.teacherId);
  const p = refundPreview(db, enr.id, 'student');
  const n = p.refundable.length;
  const pay = db.payments.find((x) => x.bookingId === enr.bookingId && x.status !== 'failed');
  const within = p.nextLesson && p.refundable[0]?.id !== p.nextLesson.id;
  const confirm = async () => {
    setLoading(true);
    const r = await cancelCourse(enr.id, 'student', reason ?? undefined);
    setLoading(false);
    if (!r.ok) {
      toast(r.message, { icon: 'warning' });
      return;
    }
    navigate(`/s/learning/${enr.id}`, { replace: true, dir: 'back' });
    toast(`Course cancelled. ${fmt(r.value)} is on its way back to you.`, { icon: 'check', duration: 5000 });
  };
  return (
    <Screen
      title="Cancel course"
      navTitle
      ownHeading
      back
      bottom={
        <>
          <Button variant="destructive" onClick={confirm} loading={loading}>
            Cancel course and refund {fmt(p.refundCents)}
          </Button>
          <Button variant="plain" onClick={goBack}>
            Keep my lessons
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="title-block">
          <h1 className="t-title1">Cancel your remaining lessons?</h1>
          <p className="t-body c-secondary">
            {p.nextLesson
              ? within
                ? `Your lesson on ${fmtDate(p.nextLesson.scheduledAt)} starts within 24 hours, so it is not refunded. Every later untaught lesson is.`
                : `Your lesson on ${fmtDate(p.nextLesson.scheduledAt)} is more than 24 hours away, so every untaught lesson is refunded.`
              : 'Every lesson has been taught.'}
          </p>
        </div>
        <section className="card" aria-labelledby="refund-h">
          <h2 id="refund-h" className="t-headline">
            {off.title}
          </h2>
          <div className="kv t-body">
            <span>Lessons taught</span>
            <span>
              {p.taught} of {p.total}
            </span>
          </div>
          <div className="kv t-body">
            <span>
              Refund for {n} lesson{n === 1 ? '' : 's'}
            </span>
            <span className="semibold">{fmt(p.refundCents)}</span>
          </div>
          <p className="t-footnote c-secondary">Back to {pay?.method === 'card_sim' ? 'your card (ending 4242)' : 'Apple Pay (Visa ending 4417)'} in 3 to 5 business days.</p>
        </section>
        <section className="stack-6">
          <h2 className="section-label" id="reason-h">
            Reason · Optional
          </h2>
          <div className="group" role="radiogroup" aria-labelledby="reason-h">
            {REASONS.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={reason === r} className="row row--single" onClick={() => setReason(reason === r ? null : r)}>
                <span className="row__text">
                  <span className="row__title">{r}</span>
                </span>
                {reason === r && <Icon name="checkmark" size={20} />}
              </button>
            ))}
          </div>
          <p className="helper">Shared with Scale, not with {sel.firstName(teacher?.name ?? 'your teacher')}.</p>
        </section>
      </div>
    </Screen>
  );
}

