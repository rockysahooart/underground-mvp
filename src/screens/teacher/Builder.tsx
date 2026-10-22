// Flow 05: T06 Offerings (+ Empty), T07 Course Basics (+ Title Missing), T08 Curriculum,
// T09 Price and Schedule (+ Price Too Low), T10 Preview and Publish (+ Confirm Publish), T11 Published.
import { useEffect, useRef, useState } from 'react';
import { Alert, GlassButton, GlassText, Screen, Sheet } from '../../layout/layout';
import { Badge, Button, Chip, EmptyState, Group, InlineAlert, ListRow, Segmented, StepIndicator, TextField } from '../../components/ui';
import { CourseCard } from '../../components/cards';
import { Icon } from '../../components/Icon';
import { share, useMe, type ScreenProps } from '../../app/hooks';
import { navigate } from '../../router/hashRouter';
import * as sel from '../../data/selectors';
import { fmtWindow, now, WEEKDAYS_SHORT } from '../../data/clock';
import { FEE_RATE, feeCents, fmt, fmtShort, MIN_PRICE_PER_LESSON_CENTS, netCents } from '../../data/money';
import { toast } from '../../data/ui';
import { publishCourse, readiness, saveCourseDraft } from '../../services';
import type { CurriculumItem, DB, Level, Offering } from '../../data/schema';

const STEP_ROUTE = ['basics', 'curriculum', 'price', 'preview'];

export function availabilitySummary(db: DB, teacherId: string, sep = '–') {
  return db.availability
    .filter((a) => a.teacherId === teacherId)
    .sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7))
    .map((a) => `${WEEKDAYS_SHORT[a.weekday]} ${fmtWindow(a.start, a.end, sep)}`)
    .join(' · ');
}

/* ---------- T06 Offerings ---------- */
export function T06Offerings() {
  const { db, me } = useMe();
  const [seg, setSeg] = useState<'all' | 'published' | 'drafts'>('all');
  const mine = db.offerings.filter((o) => o.teacherId === me.id && o.status !== 'unpublished').sort((a, b) => b.createdAt - a.createdAt);
  const list = mine.filter((o) => (seg === 'all' ? true : seg === 'published' ? o.status === 'published' : o.status === 'draft'));
  const t = now();
  const header = (
    <div className="header-row">
      <h1 className="t-large-title">Offerings</h1>
      <GlassButton icon="plus" label="New offering" onClick={() => navigate('/t/builder/new/basics')} />
    </div>
  );
  if (!mine.length)
    return (
      <Screen title="Offerings" noNav>
        <div className="stack">
          {header}
          <Segmented label="Filter offerings" value={seg} onChange={setSeg} options={[{ value: 'all', label: 'All' }, { value: 'published', label: 'Published' }, { value: 'drafts', label: 'Drafts' }]} />
          <EmptyState
            icon="music.note.list"
            title="No offerings yet"
            message="Students find you through what you offer. Most teachers start with one course and one single lesson."
            action={<Button onClick={() => navigate('/t/builder/new/basics')}>Create a course</Button>}
            secondary={
              <Button variant="gray-elevated" onClick={() => navigate('/t/builder/new/basics?type=single')}>
                Add a single lesson
              </Button>
            }
          />
        </div>
      </Screen>
    );
  return (
    <Screen title="Offerings" noNav>
      <div className="stack">
        {header}
        <Segmented label="Filter offerings" value={seg} onChange={setSeg} options={[{ value: 'all', label: 'All' }, { value: 'published', label: 'Published' }, { value: 'drafts', label: 'Drafts' }]} />
        <div className="stack-16">
          {!list.length && <p className="t-body c-secondary">Nothing here yet.</p>}
          {list.map((o) => {
            const enrolled = db.enrollments.filter((e) => e.offeringId === o.id);
            const month = enrolled.filter((e) => t - e.startedAt < 30 * 86400000).length;
            if (o.status === 'published')
              return (
                <button key={o.id} type="button" className="card card--tap" onClick={() => navigate(`/t/builder/${o.id}/preview`)} aria-label={`${o.title}, published. Opens details`}>
                  <span className="spread" style={{ alignItems: 'flex-start' }}>
                    <span className="t-title2">{o.title}</span>
                    <Badge tone="success">Published</Badge>
                  </span>
                  <span className="t-body c-secondary">
                    {o.type === 'single' ? `${o.lessonMinutes} min · ${sel.formatLabel(o.format)} · ${fmtShort(o.pricePerLessonCents)}` : `Course · ${o.lessonCount} lessons · ${fmtShort(sel.offeringTotal(o))}`}
                  </span>
                  <span className="t-subhead c-secondary">
                    {o.type === 'single' ? `${month} lesson${month === 1 ? '' : 's'} booked this month` : `${enrolled.filter((e) => e.status === 'active').length} enrolled · ${sel.openCount(db, o, t)} weekly times open`}
                  </span>
                </button>
              );
            return (
              <section key={o.id} className="card" aria-label={`${o.title || 'Untitled'}, draft`}>
                <span className="spread" style={{ alignItems: 'flex-start' }}>
                  <span className="t-title2">{o.title || 'Untitled offering'}</span>
                  <Badge>Draft</Badge>
                </span>
                <span className="t-body c-secondary">
                  {o.type === 'single' ? 'Single lesson' : 'Course'} · {o.lessonCount} lesson{o.lessonCount === 1 ? '' : 's'} · Step {Math.max(0, o.draftStep - 1)} of 4 done
                </span>
                <Button variant="gray" onClick={() => navigate(`/t/builder/${o.id}/${STEP_ROUTE[Math.min(o.draftStep, 4) - 1]}`)}>
                  Continue setup
                </Button>
              </section>
            );
          })}
        </div>
        <p className="helper">Students only see published offerings. Drafts save automatically.</p>
      </div>
    </Screen>
  );
}

