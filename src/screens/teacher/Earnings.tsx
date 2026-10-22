// Flow 08: T19 Earnings (+ Empty), T20 Booking Earnings (+ Refunded), T21 Payouts (+ Payout Failed).
import { Screen } from '../../layout/layout';
import { Button, EmptyState, Group, InlineAlert, ListRow, TransactionRow } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { share, useMe, type ScreenProps } from '../../app/hooks';
import { navigate } from '../../router/hashRouter';
import * as sel from '../../data/selectors';
import { fmtDate, fmtMonthDay, nextMonday, now } from '../../data/clock';
import { fmt, FEE_RATE } from '../../data/money';
import { notInPrototype, toast } from '../../data/ui';
import type { DB, Transaction } from '../../data/schema';

interface Run {
  state: Transaction['state'];
  from: number;
  to: number;
  amount: number;
  each: number;
  txns: Transaction[];
}

/** Consecutive lessons of one enrollment that share a state, as the designs group them. */
function runsOf(db: DB, enrollmentId: string, byAmount = false): Run[] {
  const txns = db.transactions
    .filter((t) => t.enrollmentId === enrollmentId)
    .map((t) => ({ t, l: sel.lesson(db, t.lessonId)! }))
    .sort((a, b) => a.l.index - b.l.index);
  const runs: Run[] = [];
  for (const { t, l } of txns) {
    const last = runs[runs.length - 1];
    if (last && last.state === t.state && last.to === l.index - 1 && (!byAmount || last.each === t.netCents)) {
      last.to = l.index;
      last.amount += t.netCents;
      last.txns.push(t);
    } else runs.push({ state: t.state, from: l.index, to: l.index, amount: t.netCents, each: t.netCents, txns: [t] });
  }
  return runs;
}

const lessonsLabel = (r: Run) => (r.from === r.to ? `Lesson ${r.from}` : `Lessons ${r.from} to ${r.to}`);

function runSubtitle(db: DB, r: Run): string {
  const l = sel.lesson(db, r.txns[r.txns.length - 1].lessonId)!;
  if (r.state === 'available') return `${lessonsLabel(r)} completed ${fmtMonthDay(l.taughtAt ?? l.scheduledAt)}`;
  if (r.state === 'pending') return `${lessonsLabel(r)} · released as completed`;
  if (r.state === 'refunded') return `${lessonsLabel(r)} · refunded to the student`;
  const po = db.payouts.find((p) => p.id === r.txns[0].payoutId);
  return `${lessonsLabel(r)} · paid out ${po ? fmtMonthDay(po.scheduledFor) : ''}`;
}

export function T19Earnings() {
  const { db, me } = useMe();
  const b = sel.balances(db, me.id);
  const tp = sel.teacherProfile(db, me.id);
  const t = now();
  const enrs = db.enrollments.filter((e) => e.teacherId === me.id && db.transactions.some((x) => x.enrollmentId === e.id)).sort((a, c) => c.startedAt - a.startedAt);
  const published = sel.publishedOfferings(db, me.id)[0];
  const rows = enrs.flatMap((e) => runsOf(db, e.id).map((r) => ({ e, r }))).sort((a, c) => ({ available: 0, pending: 1, refunded: 2, paid_out: 3 })[a.r.state] - ({ available: 0, pending: 1, refunded: 2, paid_out: 3 })[c.r.state] || c.e.startedAt - a.e.startedAt);
  return (
    <Screen title="Earnings" noNav>
      <div className="stack">
        <h1 className="t-large-title" style={{ paddingTop: 8 }}>
          Earnings
        </h1>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <section className="card" aria-label={`Available, ${fmt(b.available)}`}>
            <p className="t-headline c-success">Available</p>
            <p className="t-title1 tabular" style={{ fontSize: '1.75rem' }}>
              {fmt(b.available)}
            </p>
            <p className="t-subhead c-secondary">{b.available ? `Next payout ${fmtDate(nextMonday(t))}` : 'Nothing to pay out'}</p>
          </section>
          <section className="card" aria-label={`Pending, ${fmt(b.pending)}`}>
            <p className="t-headline c-warning">Pending</p>
            <p className="t-title1 tabular" style={{ fontSize: '1.75rem' }}>
              {fmt(b.pending)}
            </p>
            <p className="t-subhead c-secondary">{b.pendingCount ? `${b.pendingCount} untaught lesson${b.pendingCount === 1 ? '' : 's'}` : 'No lessons booked'}</p>
          </section>
        </div>
        {!rows.length ? (
          <EmptyState
            icon="dollarsign.circle"
            title="No earnings yet"
            message="When a student books, their payment shows here as pending. It becomes available as you teach each lesson."
            action={
              <Button variant="gray-elevated" onClick={() => (published ? share(published.title, `/s/course/${published.id}`, () => toast('Link copied', { icon: 'check' })) : navigate('/t/offerings'))}>
                Share your course
              </Button>
            }
          />
        ) : (
          <section className="stack-6">
            <h2 className="section-label">Activity</h2>
            <div className="group">
              {rows.slice(0, 12).map(({ e, r }) => (
                <TransactionRow
                  key={`${e.id}-${r.from}`}
                  title={`${sel.user(db, e.studentUserId)?.name ?? 'Deleted student'} · ${sel.offering(db, e.offeringId)?.title}`}
                  subtitle={runSubtitle(db, r)}
                  amount={fmt(r.state === 'refunded' ? r.txns.reduce((s, x) => s + x.grossCents, 0) : r.amount)}
                  state={r.state}
                  onClick={() => navigate(`/t/earnings/booking/${e.id}`)}
                />
              ))}
            </div>
          </section>
        )}
        <Group label="Payouts" labelId="po-h">
          <ListRow
            title="Bank account"
            subtitle={tp?.bankAccount ? `${tp.bankAccount.label.replace(' checking', '')} ending ${tp.bankAccount.last4}${tp.bankAccount.closed ? ' · closed' : ''} · weekly on Mondays` : 'Add a bank account to get paid'}
            value="Change"
            chevron
            label={tp?.bankAccount ? `Bank account ending in ${tp.bankAccount.last4}, paid weekly on Mondays. Opens payouts` : 'Bank account, add'}
            onClick={() => navigate('/t/payouts')}
          />
        </Group>
        <section className="card">
          <p className="hstack t-headline" style={{ fontSize: '1.06rem' }}>
            <span className="c-info">
              <Icon name="info.circle.fill" size={20} />
            </span>
            How your money moves
          </p>
          <p className="t-body c-secondary">Booked: the student paid. Pending: lessons not yet taught. Available: taught and ready to send. Paid out: sent to your bank every Monday.</p>
        </section>
      </div>
    </Screen>
  );
}

