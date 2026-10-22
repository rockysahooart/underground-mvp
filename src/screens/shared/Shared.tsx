// Shared screens for both roles: A05 Notifications, A06 Messages, A07 Account, A08 Delete Account.
import { useEffect, useRef, useState } from 'react';
import { ActionSheet, Alert, GlassButton, GlassText, Screen } from '../../layout/layout';
import { Avatar, Button, EmptyState, Group, InlineAlert, ListRow } from '../../components/ui';
import { ReportSheet } from '../../components/ReportSheet';
import { Icon } from '../../components/Icon';
import { useMe, type ScreenProps } from '../../app/hooks';
import { navigate } from '../../router/hashRouter';
import * as sel from '../../data/selectors';
import { fmtDateTime, fmtMonthDay, fmtTime, now, relativeAgo, startOfDay } from '../../data/clock';
import { fmt } from '../../data/money';
import { notInPrototype, toast } from '../../data/ui';
import { acceptReschedule, chooseRole, deleteAccount, getOrCreateThread, markNotificationRead, refundPreview, retryMessage, saveDraft, sendMessage, signOut, switchRole } from '../../services';
import { ROLE_ROOT, TEACHER_STEPS } from '../../router/routes';
import type { Notification, Role } from '../../data/schema';

const ICON: Record<string, { icon: string; tone: string }> = {
  reschedule: { icon: 'arrow.triangle.2.circlepath', tone: 'icon-circle--warning' },
  reschedule_accepted: { icon: 'arrow.triangle.2.circlepath', tone: 'icon-circle--success' },
  progress: { icon: 'checkmark.seal.fill', tone: 'icon-circle--success' },
  booked: { icon: 'checkmark.seal.fill', tone: '' },
  new_booking: { icon: 'checkmark.seal.fill', tone: '' },
  message: { icon: 'bubble.left', tone: 'icon-circle--info' },
  cancelled: { icon: 'exclamationmark.triangle.fill', tone: 'icon-circle--warning' },
  completed: { icon: 'checkmark.seal.fill', tone: 'icon-circle--success' },
  payout: { icon: 'dollarsign.circle', tone: 'icon-circle--success' },
  payout_failed: { icon: 'exclamationmark.triangle.fill', tone: 'icon-circle--warning' },
  open_time: { icon: 'calendar', tone: 'icon-circle--info' },
  review: { icon: 'star.fill', tone: '' },
  id_passed: { icon: 'checkmark.seal.fill', tone: 'icon-circle--success' },
};

export default function SharedScreens({ screen, ...p }: ScreenProps & { screen: string }) {
  if (screen === 'A05') return <A05Notifications {...p} />;
  if (screen === 'A06') return <A06Messages {...p} />;
  if (screen === 'A07') return <A07Account {...p} />;
  if (screen === 'A08') return <A08DeleteAccount {...p} />;
  return null;
}

