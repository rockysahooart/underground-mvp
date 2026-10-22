// Flow 01 teacher path: T01 Teaching Type, T02 Specialties, T03 Weekly Availability,
// T04 Payouts and Verification (+ Pending), T05 Profile Preview. Saved per step.
import { useState } from 'react';
import { Screen, Sheet } from '../../layout/layout';
import { Avatar, Badge, Button, Chip, Group, InlineAlert, ListRow, Radio, Segmented, StepIndicator, TextField } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useMe } from '../../app/hooks';
import { navigate } from '../../router/hashRouter';
import * as sel from '../../data/selectors';
import { fmtHM, WEEKDAYS } from '../../data/clock';
import { INSTRUMENTS } from '../../data/seed';
import { addBankAccount, finishTeacherSetup, saveAvailability, saveTeacherStep, startIdCheck, validateWindows, type WindowInput } from '../../services';
import { notInPrototype, toast } from '../../data/ui';
import type { Format, Level } from '../../data/schema';

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

function FieldError({ id, children }: { id?: string; children: string }) {
  return (
    <p id={id} className="field__error" role="alert">
      <Icon name="exclamationmark.circle.fill" size={16} />
      {children}
    </p>
  );
}

/** Weekly windows editor shared by T03 and T17. One window per day; times move in 15-minute steps. */
export function WindowsEditor({ value, onChange }: { value: WindowInput[]; onChange: (w: WindowInput[]) => void }) {
  const byDay = (d: number) => value.find((w) => w.weekday === d);
  const set = (d: number, patch: Partial<WindowInput> | null) => {
    const rest = value.filter((w) => w.weekday !== d);
    if (patch === null) onChange(rest);
    else onChange([...rest, { ...(byDay(d) ?? { weekday: d, start: '16:00', end: '19:00' }), ...patch }].sort((a, b) => ORDER.indexOf(a.weekday) - ORDER.indexOf(b.weekday)));
  };
  return (
    <div className="group">
      {ORDER.map((d) => {
        const w = byDay(d);
        return (
          <div key={d} className="row" style={{ minHeight: 60 }} role="group" aria-label={w ? `${WEEKDAYS[d]}, ${fmtHM(w.start)} to ${fmtHM(w.end)}` : `${WEEKDAYS[d]}, unavailable`}>
            <span className="row__title" style={{ width: 104, flex: 'none' }}>
              {WEEKDAYS[d]}
            </span>
            {w ? (
              <span className="hstack grow" style={{ gap: 8 }}>
                <input className="time-input" type="time" step={900} value={w.start} aria-label={`${WEEKDAYS[d]} start`} onChange={(e) => set(d, { start: e.target.value })} />
                <input className="time-input" type="time" step={900} value={w.end} aria-label={`${WEEKDAYS[d]} end`} onChange={(e) => set(d, { end: e.target.value })} />
              </span>
            ) : (
              <span className="grow c-tertiary">Unavailable</span>
            )}
            <button type="button" className="round-btn" style={{ color: 'var(--text-secondary)' }} aria-label={w ? `Remove ${WEEKDAYS[d]} window` : `Add a ${WEEKDAYS[d]} window`} onClick={() => set(d, w ? null : {})}>
              <Icon name={w ? 'minus' : 'plus.circle.fill'} size={22} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function RulesGroup() {
  return (
    <Group label="Rules" labelId="rules-h">
      <ListRow title="Lesson length" subtitle="Default for new offerings" value="45 min" />
      <ListRow title="Break after each lesson" subtitle="Keeps back-to-back times apart" value="15 min" />
    </Group>
  );
}

export function T01TeachingType() {
  const { db, me } = useMe();
  const tp = sel.teacherProfile(db, me.id)!;
  const [type, setType] = useState<'independent' | undefined>(tp.teachingType === 'independent' ? 'independent' : undefined);
  const [error, setError] = useState(false);
  const next = () => {
    if (!type) {
      setError(true);
      return;
    }
    saveTeacherStep(me.id, 1, { teachingType: type });
    navigate('/t/onboarding/specialties');
  };
  return (
    <Screen title="How do you teach?" back bottom={<Button onClick={next}>Continue</Button>}>
      <div className="stack">
        <StepIndicator total={5} current={1} label="How you teach" />
        <div className="title-block">
          <h1 className="t-title1">How do you teach?</h1>
          <p className="t-body c-secondary">This sets up your profile and payouts.</p>
        </div>
        <div className="stack-16" role="radiogroup" aria-label="Teaching type">
          <button
            type="button"
            role="radio"
            aria-checked={type === 'independent'}
            className="choice-card"
            onClick={() => {
              setType('independent');
              setError(false);
            }}
          >
            <span className="icon-circle">
              <Icon name="person.fill" size={22} />
            </span>
            <span className="row__text">
              <span className="t-headline" style={{ fontSize: '1.06rem' }}>
                Independent teacher
              </span>
              <span className="t-body c-secondary">I teach my own students and get paid directly</span>
            </span>
            <Radio on={type === 'independent'} />
          </button>
          <div className="choice-card" role="radio" aria-checked={false} aria-disabled="true" aria-label="Music school, not available yet">
            <span className="icon-circle">
              <Icon name="building" size={22} />
            </span>
            <span className="row__text">
              <span className="t-headline c-secondary" style={{ fontSize: '1.06rem' }}>
                Music school
              </span>
              <span className="t-body c-secondary">Several teachers under one business</span>
              <span style={{ marginTop: 6 }}>
                <Badge>Coming after launch</Badge>
              </span>
            </span>
            <Radio on={false} />
          </div>
        </div>
        {error && <FieldError>Choose how you teach to continue.</FieldError>}
      </div>
    </Screen>
  );
}

export function T02Specialties() {
  const { db, me } = useMe();
  const tp = sel.teacherProfile(db, me.id)!;
  const [instruments, setInstruments] = useState<string[]>(tp.instruments);
  const [levels, setLevels] = useState<Level[]>(tp.levels);
  const [formats, setFormats] = useState<Format>(tp.formats);
  const [area, setArea] = useState(tp.serviceArea ?? '');
  const [editArea, setEditArea] = useState(false);
  const [draft, setDraft] = useState(area);
  const [tried, setTried] = useState(false);
  const errs = { instruments: !instruments.length, levels: !levels.length };
  const next = () => {
    setTried(true);
    if (errs.instruments || errs.levels) return;
    saveTeacherStep(me.id, 2, { instruments, levels, formats, serviceArea: formats === 'online' ? undefined : area || undefined });
    navigate('/t/onboarding/availability');
  };
  const toggle = <T,>(list: T[], set: (v: T[]) => void, v: T) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <Screen title="What do you teach?" back bottom={<Button onClick={next}>Continue</Button>}>
      <div className="stack">
        <StepIndicator total={5} current={2} label="What you teach" />
        <h1 className="t-title1">What do you teach?</h1>
        <section className="stack-6">
          <h2 className="section-label">Instruments</h2>
          <div className="chips" role="group" aria-label="Instruments">
            {INSTRUMENTS.map((i) => (
              <Chip key={i} label={i} selected={instruments.includes(i)} onToggle={() => toggle(instruments, setInstruments, i)} />
            ))}
          </div>
          {tried && errs.instruments && <FieldError>Choose at least one instrument.</FieldError>}
        </section>
        <section className="stack-6">
          <h2 className="section-label">Levels you take</h2>
          <div className="chips" role="group" aria-label="Levels you take">
            {(['beginner', 'intermediate', 'advanced'] as Level[]).map((l) => (
              <Chip key={l} label={sel.LEVEL_LABEL[l]} selected={levels.includes(l)} onToggle={() => toggle(levels, setLevels, l)} />
            ))}
          </div>
          {tried && errs.levels && <FieldError>Choose at least one level.</FieldError>}
        </section>
        <section className="stack-12">
          <h2 className="section-label" style={{ margin: 0 }}>
            Where you teach
          </h2>
          <Segmented
            label="Where you teach"
            value={formats}
            onChange={setFormats}
            options={[
              { value: 'online', label: 'Online' },
              { value: 'in_person', label: 'In person' },
              { value: 'either', label: 'Both' },
            ]}
          />
          {formats !== 'online' && (
            <div>
              <div className="group">
                <ListRow
                  title="In-person location"
                  subtitle={area ? `Your studio · ${area}` : 'Add the neighborhood you teach in'}
                  value="Edit"
                  chevron
                  onClick={() => {
                    setDraft(area);
                    setEditArea(true);
                  }}
                />
              </div>
              <p className="helper">Students see only the neighborhood. The full address is shared after a booking is confirmed.</p>
            </div>
          )}
        </section>
      </div>
      <Sheet
        open={editArea}
        title="In-person location"
        onCancel={() => setEditArea(false)}
        action={{
          label: 'Save',
          onClick: () => {
            setArea(draft.trim());
            setEditArea(false);
          },
        }}
      >
        <TextField label="Neighborhood" value={draft} onChange={setDraft} placeholder="e.g. South Austin" enterKeyHint="done" />
      </Sheet>
    </Screen>
  );
}

export function T03Availability() {
  const { db, me } = useMe();
  const existing = db.availability.filter((a) => a.teacherId === me.id).map(({ weekday, start, end }) => ({ weekday, start, end }));
  const [windows, setWindows] = useState<WindowInput[]>(existing.length ? existing : [{ weekday: 4, start: '16:00', end: '19:00' }]);
  const [error, setError] = useState<string | null>(null);
  const next = () => {
    const r = saveAvailability(me.id, windows);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    saveTeacherStep(me.id, 3, {});
    navigate('/t/onboarding/payouts');
  };
  return (
    <Screen title="When can students book?" back bottom={<Button onClick={next}>Continue</Button>}>
      <div className="stack">
        <StepIndicator total={5} current={3} label="Availability" />
        <div className="title-block">
          <h1 className="t-title1">When can students book?</h1>
          <p className="t-body c-secondary">Students pick a recurring weekly time inside these windows. You can change them later in Schedule.</p>
        </div>
        <section className="stack-6">
          <h2 className="section-label">Weekly windows</h2>
          <WindowsEditor
            value={windows}
            onChange={(w) => {
              setWindows(w);
              setError(validateWindows(w) && error ? validateWindows(w) : null);
            }}
          />
          {error && <FieldError>{error}</FieldError>}
          <p className="helper">Windows become 45-minute bookable times with a 15-minute break after each lesson. Times are in Central Time.</p>
        </section>
        <RulesGroup />
      </div>
    </Screen>
  );
}

export function T04Payouts() {
  const { db, me } = useMe();
  const tp = sel.teacherProfile(db, me.id)!;
  const pending = tp.idStatus === 'pending';
  const next = () => {
    saveTeacherStep(me.id, 4, {});
    navigate('/t/onboarding/preview');
  };
  const idValue = tp.idStatus === 'passed' ? 'Verified' : pending ? 'In review' : 'Start';
  return (
    <Screen
      title="Get paid and get verified"
      back
      bottom={
        <>
          <Button onClick={next}>{pending ? 'Continue to preview' : 'Continue'}</Button>
          {!pending && tp.idStatus !== 'passed' && <p className="bottombar__note">You can skip for now. Students cannot book you until your ID check passes.</p>}
        </>
      }
    >
      <div className="stack">
        <StepIndicator total={5} current={4} label="Payouts and verification" />
        <h1 className="t-title1">Get paid and get verified</h1>
        {pending && (
          <InlineAlert tone="info" title="ID check in review">
            Usually under 10 minutes. You can finish your profile now; publishing unlocks when the check passes.
          </InlineAlert>
        )}
        {tp.idStatus === 'passed' && (
          <InlineAlert tone="success" title="ID verified">
            You can publish courses once your profile is finished.
          </InlineAlert>
        )}
        <Group label="Payouts" labelId="po-h">
          <ListRow
            title="Bank account"
            subtitle={tp.bankAccount ? `${tp.bankAccount.label} ending ${tp.bankAccount.last4}` : 'Required before your first payout'}
            value={tp.bankAccount ? 'Verified' : 'Add'}
            chevron
            label={tp.bankAccount ? `Bank account, ${tp.bankAccount.label} ending in ${tp.bankAccount.last4}, verified` : 'Bank account, add. Required before your first payout'}
            onClick={() => {
              if (tp.bankAccount) notInPrototype('Editing bank details');
              else {
                addBankAccount(me.id);
                toast('Bank account added (simulated)', { icon: 'check' });
              }
            }}
          />
          <ListRow title="Payout schedule" subtitle="Every Monday for lessons taught" value="Weekly" chevron onClick={() => notInPrototype('Changing the payout schedule')} />
        </Group>
        <section className="stack-6">
          <Group label="Verification" labelId="ver-h">
            <ListRow
              title="Photo ID"
              subtitle="Required before you publish"
              value={idValue}
              chevron
              label={`Photo ID, ${idValue === 'Start' ? 'not started' : idValue}`}
              onClick={() => (tp.idStatus === 'not_started' || tp.idStatus === 'failed' ? startIdCheck(me.id) : undefined)}
            />
            <ListRow title="Background check" subtitle="Required before in-person lessons with students under 18" value={tp.backgroundCheck === 'passed' ? 'Passed' : 'Start'} chevron onClick={() => notInPrototype('Background checks')} />
          </Group>
          <p className="helper">Checks are run by our verification partner. Scale stores only the result and the date.</p>
        </section>
      </div>
    </Screen>
  );
}

export function T05Preview() {
  const { db, me } = useMe();
  const tp = sel.teacherProfile(db, me.id)!;
  const [bioOpen, setBioOpen] = useState(false);
  const [bio, setBio] = useState(tp.bio ?? '');
  const [sinceOpen, setSinceOpen] = useState(false);
  const [since, setSince] = useState(String(tp.teachingSince ?? ''));
  const r = sel.rating(db, me.id);
  const finish = () => {
    finishTeacherSetup(me.id);
    navigate('/t/today', { replace: true });
  };
  return (
    <Screen title="This is your public profile" back bottom={<Button onClick={finish}>Finish and go to Today</Button>}>
      <div className="stack">
        <StepIndicator total={5} current={5} label="Preview" />
        <h1 className="t-title1">This is your public profile</h1>
        <section className="card card--outline stack-8" style={{ alignItems: 'center', textAlign: 'center', padding: '20px 16px' }} aria-label="Preview, as students see it">
          <p className="section-label" style={{ margin: 0 }}>
            Preview · As students see it
          </p>
          <Avatar initials={sel.initials(me.name)} large />
          <p className="t-title1" style={{ fontSize: '1.9rem' }}>
            {me.name}
          </p>
          <p className="t-body c-secondary">
            Independent {(tp.instruments[0] ?? 'music').toLowerCase()} teacher{tp.serviceArea ? ` · ${tp.serviceArea}` : ''}
          </p>
          <div className="hstack wrap" style={{ justifyContent: 'center' }}>
            {tp.idStatus === 'passed' ? <Badge tone="success">ID verified</Badge> : tp.idStatus === 'pending' ? <Badge tone="warning">ID check in review</Badge> : <Badge>ID not verified</Badge>}
            {r.show ? <Badge>{sel.fmtRating(r.avg)} ★ ({r.count})</Badge> : <Badge tone="gold">New teacher</Badge>}
          </div>
          {tp.bio && <p className="t-subhead c-secondary">{tp.bio}</p>}
        </section>
        <section className="stack-6">
          <Group label="Finish your profile" labelId="fin-h">
            <ListRow title="Photo" subtitle="Helps students recognize you" value="Add" chevron onClick={() => notInPrototype('Profile photos')} />
            <ListRow title="About you" subtitle="2 to 4 sentences, shown above your offerings" value={tp.bio ? 'Edit' : 'Write'} chevron onClick={() => setBioOpen(true)} />
            <ListRow title="Teaching since" subtitle="Shown on your profile" value={tp.teachingSince ? String(tp.teachingSince) : 'Add'} chevron onClick={() => setSinceOpen(true)} />
          </Group>
          <p className="helper">Ratings and lesson counts appear after your first completed lessons. Nothing here is visible to students until you publish a course.</p>
        </section>
      </div>
      <Sheet
        open={bioOpen}
        large
        title="About you"
        onCancel={() => setBioOpen(false)}
        action={{
          label: 'Save',
          onClick: () => {
            saveTeacherStep(me.id, 4, { bio: bio.trim() || undefined });
            setBioOpen(false);
          },
        }}
      >
        <TextField label="About you" multiline value={bio} onChange={setBio} helper="2 to 4 sentences about how you teach." maxLength={500} />
      </Sheet>
      <Sheet
        open={sinceOpen}
        title="Teaching since"
        onCancel={() => setSinceOpen(false)}
        action={{
          label: 'Save',
          onClick: () => {
            const y = Number(since);
            saveTeacherStep(me.id, 4, { teachingSince: y > 1940 && y < 2100 ? y : undefined });
            setSinceOpen(false);
          },
        }}
      >
        <TextField label="Year you started teaching" inputMode="numeric" value={since} onChange={setSince} maxLength={4} />
      </Sheet>
    </Screen>
  );
}