export function T20BookingEarnings({ params }: ScreenProps) {
  const { db, me } = useMe();
  const enr = sel.enrollment(db, params.enrollmentId);
  if (!enr || enr.teacherId !== me.id)
    return (
      <Screen title="Booking earnings" navTitle back>
        <EmptyState icon="dollarsign.circle" title="That page is not available" message="No earnings exist for this booking." />
      </Screen>
    );
  const off = sel.offering(db, enr.offeringId)!;
  const student = sel.user(db, enr.studentUserId);
  const sname = student?.name ?? 'Deleted student';
  const pay = db.payments.find((p) => p.bookingId === enr.bookingId && p.status !== 'failed');
  const txns = db.transactions.filter((x) => x.enrollmentId === enr.id);
  const kept = txns.filter((x) => x.state !== 'refunded');
  const refunded = txns.filter((x) => x.state === 'refunded');
  const gross = pay?.amountCents ?? txns.reduce((s, x) => s + x.grossCents, 0);
  const keptFee = kept.reduce((s, x) => s + x.feeCents, 0);
  const keptNet = kept.reduce((s, x) => s + x.netCents, 0);
  const refundCents = refunded.reduce((s, x) => s + x.grossCents, 0);
  const lostNet = refunded.reduce((s, x) => s + x.netCents, 0);
  const runs = runsOf(db, enr.id, true);
  const first = sel.firstName(sname);
  return (
    <Screen title="Booking earnings" navTitle back>
      <div className="stack">
        <button type="button" className="card card--tap" onClick={() => student && navigate(`/t/students/${student.id}`)} aria-label={`${sname}, ${off.title}. Opens student`}>
          <span className="section-label" style={{ margin: 0 }}>
            {off.title}
          </span>
          <span className="t-title1" style={{ fontSize: '1.5rem' }}>
            {sname}
          </span>
          <span className="t-body c-secondary">
            Paid {pay?.paidAt ? fmtMonthDay(pay.paidAt) : ''} with {pay?.method === 'card_sim' ? 'card' : 'Apple Pay'} · {off.lessonCount} one-on-one lesson{off.lessonCount === 1 ? '' : 's'}
          </span>
        </button>
        {refunded.length > 0 && (
          <InlineAlert tone="warning" title={`Refund issued ${enr.cancelledAt ? fmtMonthDay(enr.cancelledAt) : ''}`}>
            {enr.cancelledBy === 'teacher' ? `You cancelled ${first}'s` : `${first} cancelled the`} {refunded.length} untaught lesson{refunded.length === 1 ? '' : 's'}. {first} got {fmt(refundCents)} back. {fmt(lostNet)} was removed from your pending balance; the {fmt(keptNet)} you earned stays yours.
          </InlineAlert>
        )}
        <Group label="Money" labelId="money-h">
          <ListRow title="Student paid" subtitle="Charged once at booking" value={fmt(gross)} />
          <ListRow title={`Marketplace fee (${Math.round(FEE_RATE * 100)}%)`} subtitle="Covers payments, support and refunds" value={`−${fmt(keptFee)}`} />
          {refunded.length > 0 && <ListRow title="Refunded to student" subtitle={`${refunded.length} lesson${refunded.length === 1 ? '' : 's'} at ${fmt(off.pricePerLessonCents)}`} value={`−${fmt(refundCents)}`} />}
          <ListRow title="Your share" subtitle="Released lesson by lesson" value={<span style={{ color: 'var(--text-primary)' }}>{fmt(keptNet)}</span>} />
        </Group>
        <section className="stack-6">
          <Group label="Release schedule" labelId="rel-h">
            {runs.map((r) => {
              const lastL = sel.lesson(db, r.txns[r.txns.length - 1].lessonId)!;
              const sub =
                r.state === 'pending'
                  ? 'Pending until each is marked complete'
                  : r.state === 'available'
                    ? `Taught ${r.from === r.to ? fmtMonthDay(lastL.taughtAt ?? lastL.scheduledAt) : ''} · available`.replace('  ', ' ')
                    : r.state === 'paid_out'
                      ? 'Paid out'
                      : 'Refunded to the student';
              const multiSame = r.to > r.from && r.txns.every((x) => x.netCents === r.each);
              return (
                <ListRow
                  key={r.from}
                  title={lessonsLabel(r)}
                  subtitle={sub}
                  value={<span className={r.state === 'refunded' ? 'strike' : undefined}>{multiSame ? `${fmt(r.each)} each` : fmt(r.amount)}</span>}
                  label={`${lessonsLabel(r)}, ${multiSame ? `${fmt(r.each)} each` : fmt(r.amount)}, ${r.state.replace('_', ' ')}`}
                />
              );
            })}
          </Group>
          <p className="helper">Money moves to Available as you mark each lesson complete. Available money is paid out every Monday.</p>
        </section>
      </div>
    </Screen>
  );
}