/* ---------- Builder shell ---------- */
function useOffering(params: Record<string, string>) {
  const { db, me } = useMe();
  const id = params.offeringId === 'new' ? null : params.offeringId;
  const off = id ? sel.offering(db, id) : undefined;
  const bad = !!id && (!off || off.teacherId !== me.id);
  useEffect(() => {
    if (bad) {
      toast('That page is not available', { icon: 'info' });
      navigate('/t/offerings', { replace: true });
    }
  }, [bad]);
  return { db, me, id, off, bad };
}

function BuilderScreen({ title, step, children, onSaveDraft, saving, bottom, back }: { title: string; step: number; children: React.ReactNode; onSaveDraft: () => void; saving?: boolean; bottom: React.ReactNode; back?: boolean }) {
  return (
    <Screen
      title={title}
      navTitle
      ownHeading
      back={back}
      close={back ? undefined : () => navigate('/t/offerings', { replace: true, dir: 'back' })}
      trailing={
        <GlassText strong onClick={onSaveDraft} disabled={saving}>
          {saving ? 'Saving…' : 'Save draft'}
        </GlassText>
      }
      bottom={bottom}
    >
      <div className="stack">
        <StepIndicator total={4} current={step} label={['Basics', 'Curriculum', 'Pricing and schedule', 'Preview'][step - 1]} />
        {children}
      </div>
    </Screen>
  );
}

/* ---------- T07 Course Basics ---------- */
const TYPE_HELP: Record<string, string> = {
  single: 'A single lesson is one session students book at one of your weekly times.',
  weekly: 'Weekly lessons repeat at the same time each week, with no fixed curriculum length.',
  course: 'A course is a fixed set of lessons with a start date and a curriculum. Students pay once for the whole course.',
};

