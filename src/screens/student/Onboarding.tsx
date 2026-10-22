// Flow 01 student path: S01 Interests, S02 Level and Format.
import { useState } from 'react';
import { GlassText, Screen, Sheet } from '../../layout/layout';
import { Button, Chip, ListRow, Radio, Segmented, StepIndicator, TextField } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useMe } from '../../app/hooks';
import { navigate } from '../../router/hashRouter';
import * as sel from '../../data/selectors';
import { GENRES, INSTRUMENTS } from '../../data/seed';
import { saveInterests, saveLevelFormat } from '../../services';
import type { Format, StudentLevel } from '../../data/schema';

export function S01Interests() {
  const { db, me } = useMe();
  const sp = sel.studentProfile(db, me.id);
  const [instruments, setInstruments] = useState<string[]>(sp?.instruments ?? []);
  const [genres, setGenres] = useState<string[]>(sp?.genres ?? []);
  const [error, setError] = useState(false);
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const next = () => {
    if (!instruments.length) {
      setError(true);
      return;
    }
    saveInterests(me.id, instruments, genres);
    navigate('/s/onboarding/level');
  };
  return (
    <Screen title="What do you want to play?" back trailing={<GlassText onClick={() => navigate('/s/onboarding/level')}>Skip</GlassText>} bottom={<Button onClick={next}>Continue</Button>}>
      <div className="stack">
        <StepIndicator total={2} current={1} label="What you want to play" />
        <div className="title-block" style={{ gap: 18 }}>
          <h1 className="t-title1">What do you want to play?</h1>
          <p className="t-body c-secondary">Pick one or more. This shapes what Discover shows first.</p>
        </div>
        <div className="stack-6">
          <h2 className="sr-only">Instruments</h2>
          <div className="chips" role="group" aria-label="Instruments" aria-describedby={error ? 'instr-err' : undefined}>
            {INSTRUMENTS.map((i) => (
              <Chip
                key={i}
                label={i}
                selected={instruments.includes(i)}
                onToggle={() => {
                  toggle(instruments, setInstruments, i);
                  setError(false);
                }}
              />
            ))}
          </div>
          {error && (
            <p id="instr-err" className="field__error" role="alert">
              <Icon name="exclamationmark.circle.fill" size={16} />
              Choose at least one instrument
            </p>
          )}
        </div>
        <div className="stack-6">
          <h2 className="section-label">Genres · Optional</h2>
          <div className="chips" role="group" aria-label="Genres, optional">
            {GENRES.map((g) => (
              <Chip key={g} label={g} selected={genres.includes(g)} onToggle={() => toggle(genres, setGenres, g)} />
            ))}
          </div>
        </div>
      </div>
    </Screen>
  );
}

const LEVELS: { value: StudentLevel; title: string; sub: string }[] = [
  { value: 'never', title: 'Never played', sub: 'I am starting from zero' },
  { value: 'basics', title: 'Know a few basics', sub: 'A few chords or songs' },
  { value: 'comfortable', title: 'Comfortable', sub: 'I play regularly' },
  { value: 'advanced', title: 'Advanced', sub: 'Working on technique or performance' },
];

export function S02LevelFormat() {
  const { db, me } = useMe();
  const sp = sel.studentProfile(db, me.id);
  const [level, setLevel] = useState<StudentLevel>(sp?.level ?? 'never');
  const [format, setFormat] = useState<Format>(sp?.format ?? 'either');
  const [area, setArea] = useState<string | undefined>(sp?.approxArea ?? 'Austin, TX');
  const [editArea, setEditArea] = useState(false);
  const [draftArea, setDraftArea] = useState(area ?? '');
  const finish = () => {
    saveLevelFormat(me.id, level, format, area);
    navigate('/s/home', { replace: true });
  };
  return (
    <Screen title="Where are you starting?" back trailing={<GlassText onClick={finish}>Skip</GlassText>} bottom={<Button onClick={finish}>Show me teachers</Button>}>
      <div className="stack">
        <StepIndicator total={2} current={2} label="Level and format" />
        <h1 className="t-title1">Where are you starting?</h1>
        <div className="group" role="radiogroup" aria-label="Your level">
          {LEVELS.map((l) => (
            <button key={l.value} type="button" role="radio" aria-checked={level === l.value} className="row" onClick={() => setLevel(l.value)}>
              <span className="row__text">
                <span className="row__title">{l.title}</span>
                <span className="row__subtitle">{l.sub}</span>
              </span>
              <Radio on={level === l.value} />
            </button>
          ))}
        </div>
        <div className="stack-12">
          <h2 className="section-title">How do you want to learn?</h2>
          <Segmented
            label="How do you want to learn"
            value={format}
            onChange={setFormat}
            options={[
              { value: 'online', label: 'Online' },
              { value: 'in_person', label: 'In person' },
              { value: 'either', label: 'Either' },
            ]}
          />
          <div>
            <div className="group">
              <ListRow
                title={area ? `Near ${area}` : 'No location set'}
                subtitle="From your approximate location"
                value="Change"
                chevron
                onClick={() => {
                  setDraftArea(area ?? '');
                  setEditArea(true);
                }}
              />
            </div>
            <p className="helper">Location is used only to sort in-person teachers by distance. Exact address is never shared.</p>
          </div>
        </div>
      </div>
      <Sheet
        open={editArea}
        title="Approximate location"
        onCancel={() => setEditArea(false)}
        action={{
          label: 'Save',
          onClick: () => {
            setArea(draftArea.trim() || undefined);
            setEditArea(false);
          },
        }}
      >
        <TextField label="City or neighborhood" value={draftArea} onChange={setDraftArea} autoComplete="address-level2" enterKeyHint="done" helper="Leave empty to skip. Only in-person teachers use it." />
      </Sheet>
    </Screen>
  );
}