export function T21Payouts() {
  const { db, me } = useMe();
  const tp = sel.teacherProfile(db, me.id);
  const b = sel.balances(db, me.id);
  const t = now();
  const payouts = db.payouts.filter((p) => p.teacherId === me.id).sort((a, c) => c.scheduledFor - a.scheduledFor);
  const failed = payouts[0]?.status === 'failed' ? payouts[0] : undefined;
  const availTxns = b.txns.filter((x) => x.state === 'available');
  const nextLabel = availTxns.length
    ? availTxns.length === 1
      ? (() => {
          const l = sel.lesson(db, availTxns[0].lessonId);
          const e = sel.enrollment(db, availTxns[0].enrollmentId);
          return `Lesson ${l?.index} · ${sel.offering(db, e?.offeringId)?.title}`;
        })()
      : `${availTxns.length} lessons taught`
    : 'Nothing to pay out yet';
  return (
    <Screen title="Payouts" navTitle back>
      <div className="stack">
        {failed && (
          <InlineAlert tone="danger" title={`Payout of ${fmt(failed.amountCents)} failed on ${fmtDate(failed.scheduledFor)}`}>
            Your bank returned it because the account is closed. Add a new account and we retry within 1 business day. Your money is safe in Available.
          </InlineAlert>
        )}
        <Group label="Payout account" labelId="pa-h">
          <ListRow
            title="Bank account"
            subtitle={tp?.bankAccount ? `${tp.bankAccount.label} ending ${tp.bankAccount.last4}${tp.bankAccount.closed ? ' · closed' : ''}` : 'Not added'}
            value={tp?.bankAccount?.closed ? 'Update' : tp?.bankAccount ? 'Verified' : 'Add'}
            chevron
            label={tp?.bankAccount ? `Bank account ending in ${tp.bankAccount.last4}${tp.bankAccount.closed ? ', closed' : ', verified'}` : 'Bank account, not added'}
            onClick={() => notInPrototype('Editing bank details')}
          />
          <ListRow title="Schedule" subtitle="Available balance is sent every Monday" value="Weekly" chevron onClick={() => notInPrototype('Changing the payout schedule')} />
        </Group>
        <Group label="Next payout" labelId="np-h">
          {failed ? (
            <ListRow title="Retry after you update" subtitle="Nothing is lost while we wait" value={fmt(b.available)} />
          ) : (
            <ListRow title={b.available ? fmtDate(nextMonday(t)) : 'Nothing scheduled'} subtitle={nextLabel} value={fmt(b.available)} />
          )}
        </Group>
        <section className="stack-6">
          <Group label="Tax details" labelId="tax-h">
            <ListRow title="Taxpayer information" subtitle="Requested before your first payout" value="Submitted" chevron onClick={() => notInPrototype('Tax forms')} />
          </Group>
          <p className="helper">Scale reports payouts as required in the US.</p>
        </section>
        <Group label="History" labelId="hist-h">
          {payouts.length ? (
            payouts.map((p) => (
              <ListRow
                key={p.id}
                title={fmtDate(p.scheduledFor)}
                subtitle={`${p.status === 'failed' ? 'Failed · returned to Available' : 'Paid'} · ${p.transactionIds.length} lesson${p.transactionIds.length === 1 ? '' : 's'}`}
                value={<span className={p.status === 'failed' ? 'c-danger' : undefined}>{fmt(p.amountCents)}</span>}
              />
            ))
          ) : (
            <ListRow title="No payouts yet" subtitle="Your first payout shows here" />
          )}
        </Group>
      </div>
    </Screen>
  );
}