export function T07Basics({ params, query }: ScreenProps) {
  const { me, id, off, bad } = useOffering(params);
  const [type, setType] = useState<Offering['type']>(off?.type ?? ((query.get('type') as Offering['type']) || 'course'));
  const [title, setTitle] = useState(off?.title ?? '');
  const [instrument, setInstrument] = useState(off?.instrument ?? '');
  const [description, setDescription] = useState(off?.description ?? '');
  const [level, setLevel] = useState<Level>(off?.level ?? 'beginner');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'next' | 'draft' | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  if (bad) return null;
  const titleError = (v: string) => (!v.trim() ? 'Add a title so students know what they are booking.' : v.trim().length < 4 || v.trim().length > 60 ? 'Use 4 to 60 characters for the title.' : null);
  const save = async (mode: 'next' | 'draft') => {
    if (mode === 'next') {
      const e = titleError(title);
      setError(e);
      if (e) {
        titleRef.current?.focus();
        return;
      }
    }
    setSaving(mode);
    const r = await saveCourseDraft(me.id, id, {
      offering: { type, title: title.trim(), instrument: instrument.trim(), description: description.trim(), level, ...(type === 'single' && !off ? { lessonCount: 1 } : {}) },
      course: type === 'single' && !off ? { curriculum: [{ index: 1, title: title.trim() || 'Private lesson', milestone: '' }] } : undefined,
      step: mode === 'next' ? 2 : 1,
    });
    setSaving(null);
    if (!r.ok) return;
    if (!id) navigate(`/t/builder/${r.value}/basics`, { replace: true, dir: 'none' });
    if (mode === 'next') navigate(`/t/builder/${r.value}/curriculum`);
    else toast('Draft saved', { icon: 'check' });
  };
  return (
    <BuilderScreen
      title="New offering"
      step={1}
      onSaveDraft={() => save('draft')}
      saving={saving === 'draft'}
      bottom={
        <Button onClick={() => save('next')} loading={saving === 'next'}>
          Next: Curriculum
        </Button>
      }
    >
      <h1 className="t-title1">What are you offering?</h1>
      <div className="stack-8">
        <Segmented
          label="Offering type"
          value={type}
          onChange={setType}
          options={[
            { value: 'single', label: 'Single lesson' },
            { value: 'weekly', label: 'Weekly lessons' },
            { value: 'course', label: 'Course' },
          ]}
        />
        <p className="helper" style={{ marginTop: 0 }}>
          {TYPE_HELP[type]}
        </p>
      </div>
      <div className="stack-16">
        <TextField
          ref={titleRef}
          label={type === 'course' ? 'Course title' : 'Title'}
          placeholder={type === 'course' ? 'e.g. Beginner guitar in 8 lessons' : 'e.g. Private guitar lesson'}
          value={title}
          onChange={(v) => {
            setTitle(v);
            if (error) setError(titleError(v));
          }}
          onBlur={() => title && setError(titleError(title))}
          error={error}
          maxLength={60}
          enterKeyHint="next"
          helper={<span aria-live="polite">{title.trim().length} of 60 characters</span>}
        />
        <TextField label="Instrument" value={instrument} onChange={setInstrument} placeholder="e.g. Acoustic guitar" enterKeyHint="next" />
        <TextField label="Short description" multiline value={description} onChange={setDescription} placeholder="What students will be able to do by the end" maxLength={200} />
        <div className="stack-8">
          <p className="field__label">Level</p>
          <div className="chips" role="radiogroup" aria-label="Level">
            {(['beginner', 'intermediate', 'advanced'] as Level[]).map((l) => (
              <Chip key={l} label={sel.LEVEL_LABEL[l]} selected={level === l} onToggle={() => setLevel(l)} />
            ))}
          </div>
        </div>
      </div>
    </BuilderScreen>
  );
}

