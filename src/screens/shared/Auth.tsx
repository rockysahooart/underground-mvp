// Flow 01 entry screens: A01 Welcome, A02 Create Account, A03 Choose Role, A04 Sign In.
import { useRef, useState } from 'react';
import { Screen } from '../../layout/layout';
import { Button, Radio, TextField } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { navigate } from '../../router/hashRouter';
import { chooseRole, createAccount, signIn, signInWithApple } from '../../services';
import { useDB } from '../../data/store';
import * as sel from '../../data/selectors';
import type { Role } from '../../data/schema';

type P = { screen: string; params: Record<string, string>; query: URLSearchParams };

export function AuthScreens({ screen }: P) {
  if (screen === 'A01') return <A01Welcome />;
  if (screen === 'A02') return <A02CreateAccount />;
  if (screen === 'A03') return <A03ChooseRole />;
  return <A04SignIn />;
}

function useApple() {
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    const r = await signInWithApple();
    setLoading(false);
    if (r.ok) navigate(r.value.isNew ? '/role' : '/', { replace: true });
  };
  return { loading, run };
}

const AppleIcon = <Icon name="apple.logo" size={20} />;

function A01Welcome() {
  const apple = useApple();
  return (
    <Screen title="Welcome" plain noNav fit bottomGlass={false}>
      <div className="stack" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 0, paddingBottom: 220 }}>
        <div
          aria-hidden="true"
          style={{ width: 96, height: 96, borderRadius: '50%', border: '3px solid var(--tint-primary)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 30, marginBottom: 76 }}
        >
          UG
        </div>
        <h1 className="t-wordmark-lg">Scale</h1>
        <p className="t-body c-secondary" style={{ marginTop: 18 }}>
          by Underground
        </p>
        <p className="t-headline" style={{ fontSize: '1.18rem', lineHeight: 1.3, marginTop: 28, maxWidth: 300, fontWeight: 500 }}>
          Learn from independent music teachers, online or near you.
        </p>
      </div>
      <div className="fixed-col" style={{ bottom: 0, padding: '0 16px max(24px, env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-primary)' }}>
        <Button onClick={apple.run} loading={apple.loading} icon={AppleIcon}>
          Sign in with Apple
        </Button>
        <Button variant="gray" onClick={() => navigate('/signup')}>
          Continue with email
        </Button>
        <Button variant="plain" onClick={() => navigate('/signin')}>
          I already have an account
        </Button>
        <p className="t-footnote c-secondary" style={{ textAlign: 'center', padding: '4px 0 6px' }}>
          By continuing you agree to the Terms and Privacy Policy.
        </p>
      </div>
    </Screen>
  );
}

function A04SignIn() {
  const apple = useApple();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pwRef = useRef<HTMLInputElement>(null);
  const submit = async () => {
    setLoading(true);
    const r = await signIn(email, password);
    setLoading(false);
    if (!r.ok) {
      setError(r.message);
      pwRef.current?.focus();
      return;
    }
    navigate('/', { replace: true });
  };
  return (
    <Screen
      title="Sign in"
      navTitle
      ownHeading
      back
      bottom={
        <>
          <Button onClick={submit} loading={loading}>
            Sign in
          </Button>
          <p className="bottombar__note">You return to the role and tab you used last.</p>
        </>
      }
    >
      <form
        className="stack-16"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h1 className="t-title1">Welcome back</h1>
        <Button onClick={apple.run} loading={apple.loading} icon={AppleIcon}>
          Sign in with Apple
        </Button>
        <p className="t-subhead c-secondary center">or</p>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          enterKeyHint="next"
          value={email}
          onChange={(v) => {
            setEmail(v);
            setError(null);
          }}
        />
        <TextField
          ref={pwRef}
          label="Password"
          reveal
          autoComplete="current-password"
          enterKeyHint="done"
          value={password}
          onChange={(v) => {
            setPassword(v);
            setError(null);
          }}
          error={error}
        />
        <div>
          <button type="button" className="link-btn" aria-disabled="true" aria-describedby="forgot-soon">
            Forgot password?
          </button>{' '}
          <span id="forgot-soon" className="t-footnote c-tertiary">
            Coming soon
          </span>
        </div>
        <button type="submit" hidden />
      </form>
    </Screen>
  );
}

function validate(name: string, email: string, password: string, dob: string) {
  const errs: Record<string, string> = {};
  if (!name.trim()) errs.name = 'Enter your full name.';
  if (!email.trim()) errs.email = 'Enter your email.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Enter an email like name@example.com.';
  if (password.length < 8) errs.password = 'Use at least 8 characters.';
  if (!dob) errs.dob = 'Enter your date of birth.';
  else if (new Date(dob).getTime() > Date.now()) errs.dob = 'Enter a date in the past.';
  return errs;
}

