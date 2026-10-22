// Flow 02: S04 Discover, S05 Search Results (+ Loading, No Results, Offline), S06 Filters.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Screen, Sheet } from '../../layout/layout';
import { Button, Chip, InlineAlert, ListRow, SearchField, Segmented, SectionHeader, SkeletonCard } from '../../components/ui';
import { CourseCard, TeacherCard } from '../../components/cards';
import { Icon } from '../../components/Icon';
import { useMe, type ScreenProps } from '../../app/hooks';
import { navigate } from '../../router/hashRouter';
import * as sel from '../../data/selectors';
import { now, fmtTime } from '../../data/clock';
import { saveRecentSearch } from '../../services';
import { AVAIL_LABEL, chipsOf, defaultsFor, parseFilters, PRICE_MAX, PRICE_MIN, recentLabel, search, toQuery, type Filters, type Results } from '../../data/search';

const TILES = ['Guitar', 'Piano', 'Voice', 'Ukulele', 'Bass', 'Drums'];

function runSearch(userId: string, f: Filters, replace = false) {
  const query = toQuery(f);
  if (f.q || f.instruments.length) saveRecentSearch(userId, f.q || f.instruments.join(', ').toLowerCase(), query, recentLabel(f));
  navigate(`/s/search?${query}`, { replace });
}

export function S04Discover() {
  const { db, me } = useMe();
  const sp = sel.studentProfile(db, me.id);
  const [q, setQ] = useState('');
  const t = now();
  const fresh = db.offerings.filter((o) => o.status === 'published' && o.type !== 'single' && sel.isNewCourse(o, t)).sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  return (
    <Screen title="Discover" noNav>
      <div className="stack">
        <div className="stack-12">
          <h1 className="t-large-title" style={{ paddingTop: 8 }}>
            Discover
          </h1>
          <SearchField label="Search teachers and courses" placeholder="Instrument, genre or teacher" value={q} onChange={setQ} onSubmit={(v) => v.trim() && runSearch(me.id, defaultsFor(v, sp))} />
        </div>
        {!!sp?.recentSearches.length && (
          <section className="stack-6" aria-labelledby="recent-h">
            <h2 id="recent-h" className="section-label">
              Recent searches
            </h2>
            <div className="group">
              {sp.recentSearches.map((r) => (
                <ListRow key={r.query} title={r.q} subtitle={r.label} onClick={() => navigate(`/s/search?${r.query}`)} />
              ))}
            </div>
          </section>
        )}
        <section className="stack-12" aria-labelledby="browse-h">
          <h2 id="browse-h" className="section-title">
            Browse by instrument
          </h2>
          <div className="tile-grid">
            {TILES.map((i) => (
              <button key={i} type="button" className="tile" onClick={() => runSearch(me.id, { ...defaultsFor('', sp), level: undefined, format: undefined, instruments: [i] })}>
                <Icon name="music.note" size={24} />
                {i}
              </button>
            ))}
          </div>
        </section>
        {fresh.length > 0 && (
          <section className="stack-12">
            <SectionHeader title="New this week" />
            {fresh.map((o) => (
              <CourseCard key={o.id} db={db} off={o} onOpen={() => navigate(`/s/course/${o.id}`)} />
            ))}
          </section>
        )}
      </div>
    </Screen>
  );
}