function A05Notifications(_: ScreenProps) {
  const { db, me, role } = useMe();
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const list = sel.notificationsFor(db, me.id, role);
  const today = startOfDay(now());
  const groups = [
    { label: 'Today', items: list.filter((n) => n.createdAt >= today) },
    { label: 'Earlier', items: list.filter((n) => n.createdAt < today) },
  ].filter((g) => g.items.length);

  const open = (n: Notification) => {
    markNotificationRead(n.id);
    navigate(n.targetRoute);
  };
  const accept = (n: Notification) => {
    markNotificationRead(n.id);
    setAccepted((a) => ({ ...a, [n.id]: true }));
    const timer = window.setTimeout(() => acceptReschedule(n.lessonId!), 5000);
    toast('New time accepted', {
      icon: 'check',
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          window.clearTimeout(timer);
          setAccepted((a) => ({ ...a, [n.id]: false }));
        },
      },
    });
  };
  return (
    <Screen title="Notifications" navTitle back trailing={<GlassText onClick={() => notInPrototype('Notification settings')}>Settings</GlassText>}>
      <div className="stack">
        {!groups.length && <EmptyState icon="bell" title="No notifications yet" message="Bookings, lesson notes, reschedule requests and messages show up here." />}
        {groups.map((g) => (
          <section key={g.label} className="stack-6" aria-labelledby={`ng-${g.label}`}>
            <h2 id={`ng-${g.label}`} className="section-label">
              {g.label}
            </h2>
            <ul className="group">
              {g.items.map((n) => {
                const meta = ICON[n.type] ?? { icon: 'bell', tone: 'icon-circle--info' };
                const lesson = n.lessonId ? sel.lesson(db, n.lessonId) : undefined;
                const pendingReq = n.type === 'reschedule' && lesson?.rescheduleRequest?.status === 'pending' && lesson.rescheduleRequest.expiresAt > now();
                const unread = !n.readAt;
                return (
                  <li key={n.id} className="row" style={{ alignItems: 'flex-start', padding: '14px 16px' }}>
                    <span className={`icon-circle ${meta.tone}`} aria-hidden="true">
                      <Icon name={meta.icon} size={20} />
                    </span>
                    <div className="row__text" style={{ gap: 4 }}>
                      <button type="button" style={{ textAlign: 'left' }} onClick={() => open(n)} aria-label={`${unread ? 'Unread. ' : ''}${n.title}. ${n.body}`}>
                        <span className="spread" style={{ alignItems: 'baseline' }}>
                          <span className="row__title" style={{ fontWeight: unread ? 600 : 400 }}>
                            {n.title}
                          </span>
                          <span className="t-footnote c-secondary" style={{ flex: 'none' }}>
                            {relativeAgo(n.createdAt)}
                          </span>
                        </span>
                        <span className="row__subtitle" style={{ display: 'block', marginTop: 2 }}>
                          {n.body}
                        </span>
                      </button>
                      {pendingReq &&
                        (accepted[n.id] ? (
                          <p className="t-subhead c-success">Accepted · moving the lesson</p>
                        ) : (
                          <div className="hstack" style={{ marginTop: 6 }}>
                            <Button small auto onClick={() => accept(n)}>
                              Accept
                            </Button>
                            <Button
                              small
                              auto
                              variant="gray"
                              onClick={() => {
                                markNotificationRead(n.id);
                                const enr = lesson && sel.enrollment(db, lesson.enrollmentId);
                                if (enr) navigate(`/messages/${getOrCreateThread(enr.studentUserId, enr.teacherId)}`);
                              }}
                            >
                              Other times
                            </Button>
                          </div>
                        ))}
                    </div>
                    {unread && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--text-primary)', marginTop: 8, flex: 'none' }} />}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        <p className="helper">Notifications follow the role you are using. Switch roles in Account to see the other set.</p>
      </div>
    </Screen>
  );
}

function A06Messages({ params }: ScreenProps) {
  const { db, me, role } = useMe();
  const th = db.threads.find((t) => t.id === params.threadId);
  const allowed = !!th && (th.studentUserId === me.id || th.teacherId === me.id);
  const draftKey = `msg:${params.threadId}:${me.id}`;
  const [text, setText] = useState<string>((db.drafts[draftKey] as string) ?? '');
  const [report, setReport] = useState(false);
  const [more, setMore] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!allowed) {
      toast('That page is not available', { icon: 'info' });
      navigate(ROLE_ROOT[role], { replace: true });
    }
  }, [allowed, role]);
  const msgs = db.messages.filter((m) => m.threadId === params.threadId).sort((a, b) => a.sentAt - b.sentAt);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs.length]);
  useEffect(() => {
    const id = window.setTimeout(() => saveDraft(draftKey, text), 400);
    return () => window.clearTimeout(id);
  }, [text, draftKey]);
  if (!allowed || !th) return null;
  const iAmStudent = th.studentUserId === me.id;
  const otherId = iAmStudent ? th.teacherId : th.studentUserId;
  const other = sel.user(db, otherId);
  const otherName = other?.name ?? (iAmStudent ? 'Deleted teacher' : 'Deleted student');
  const enr = th.enrollmentId ? sel.enrollment(db, th.enrollmentId) : undefined;
  const off = enr ? sel.offering(db, enr.offeringId) : undefined;
  const next = enr ? sel.nextLessonOf(db, enr.id) : undefined;
  const send = async () => {
    const body = text;
    if (!body.trim()) return;
    setText('');
    saveDraft(draftKey, '');
    const r = await sendMessage(th.id, me.id, body);
    if (!r.ok && r.code === 'offline') toast('Not sent. You are offline; tap the message to retry.', { icon: 'warning' });
  };
  return (
    <Screen title={otherName} navTitle back trailing={<GlassButton icon="ellipsis" label="More" onClick={() => setMore(true)} />} bottom={undefined}>
      <div className="stack-12" style={{ paddingBottom: 90 }}>
        {off && (
          <button
            type="button"
            className="card card--tap hstack"
            style={{ flexDirection: 'row', background: 'var(--bg-fill-strong)', padding: '12px 16px', gap: 12 }}
            onClick={() => (iAmStudent ? navigate(`/s/course/${off.id}`) : next ? navigate(`/t/lesson/${next.id}`) : navigate(`/t/students/${th.studentUserId}`))}
          >
            <Icon name="calendar" size={22} />
            <span className="t-subhead c-secondary">
              {off.title}
              {next ? ` · Next: ${fmtDateTime(next.scheduledAt)}` : ''}
            </span>
          </button>
        )}
        {!msgs.length && (
          <p className="t-subhead c-secondary center" style={{ padding: '40px 20px' }}>
            Say hello to {sel.firstName(otherName)}. Messages stay in Scale; phone numbers and emails are never shared.
          </p>
        )}
        <div className="bubbles" aria-live="polite">
          {msgs.map((m, i) => {
            const mine = m.senderId === me.id;
            const showTime = i === 0 || m.sentAt - msgs[i - 1].sentAt > 3600000;
            return (
              <div key={m.id} className="stack-6" style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                {showTime && <p className="t-footnote c-secondary" style={{ alignSelf: 'flex-start' }}>{`${fmtMonthDay(m.sentAt)} ${fmtTime(m.sentAt)}`}</p>}
                {m.failed ? (
                  <button type="button" className="bubble bubble--me" style={{ opacity: 0.6 }} onClick={() => (retryMessage(m.id) ? toast('Message sent', { icon: 'check' }) : toast('Still offline', { icon: 'warning' }))}>
                    {m.text}
                  </button>
                ) : (
                  <p className={`bubble${mine ? ' bubble--me' : ''}`}>
                    <span className="sr-only">{mine ? 'You' : sel.firstName(otherName)}: </span>
                    {m.text}
                  </p>
                )}
                {m.failed && <span className="t-footnote c-danger">Not sent. Tap to retry</span>}
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </div>
      <form
        className="fixed-col composer"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="composer__row">
          <button type="button" className="round-btn" aria-label="Add attachment" onClick={() => notInPrototype('Attachments')}>
            <Icon name="plus" size={24} />
          </button>
          <label htmlFor="composer" className="sr-only">
            Message
          </label>
          <input id="composer" className="composer__input" placeholder="Message" value={text} onChange={(e) => setText(e.target.value)} enterKeyHint="send" autoComplete="off" />
          <button type="submit" className="round-btn" aria-label="Send" aria-disabled={!text.trim() || undefined}>
            <Icon name="arrow.up.circle.fill" size={32} />
          </button>
        </div>
        <p className="t-footnote c-secondary center">Keep payments in Scale. Teachers never need your card in a message.</p>
      </form>
      <ActionSheet
        open={more}
        onCancel={() => setMore(false)}
        actions={[
          ...(iAmStudent ? [{ label: `View ${sel.firstName(otherName)}'s profile`, onClick: () => navigate(`/s/teacher/${otherId}`) }] : [{ label: 'View student', onClick: () => navigate(`/t/students/${otherId}`) }]),
          {
            label: 'Report',
            destructive: true,
            onClick: () => {
              setMore(false);
              setReport(true);
            },
          },
          { label: 'Cancel', bold: true, onClick: () => setMore(false) },
        ]}
      />
      <ReportSheet open={report} onClose={() => setReport(false)} reporterId={me.id} subjectUserId={otherId} subjectName={otherName} context="Messages" />
    </Screen>
  );
}

function A07Account(_: ScreenProps) {
  const { db, me, role } = useMe();
  const has = (r: Role) => me.roles.includes(r);
  const roleRow = (r: Role, title: string, sub: string) => {
    const isActive = role === r;
    if (!has(r))
      return (
        <ListRow
          key={r}
          title={title}
          subtitle={sub}
          value="Add role"
          chevron
          label={`Add the ${r} role. Current role: ${role}`}
          onClick={() => {
            chooseRole(me.id, r);
            navigate(r === 'student' ? '/s/onboarding/interests' : `/t/onboarding/${TEACHER_STEPS[0]}`);
          }}
        />
      );
    return (
      <ListRow
        key={r}
        title={title}
        subtitle={sub}
        value={isActive ? 'Active' : 'Switch'}
        chevron={!isActive}
        label={isActive ? `${title}, active role` : `Switch to ${r}. Current role: ${role}`}
        onClick={
          isActive
            ? undefined
            : () => {
                switchRole(me.id, r);
                const u = sel.user(db, me.id)!;
                navigate(u.lastRouteByRole[r] ?? ROLE_ROOT[r], { dir: 'none' });
                toast(`Switched to ${r}`, { icon: 'check' });
              }
        }
      />
    );
  };
  const isTeacherView = role === 'teacher';
  return (
    <Screen title="Account" noNav={!isTeacherView} back={isTeacherView}>
      <div className="stack">
        <h1 className="t-large-title" style={{ paddingTop: isTeacherView ? 0 : 8 }}>
          Account
        </h1>
        <div className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Avatar initials={sel.initials(me.name)} large />
          <div className="stack-6" style={{ gap: 2, minWidth: 0 }}>
            <p className="t-headline" style={{ fontSize: '1.1rem' }}>
              {me.name}
            </p>
            <p className="t-subhead c-secondary" style={{ overflowWrap: 'anywhere' }}>
              Signed in with {me.authProvider === 'apple' ? 'Apple' : 'email'} · {me.email}
            </p>
          </div>
        </div>
        <section className="stack-6">
          <Group label="Roles" labelId="roles-h">
            {roleRow('student', 'Student', 'Find teachers, book, track progress')}
            {roleRow('teacher', 'Teacher', 'Sell lessons and get paid on Scale')}
          </Group>
          <p className="helper">One account can hold both roles. Each role has its own tabs, notifications and money. Switching never signs you out.</p>
        </section>
        <Group label="Settings" labelId="set-h">
          <ListRow title="Notifications" subtitle="Lessons, messages, payments" chevron onClick={() => notInPrototype('Notification settings')} />
          <ListRow title="Privacy" subtitle={isTeacherView ? 'What students can see about you' : 'What teachers can see about you'} chevron onClick={() => notInPrototype('Privacy settings')} />
          {isTeacherView ? (
            <ListRow title="Payouts" subtitle="Bank account and schedule" chevron onClick={() => navigate('/t/payouts')} />
          ) : (
            <ListRow title="Payment methods" subtitle="Apple Pay · Visa ending 4417" chevron onClick={() => notInPrototype('Payment methods')} />
          )}
          {!isTeacherView && <ListRow title="Guardian account" subtitle="Book for someone under 18" chevron onClick={() => notInPrototype('Guardian accounts')} />}
        </Group>
        <Group label="Help and safety" labelId="help-h">
          <ListRow title="Help center" chevron onClick={() => notInPrototype('The help center')} />
          <ListRow title="Terms and privacy policy" chevron onClick={() => notInPrototype('Legal pages')} />
        </Group>
        <div className="group">
          <ListRow
            title="Sign out"
            onClick={() => {
              signOut();
              navigate('/welcome', { replace: true });
            }}
          />
          <ListRow title="Delete account" destructive chevron onClick={() => navigate('/account/delete')} />
        </div>
      </div>
    </Screen>
  );
}

function A08DeleteAccount(_: ScreenProps) {
  const { db, me } = useMe();
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const active = db.enrollments.filter((e) => e.status === 'active' && (e.studentUserId === me.id || e.teacherId === me.id));
  const asStudent = active.filter((e) => e.studentUserId === me.id);
  const asTeacher = active.filter((e) => e.teacherId === me.id);
  const refunds = active.reduce((s, e) => s + refundPreview(db, e.id, e.teacherId === me.id ? 'teacher' : 'account_deleted').refundCents, 0);
  const payoutInProgress = db.payouts.some((p) => p.teacherId === me.id && p.status === 'scheduled');
  const doDelete = async () => {
    setLoading(true);
    const r = await deleteAccount(me.id);
    setLoading(false);
    setConfirm(false);
    if (!r.ok) {
      toast(r.message, { icon: 'warning' });
      return;
    }
    navigate('/welcome', { replace: true });
    toast(r.value ? `Account deleted. ${fmt(r.value)} in refunds issued.` : 'Account deleted.', { icon: 'check', duration: 5000 });
  };
  const first = asStudent[0];
  const firstOff = first ? sel.offering(db, first.offeringId) : undefined;
  const left = first ? sel.lessonsOf(db, first.id).filter((l) => l.status === 'scheduled').length : 0;
  return (
    <Screen
      title="Delete account"
      navTitle
      ownHeading
      back
      bottom={
        <>
          <Button variant="gray" onClick={() => notInPrototype('Exporting progress')}>
            Export my progress
          </Button>
          <Button variant="destructive" disabled={payoutInProgress} describedBy={payoutInProgress ? 'payout-block' : undefined} onClick={() => setConfirm(true)}>
            {active.length ? 'Cancel lessons and delete account' : 'Delete account'}
          </Button>
        </>
      }
    >
      <div className="stack">
        <h1 className="t-title1">Before you go</h1>
        {payoutInProgress && (
          <p id="payout-block">
            <InlineAlert tone="danger" title="A payout is in progress">
              You can delete your account after it lands.
            </InlineAlert>
          </p>
        )}
        {asStudent.length > 0 && (
          <InlineAlert tone="warning" title={`You have ${asStudent.length} active course${asStudent.length === 1 ? '' : 's'}`}>
            {firstOff?.title} has {left} lesson{left === 1 ? '' : 's'} left. Deleting cancels {left === 1 ? 'it' : 'them'} and refunds {fmt(refunds)} to your Apple Pay card in 3 to 5 business days.
          </InlineAlert>
        )}
        {asTeacher.length > 0 && (
          <InlineAlert tone="warning" title={`You have ${asTeacher.length} active student${asTeacher.length === 1 ? '' : 's'}`}>
            Deleting cancels their untaught lessons. They are refunded {fmt(refunds)} and notified.
          </InlineAlert>
        )}
        <section className="stack-6">
          <Group label="What happens" labelId="wh-h">
            <ListRow title="Profile, messages and progress" subtitle="Deleted within 30 days" />
            <ListRow title="Receipts and payment records" subtitle="Kept as required by law, then deleted" />
            <ListRow title={me.roles.includes('teacher') ? 'Students you taught' : 'Teachers you studied with'} subtitle={me.roles.includes('teacher') ? 'See "Deleted teacher" in their records' : 'See "Deleted student" in their records'} />
          </Group>
          <p className="helper">You can export your progress notes before deleting. This cannot be undone.</p>
        </section>
      </div>
      <Alert
        open={confirm}
        title="Delete account?"
        message={active.length ? `Your remaining lessons are cancelled and ${fmt(refunds)} is refunded. This cannot be undone.` : 'This cannot be undone.'}
        cancel={{ label: 'Cancel', bold: true, onClick: () => setConfirm(false) }}
        confirm={{ label: 'Delete', destructive: true, onClick: doDelete, loading }}
      />
    </Screen>
  );
}