function A02CreateAccount() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [inUse, setInUse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refs = { name: useRef<HTMLInputElement>(null), email: useRef<HTMLInputElement>(null), password: useRef<HTMLInputElement>(null), dob: useRef<HTMLInputElement>(null) };
  const errs = validate(name, email, password, dob);
  const show = (k: string) => (submitted || touched[k] ? errs[k] : undefined);
  const emailInUse = inUse !== null && inUse === email.trim().toLowerCase();
  const submit = async () => {
    setSubmitted(true);
    const first = (['name', 'email', 'password', 'dob'] as const).find((k) => errs[k]);
    if (first) {
      refs[first].current?.focus();
      return;
    }
    if (emailInUse) return;
    setLoading(true);
    const r = await createAccount({ name, email, password, dateOfBirth: dob });
    setLoading(false);
    if (!r.ok) {
      if (r.code === 'email_in_use') setInUse(email.trim().toLowerCase());
      return;
    }
    navigate('/role');
  };
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));
  return (
    <Screen
      title="Create your account"
      back
      bottom={
        <Button onClick={submit} loading={loading} disabled={emailInUse} describedBy={emailInUse ? 'in-use' : undefined}>
          Create account
        </Button>
      }
    >
      <form
        className="stack-16"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
      >
        <h1 className="t-title1">Create your account</h1>
        <TextField ref={refs.name} label="Full name" autoComplete="name" enterKeyHint="next" value={name} onChange={setName} onBlur={blur('name')} error={show('name')} />
        <TextField ref={refs.email} label="Email" type="email" inputMode="email" autoComplete="email" enterKeyHint="next" value={email} onChange={setEmail} onBlur={blur('email')} error={show('email')} />
        <TextField
          ref={refs.password}
          label="Password"
          reveal
          autoComplete="new-password"
          enterKeyHint="next"
          value={password}
          onChange={setPassword}
          onBlur={blur('password')}
          error={show('password')}
          helper="At least 8 characters."
        />
        <TextField
          ref={refs.dob}
          label="Date of birth"
          type="date"
          autoComplete="bday"
          value={dob}
          onChange={setDob}
          onBlur={blur('dob')}
          error={show('dob')}
          helper="Used to confirm your age. Students under 18 book with a parent or guardian."
          max="2026-12-31"
        />
        {emailInUse && (
          <p id="in-use" className="t-body c-secondary" role="alert">
            Is this you?{' '}
            <button type="button" className="semibold" style={{ color: 'var(--text-primary)', minHeight: 44 }} onClick={() => navigate('/signin')}>
              Sign in instead
            </button>
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Screen>
  );
}

function A03ChooseRole() {
  const db = useDB();
  const me = sel.currentUser(db);
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState(false);
  const options: { value: Role; title: string; sub: string; icon: string }[] = [
    { value: 'student', title: 'I want to learn', sub: 'Find a teacher, book lessons, track progress', icon: 'music.note' },
    { value: 'teacher', title: 'I want to teach', sub: 'Sell lessons and courses, manage students, get paid', icon: 'person.fill' },
  ];
  const go = () => {
    if (!role || !me) {
      setError(true);
      return;
    }
    chooseRole(me.id, role);
    navigate(role === 'student' ? '/s/onboarding/interests' : '/t/onboarding/type');
  };
  return (
    <Screen title="How will you use Scale?" back bottom={<Button onClick={go}>Continue</Button>}>
      <div className="stack">
        <div className="title-block">
          <h1 className="t-title1">How will you use Scale?</h1>
          <p className="t-body c-secondary">Choose one to start. You can add the other in Account at any time without a new sign-in.</p>
        </div>
        <div className="stack-16" role="radiogroup" aria-label="Role" aria-describedby={error ? 'role-err' : undefined}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={role === o.value}
              className="choice-card"
              onClick={() => {
                setRole(o.value);
                setError(false);
              }}
            >
              <span className="icon-circle">
                <Icon name={o.icon} size={22} />
              </span>
              <span className="row__text">
                <span className="t-headline" style={{ fontSize: '1.06rem' }}>
                  {o.title}
                </span>
                <span className="t-body c-secondary">{o.sub}</span>
              </span>
              <Radio on={role === o.value} />
            </button>
          ))}
        </div>
        {error && (
          <p id="role-err" className="field__error" role="alert">
            <Icon name="exclamationmark.circle.fill" size={16} />
            Choose how you want to use Scale to continue.
          </p>
        )}
      </div>
    </Screen>
  );
}