export function S05SearchResults({ query }: ScreenProps) {
  const { db, me } = useMe();
  const sp = sel.studentProfile(db, me.id);
  const f = useMemo(() => parseFilters(query), [query]);
  const qs = toQuery(f);
  const [text, setText] = useState(f.q);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const offline = db.dev.offline;
  // Simulated request: skeletons appear only when results take longer than 300 ms.
  const [phase, setPhase] = useState<'loading' | 'skeleton' | 'done'>('loading');
  const [results, setResults] = useState<Results | null>(null);
  const savedAt = useRef<number>(now());
  const live = useMemo(() => search(db, f), [db, f]);
  useEffect(() => {
    if (offline) return;
    setPhase('loading');
    const sk = window.setTimeout(() => setPhase((p) => (p === 'loading' ? 'skeleton' : p)), 300);
    const done = window.setTimeout(() => {
      setPhase('done');
      savedAt.current = now();
    }, 550);
    return () => {
      window.clearTimeout(sk);
      window.clearTimeout(done);
    };
  }, [qs, offline]);
  useEffect(() => {
    if (phase === 'done' && !offline) setResults(live);
  }, [phase, live, offline]);
  useEffect(() => setText(f.q), [f.q]);

  const apply = (next: Filters) => navigate(`/s/search?${toQuery(next)}`, { replace: true });
  const chips = chipsOf(f);
  const area = sp?.approxArea ?? 'Austin, TX';
  const shown = offline ? results : phase === 'done' ? live : null;
  const busy = !offline && phase !== 'done';
  const relaxed = !shown || shown.count ? null : search(db, { ...f, level: undefined, format: undefined, min: undefined, max: undefined, avail: [], type: undefined });
  const onlineOnly = !shown || shown.count || f.format === 'online' ? null : search(db, { ...f, format: 'online' });
  const what = f.q || f.instruments.join(' and ') || 'matching';

  return (
    <Screen title="Discover" noNav>
      <div className="stack-16">
        <h1 className="t-large-title" style={{ paddingTop: 8 }}>
          Discover
        </h1>
        {offline && (
          <InlineAlert tone="warning" title="You're offline">
            Showing results saved at {fmtTime(savedAt.current)}. Booking needs a connection.
          </InlineAlert>
        )}
        <SearchField label="Search teachers and courses" placeholder="Instrument, genre or teacher" value={text} onChange={setText} onSubmit={(v) => runSearch(me.id, { ...f, q: v.trim() }, true)} />
        <div className="chips chips--scroll" role="group" aria-label="Filters">
          <button type="button" className="chip" onClick={() => setFiltersOpen(true)} aria-label={`Filters, ${chips.length} applied`}>
            <span className="chip__face">
              <Icon name="line.3.horizontal.decrease" size={18} />
              Filters{chips.length ? ` · ${chips.length}` : ''}
            </span>
          </button>
          {chips.map((c) => (
            <Chip key={c.key} label={c.label} removable onToggle={() => apply(c.remove(f))} />
          ))}
        </div>
        <div className="spread t-subhead">
          <span className="c-secondary" aria-live="polite">
            {busy ? `Searching near ${area}…` : `${shown?.count ?? 0} result${shown?.count === 1 ? '' : 's'} near ${area}`}
          </span>
          <span>Sort: Best match</span>
        </div>
        {busy ? (
          <div className="stack-16" aria-busy="true" aria-label="Loading results">
            {phase === 'skeleton' && [0, 1, 2].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : shown && shown.count === 0 ? (
          <div className="card" style={{ padding: 0 }}>
            <div className="stack-12" style={{ padding: '20px 16px 16px' }}>
              <span className="c-secondary">
                <Icon name="magnifyingglass" size={28} />
              </span>
              <h2 className="t-headline" style={{ fontSize: '1.06rem' }}>
                No {what} teachers near {area.replace(/, TX$/, '')}
                {f.level ? ` for ${f.level}s` : ''}
              </h2>
              <p className="t-body c-secondary">
                {onlineOnly && onlineOnly.count
                  ? `${onlineOnly.count} ${onlineOnly.count === 1 ? 'result is' : 'results are'} online. `
                  : ''}
                {relaxed && relaxed.count ? `Removing filters shows ${relaxed.count} result${relaxed.count === 1 ? '' : 's'}.` : 'Try another instrument or a different search.'}
              </p>
              {onlineOnly && onlineOnly.count > 0 && (
                <Button variant="gray" onClick={() => apply({ ...f, format: 'online' })}>
                  Show online teachers
                </Button>
              )}
              <Button variant="plain" onClick={() => apply({ q: f.q, instruments: [], avail: [] })}>
                Clear filters
              </Button>
            </div>
          </div>
        ) : shown ? (
          <>
            {shown.courses.length > 0 && (
              <section className="stack-12">
                <SectionHeader title="Courses" />
                {shown.courses.map((o) => (
                  <CourseCard key={o.id} db={db} off={o} onOpen={() => navigate(`/s/course/${o.id}`)} />
                ))}
              </section>
            )}
            {shown.teachers.length > 0 && (
              <section className="stack-12">
                <SectionHeader title="Teachers" />
                {shown.teachers.map((id) => (
                  <TeacherCard key={id} db={db} teacherId={id} onOpen={() => navigate(`/s/teacher/${id}`)} />
                ))}
              </section>
            )}
          </>
        ) : (
          <p className="t-body c-secondary">Results will appear when you are back online.</p>
        )}
      </div>
      {filtersOpen && <S06Filters initial={f} onClose={() => setFiltersOpen(false)} onApply={(nf) => { setFiltersOpen(false); apply(nf); }} />}
    </Screen>
  );
}

const FILTER_INSTRUMENTS = ['Guitar', 'Ukulele', 'Bass', 'Piano', 'Voice'];

function S06Filters({ initial, onClose, onApply }: { initial: Filters; onClose: () => void; onApply: (f: Filters) => void }) {
  const { db } = useMe();
  const [f, setF] = useState<Filters>(initial);
  const count = useMemo(() => search(db, f).count, [db, f]);
  const min = f.min ?? PRICE_MIN;
  const max = f.max ?? PRICE_MAX;
  const pct = (v: number) => ((v - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;
  const toggle = (k: 'instruments' | 'avail', v: string) => setF((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));
  return (
    <Sheet open large title="Filters" onCancel={onClose} action={{ label: 'Reset', onClick: () => setF({ q: f.q, instruments: [], avail: [] }) }}>
      <div className="stack-12">
        <h3 className="section-label">Instrument</h3>
        <div className="chips">
          {[...new Set([...FILTER_INSTRUMENTS, ...f.instruments])].map((i) => (
            <Chip key={i} label={i} selected={f.instruments.includes(i)} xWhenSelected onToggle={() => toggle('instruments', i)} />
          ))}
        </div>
      </div>
      <div className="stack-12">
        <h3 className="section-label">Level</h3>
        <Segmented
          label="Level"
          value={f.level ?? 'any'}
          onChange={(v) => setF((x) => ({ ...x, level: v === 'any' ? undefined : (v as Filters['level']) }))}
          options={[
            { value: 'any', label: 'Any' },
            { value: 'beginner', label: 'Beginner' },
            { value: 'intermediate', label: 'Intermediate' },
            { value: 'advanced', label: 'Advanced' },
          ]}
        />
      </div>
      <div className="stack-12">
        <h3 className="section-label">Where</h3>
        <Segmented
          label="Where"
          value={f.format ?? 'either'}
          onChange={(v) => setF((x) => ({ ...x, format: v === 'either' ? undefined : (v as Filters['format']) }))}
          options={[
            { value: 'online', label: 'Online' },
            { value: 'in_person', label: 'In person' },
            { value: 'either', label: 'Either' },
          ]}
        />
      </div>
      <div className="stack-8">
        <div className="spread">
          <h3 className="section-label" style={{ margin: 0 }} id="price-h">
            Price per lesson
          </h3>
          <span className="t-headline">
            ${min} to ${max}
          </span>
        </div>
        <div className="range">
          <span className="range__track" />
          <span className="range__fill" style={{ left: `${pct(min)}%`, right: `${100 - pct(max)}%` }} />
          <input type="range" min={PRICE_MIN} max={PRICE_MAX} step={5} value={min} aria-label="Minimum price per lesson" aria-valuetext={`$${min}`} onChange={(e) => setF((x) => ({ ...x, min: Math.min(Number(e.target.value), max - 5) }))} />
          <input type="range" min={PRICE_MIN} max={PRICE_MAX} step={5} value={max} aria-label="Maximum price per lesson" aria-valuetext={`$${max}`} onChange={(e) => setF((x) => ({ ...x, max: Math.max(Number(e.target.value), min + 5) }))} />
        </div>
      </div>
      <div className="stack-12">
        <h3 className="section-label">Availability</h3>
        <div className="chips">
          {Object.entries(AVAIL_LABEL).map(([k, label]) => (
            <Chip key={k} label={label} selected={f.avail.includes(k)} xWhenSelected onToggle={() => toggle('avail', k)} />
          ))}
        </div>
      </div>
      <div className="stack-12">
        <h3 className="section-label">Lesson type</h3>
        <Segmented
          label="Lesson type"
          value={f.type ?? 'both'}
          onChange={(v) => setF((x) => ({ ...x, type: v === 'both' ? undefined : (v as Filters['type']) }))}
          options={[
            { value: 'courses', label: 'Courses' },
            { value: 'single', label: 'Single lessons' },
            { value: 'both', label: 'Both' },
          ]}
        />
      </div>
      <div style={{ position: 'sticky', bottom: 0, paddingTop: 12, background: 'var(--bg-grouped)' }}>
        <Button onClick={() => onApply(f)}>
          Show {count} result{count === 1 ? '' : 's'}
        </Button>
      </div>
    </Sheet>
  );
}