/* ---------- T08 Curriculum ---------- */
export function T08Curriculum({ params }: ScreenProps) {
  const { db, me, id, off, bad } = useOffering(params);
  const c = sel.course(db, id ?? '');
  const [items, setItems] = useState<CurriculumItem[]>(() => (c?.curriculum.length ? c.curriculum : [{ index: 1, title: '', milestone: '' }]));
  const [editing, setEditing] = useState<number | null>(null);
  const [reorder, setReorder] = useState(false);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState<'next' | 'draft' | null>(null);
  const [draft, setDraft] = useState<CurriculumItem>({ index: 0, title: '', milestone: '' });
  if (bad || !off) return null;
  const renumber = (list: CurriculumItem[]) => list.map((x, i) => ({ ...x, index: i + 1 }));
  const valid = items.length >= 1 && items.length <= 24 && items.every((x) => x.title.trim() && x.milestone.trim());
  const save = async (mode: 'next' | 'draft') => {
    if (mode === 'next') {
      setTried(true);
      if (!valid) {
        toast('Each lesson needs a title and a milestone.', { icon: 'warning' });
        return;
      }
    }
    setSaving(mode);
    await saveCourseDraft(me.id, off.id, { offering: {}, course: { curriculum: renumber(items) }, step: mode === 'next' ? 3 : 2 });
    setSaving(null);
    if (mode === 'next') navigate(`/t/builder/${off.id}/price`);
    else toast('Draft saved', { icon: 'check' });
  };
  const skills = [...new Set(items.map((x) => x.milestone).filter(Boolean))];
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const list = [...items];
    [list[i], list[j]] = [list[j], list[i]];
    setItems(renumber(list));
  };
  const openEdit = (i: number) => {
    setDraft(items[i]);
    setEditing(i);
  };
  return (
    <BuilderScreen
      title="New offering"
      step={2}
      back
      onSaveDraft={() => save('draft')}
      saving={saving === 'draft'}
      bottom={
        <Button onClick={() => save('next')} loading={saving === 'next'}>
          Next: Pricing and schedule
        </Button>
      }
    >
      <div className="title-block">
        <h1 className="t-title1">Plan the lessons</h1>
        <p className="t-body c-secondary">Students see lesson titles before they book. Objectives become the milestones you confirm later.</p>
      </div>
      <section className="stack-6">
        <div className="spread">
          <h2 className="section-label" style={{ margin: 0 }}>
            {items.length} lesson{items.length === 1 ? '' : 's'} · {off.lessonMinutes} min each
          </h2>
          <button type="button" className="t-subhead semibold" style={{ minHeight: 44 }} onClick={() => setReorder((r) => !r)} aria-pressed={reorder}>
            {reorder ? 'Done' : 'Reorder'}
          </button>
        </div>
        <ol className="group">
          {items.map((x, i) => {
            const missing = tried && (!x.title.trim() || !x.milestone.trim());
            return (
              <li key={`${x.index}-${x.title}`} className="row" style={{ alignItems: 'center' }}>
                <span className="avatar" style={{ width: 32, height: 32, background: 'var(--bg-fill)', color: 'var(--text-secondary)', fontSize: 15, fontWeight: 500 }} aria-hidden="true">
                  {i + 1}
                </span>
                <button type="button" className="row__text" style={{ textAlign: 'left' }} onClick={() => !reorder && openEdit(i)} aria-label={`Lesson ${i + 1}: ${x.title || 'no title'}. Milestone: ${x.milestone || 'none'}. Edit`}>
                  <span className="row__title">{x.title || <span className="c-tertiary">Add a lesson title</span>}</span>
                  <span className="row__subtitle">Milestone: {x.milestone || <span className="c-tertiary">add a milestone</span>}</span>
                  {missing && <span className="t-footnote c-danger">Add {!x.title.trim() ? 'a title' : ''}{!x.title.trim() && !x.milestone.trim() ? ' and ' : ''}{!x.milestone.trim() ? 'a milestone' : ''}.</span>}
                </button>
                {reorder ? (
                  <span className="hstack" style={{ gap: 0 }}>
                    <button type="button" className="round-btn" aria-label={`Move lesson ${i + 1} up`} onClick={() => move(i, -1)} disabled={i === 0} style={{ opacity: i === 0 ? 0.3 : 1 }}>
                      <span style={{ transform: 'rotate(180deg)' }}>
                        <Icon name="chevron.down" size={18} />
                      </span>
                    </button>
                    <button type="button" className="round-btn" aria-label={`Move lesson ${i + 1} down`} onClick={() => move(i, 1)} disabled={i === items.length - 1} style={{ opacity: i === items.length - 1 ? 0.3 : 1 }}>
                      <Icon name="chevron.down" size={18} />
                    </button>
                  </span>
                ) : (
                  <span className="c-tertiary" aria-hidden="true">
                    <Icon name="line.3.horizontal" size={20} />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        {items.length < 24 && (
          <div className="group">
            <ListRow
              title="Add lesson"
              leading={<Icon name="plus.circle.fill" size={22} />}
              onClick={() => {
                const next = renumber([...items, { index: items.length + 1, title: '', milestone: items[items.length - 1]?.milestone ?? '' }]);
                setItems(next);
                setDraft(next[next.length - 1]);
                setEditing(next.length - 1);
              }}
            />
          </div>
        )}
        <p className="helper">
          1 to 24 lessons. {skills.length} unique milestone{skills.length === 1 ? '' : 's'} become{skills.length === 1 ? 's' : ''} the student's skills. Lessons can share a milestone.
        </p>
      </section>
      <Sheet
        open={editing !== null}
        large
        title={`Lesson ${editing !== null ? editing + 1 : ''}`}
        onCancel={() => setEditing(null)}
        action={{
          label: 'Done',
          onClick: () => {
            if (editing === null) return;
            const list = [...items];
            list[editing] = { ...draft, title: draft.title.trim(), milestone: draft.milestone.trim() };
            setItems(list);
            setEditing(null);
          },
        }}
      >
        <TextField label="Lesson title" value={draft.title} onChange={(v) => setDraft((d) => ({ ...d, title: v }))} enterKeyHint="next" maxLength={60} />
        <TextField label="Milestone (the skill this lesson builds)" value={draft.milestone} onChange={(v) => setDraft((d) => ({ ...d, milestone: v }))} enterKeyHint="done" maxLength={80} />
        {skills.length > 0 && (
          <div className="stack-8">
            <p className="field__label">Reuse a milestone</p>
            <div className="chips">
              {skills.map((s) => (
                <Chip key={s} label={s} selected={draft.milestone === s} onToggle={() => setDraft((d) => ({ ...d, milestone: s }))} />
              ))}
            </div>
          </div>
        )}
        {editing !== null && items.length > 1 && (
          <Button
            variant="destructive"
            onClick={() => {
              setItems(renumber(items.filter((_, i) => i !== editing)));
              setEditing(null);
            }}
          >
            Remove lesson
          </Button>
        )}
      </Sheet>
    </BuilderScreen>
  );
}

/* ---------- T09 Price and Schedule ---------- */
export function T09Price({ params }: ScreenProps) {
  const { db, me, off, bad } = useOffering(params);
  const n = off?.lessonCount || 1;
  const initial = off && off.pricePerLessonCents ? String((off.pricePerLessonCents * n) / 100) : '';
  const [price, setPrice] = useState(initial);
  const [saving, setSaving] = useState<'next' | 'draft' | null>(null);
  if (bad || !off) return null;
  const totalCents = Math.round(parseFloat(price.replace(/[^0-9.]/g, '')) * 100) || 0;
  const perLesson = Math.round(totalCents / n);
  const tooLow = price !== '' && perLesson < MIN_PRICE_PER_LESSON_CENTS;
  const fee = feeCents(totalCents, FEE_RATE);
  const capacity = sel.teacherOpenSlots(db, me.id, now()).length;
  const save = async (mode: 'next' | 'draft') => {
    if (mode === 'next' && (tooLow || !totalCents)) return;
    setSaving(mode);
    await saveCourseDraft(me.id, off.id, { offering: { pricePerLessonCents: perLesson, capacity: capacity || 1, lessonMinutes: 45 }, step: mode === 'next' ? 4 : 3 });
    setSaving(null);
    if (mode === 'next') navigate(`/t/builder/${off.id}/preview`);
    else toast('Draft saved', { icon: 'check' });
  };
  const isCourse = n > 1;
  return (
    <BuilderScreen
      title="New offering"
      step={3}
      back
      onSaveDraft={() => save('draft')}
      saving={saving === 'draft'}
      bottom={
        <Button onClick={() => save('next')} loading={saving === 'next'} disabled={tooLow || !totalCents} describedBy={tooLow ? 'price-err' : undefined}>
          Next: Preview
        </Button>
      }
    >
      <h1 className="t-title1">Price and schedule</h1>
      <TextField
        id="price"
        label={isCourse ? 'Course price' : 'Lesson price'}
        prefix="$"
        inputMode="decimal"
        enterKeyHint="done"
        value={price}
        onChange={(v) => setPrice(v.replace(/[^0-9.]/g, ''))}
        error={tooLow ? `That is ${fmt(perLesson)} per lesson. Set at least ${fmtShort(MIN_PRICE_PER_LESSON_CENTS)} per lesson, which is ${fmtShort(MIN_PRICE_PER_LESSON_CENTS * n)} for ${n} lesson${n === 1 ? '' : 's'}.` : null}
        helper={isCourse && totalCents && !tooLow ? `${fmt(perLesson)} per lesson × ${n} lessons` : undefined}
      />
      <section className="card" aria-label="Earnings preview" aria-live="polite">
        <div className="kv t-body">
          <span>Student pays</span>
          <span className="tabular">{fmt(totalCents)}</span>
        </div>
        <div className="kv t-body">
          <span>Marketplace fee ({Math.round(FEE_RATE * 100)}%)</span>
          <span className="tabular">−{fmt(fee)}</span>
        </div>
        <div className="kv t-body semibold" style={{ fontSize: '1.06rem' }}>
          <span style={{ color: 'var(--text-primary)' }}>You earn</span>
          <span className="tabular">{fmt(netCents(totalCents, FEE_RATE))}</span>
        </div>
        <p className="t-footnote c-secondary">Released lesson by lesson as you mark each one complete, then paid out weekly.</p>
      </section>
      <section className="stack-6">
        <Group label="Schedule and capacity" labelId="sc-h">
          <ListRow title="Lesson format" subtitle={`One-on-one, ${off.lessonMinutes} minutes`} value="Change" chevron onClick={() => toast('Other lesson lengths are not in the prototype.', { icon: 'info' })} />
          <ListRow title="Weekly availability" subtitle={availabilitySummary(db, me.id) || 'No windows yet'} value="Edit" chevron onClick={() => navigate('/t/availability')} />
          <ListRow title="Students at once" subtitle={`Up to ${capacity} enrolled`} value={String(capacity)} label={`Students at once, ${capacity}, the number of weekly times you offer`} />
        </Group>
        <p className="helper">Each student picks one recurring weekly time inside these windows, so students at once equals your weekly times.</p>
      </section>
    </BuilderScreen>
  );
}

/* ---------- T10 Preview and Publish ---------- */
export function T10Preview({ params }: ScreenProps) {
  const { db, me, off, bad } = useOffering(params);
  const [confirm, setConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  if (bad || !off) return null;
  const published = off.status === 'published';
  const checks = readiness(db, off);
  const ready = checks.every((c) => c.ok);
  const doPublish = async () => {
    setPublishing(true);
    const r = await publishCourse(off.id);
    setPublishing(false);
    setConfirm(false);
    if (!r.ok) {
      toast(r.message, { icon: 'warning' });
      return;
    }
    navigate(`/t/builder/${off.id}/published`, { replace: true });
  };
  const goStep = (step: string) => {
    if (step === 'availability') navigate('/t/availability');
    else if (step === 'id') navigate('/t/onboarding/payouts');
    else navigate(`/t/builder/${off.id}/${step}`);
  };
  if (published)
    return (
      <Screen title={off.title} navTitle ownHeading back bottom={<Button onClick={() => navigate(`/t/preview/${off.id}`)}>View as a student</Button>}>
        <div className="stack">
          <div className="stack-8">
            <Badge tone="success">Published</Badge>
            <h1 className="t-title1">{off.title}</h1>
          </div>
          <CourseCard db={db} off={off} static />
          <InlineAlert tone="info" title="Read only">
            Editing or unpublishing a published offering is not in the prototype. Anyone enrolled keeps their lessons.
          </InlineAlert>
          <div className="group">
            <ListRow title="Share link" subtitle={`scale.app/${sel.firstName(me.name).toLowerCase()}/${off.id.slice(-6)}`} chevron onClick={() => share(off.title, `/s/course/${off.id}`, () => toast('Link copied', { icon: 'check' }))} />
            <ListRow title="Weekly times open" subtitle={availabilitySummary(db, me.id, ' to ')} value={String(sel.openCount(db, off, now()))} chevron onClick={() => navigate('/t/availability')} />
          </div>
        </div>
      </Screen>
    );
  return (
    <BuilderScreen
      title="New offering"
      step={4}
      back
      onSaveDraft={() => toast('Draft saved', { icon: 'check' })}
      bottom={
        <>
          <Button onClick={() => setConfirm(true)} disabled={!ready} describedBy="publish-note">
            Publish course
          </Button>
          <p id="publish-note" className="bottombar__note">
            {ready ? 'Publishing makes the course searchable right away. You can unpublish any time; booked students keep their seats.' : 'Publish unlocks when every checklist row is done.'}
          </p>
        </>
      }
    >
      <h1 className="t-title1">This is what students see</h1>
      <CourseCard db={db} off={off} static />
      <section className="stack-6">
        <h2 className="section-label" id="ready-h">
          Ready to publish
        </h2>
        <ul className="group" aria-labelledby="ready-h">
          {checks.map((c) => (
            <li key={c.key}>
              {c.ok ? (
                <div className="row row--single" aria-label={`${c.label}, done`}>
                  <span className="c-success">
                    <Icon name="checkmark.circle.fill" size={24} />
                  </span>
                  <span className="row__text">
                    <span className="row__title">{c.label}</span>
                    {c.key === 'policy' && <span className="row__subtitle">Using the standard 24-hour policy</span>}
                  </span>
                </div>
              ) : (
                <button type="button" className="row row--single" onClick={() => goStep(c.step)} aria-label={`${c.label}, missing. Fix it`}>
                  <span className="c-danger">
                    <Icon name="exclamationmark.circle.fill" size={24} />
                  </span>
                  <span className="row__text">
                    <span className="row__title c-danger">{c.label}</span>
                    <span className="row__subtitle">Missing · tap to fix</span>
                  </span>
                  <Icon name="chevron.right" size={16} className="row__chev" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <Alert
        open={confirm}
        title={`Publish ${off.title}?`}
        message="Students can find and book it right away. You can unpublish later; anyone already enrolled keeps their lessons."
        cancel={{ label: 'Cancel', onClick: () => setConfirm(false) }}
        confirm={{ label: 'Publish', bold: true, onClick: doPublish, loading: publishing }}
      />
    </BuilderScreen>
  );
}

/* ---------- T11 Published ---------- */
export function T11Published({ params }: ScreenProps) {
  const { db, me, off, bad } = useOffering(params);
  if (bad || !off) return null;
  const tp = sel.teacherProfile(db, me.id);
  return (
    <Screen title="Your course is live" noNav bottom={<Button onClick={() => navigate('/t/offerings', { replace: true, dir: 'back' })}>Done</Button>}>
      <div className="stack" style={{ paddingTop: 110 }}>
        <div className="stack-16 center">
          <span className="check-circle" style={{ width: 54, height: 54 }} aria-hidden="true">
            <Icon name="checkmark" size={30} />
          </span>
          <h1 className="t-title1" role="alert">
            Your course is live
          </h1>
          <p className="t-body c-secondary" style={{ fontSize: '1.06rem' }}>
            {off.title} now appears in Discover for {off.instrument.toLowerCase().replace('acoustic ', '') || 'music'} students {tp?.formats === 'online' ? 'online' : `near ${tp?.city.replace(/, TX$/, '') ?? 'you'} and online`}. We will tell you the moment someone books.
          </p>
        </div>
        <div className="group">
          <ListRow title="View as a student" subtitle="Opens the public course page" chevron onClick={() => navigate(`/t/preview/${off.id}`)} />
          <ListRow title="Share link" subtitle={`scale.app/${sel.firstName(me.name).toLowerCase()}/${off.title.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)}`} chevron onClick={() => share(off.title, `/s/course/${off.id}`, () => toast('Link copied', { icon: 'check' }))} />
          <ListRow title="Weekly times open" subtitle={availabilitySummary(db, me.id, ' to ')} value={String(sel.openCount(db, off, now()))} chevron onClick={() => navigate('/t/availability')} />
        </div>
      </div>
    </Screen>
  );
}
