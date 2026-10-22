import { Component, lazy, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { useDB } from '../data/store';
import * as sel from '../data/selectors';
import type { DB, Role } from '../data/schema';
import { match, navigate, useLocation, type Location } from '../router/hashRouter';
import { ROLE_ROOT, ROUTES, TEACHER_STEPS, type RouteDef } from '../router/routes';
import { TabBar, Toasts, setRoleRoot } from '../layout/layout';
import { AuthScreens } from '../screens/shared/Auth';
import { expireHolds, passIdCheck, setLastRoute, switchRole } from '../services';
import { now } from '../data/clock';
import { toast } from '../data/ui';
import { Button } from '../components/ui';

const StudentScreens = lazy(() => import('../screens/student'));
const TeacherScreens = lazy(() => import('../screens/teacher'));
const SharedScreens = lazy(() => import('../screens/shared/Shared'));
const DevPanel = lazy(() => import('../dev/DevPanel'));

interface Resolved {
  def?: RouteDef;
  params: Record<string, string>;
  redirect?: string;
  message?: string;
}

function roleHome(db: DB, role: Role | null | undefined, userId: string): string {
  if (!role) return '/role';
  const u = sel.user(db, userId)!;
  return u.lastRouteByRole[role] ?? ROLE_ROOT[role];
}

function resolve(db: DB, loc: Location): Resolved {
  const me = sel.currentUser(db);
  let def: RouteDef | undefined;
  let params: Record<string, string> = {};
  for (const r of ROUTES) {
    const p = match(r.pattern, loc.path);
    if (p) {
      def = r;
      params = p;
      break;
    }
  }
  if (!me) {
    if (def?.public) return { def, params };
    return { params, redirect: '/welcome' };
  }
  if (loc.path === '/' || !def) {
    if (loc.path !== '/') return { params, redirect: me.activeRole ? ROLE_ROOT[me.activeRole] : '/role', message: 'That page is not available' };
    return { params, redirect: me.roles.length ? roleHome(db, me.activeRole, me.id) : '/role' };
  }
  if (def.public) return { params, redirect: me.roles.length ? roleHome(db, me.activeRole, me.id) : '/role' };
  if (!me.roles.length && def.screen !== 'A03') return { params, redirect: '/role' };
  if (def.role && !me.roles.includes(def.role)) {
    return { params, redirect: ROLE_ROOT[me.activeRole ?? me.roles[0]], message: 'That page is not available' };
  }
  const role = def.role ?? me.activeRole;
  if (role === 'student' && def.role === 'student') {
    const sp = sel.studentProfile(db, me.id);
    if (!sp?.onboardingComplete && def.screen !== 'S01' && def.screen !== 'S02') return { params, redirect: '/s/onboarding/interests' };
  }
  if (role === 'teacher' && def.role === 'teacher') {
    const tp = sel.teacherProfile(db, me.id);
    if (tp && !tp.setupComplete && !/^T0[1-5]$/.test(def.screen)) return { params, redirect: `/t/onboarding/${TEACHER_STEPS[Math.min(tp.setupStep, 5) - 1]}` };
  }
  return { def, params };
}

class ErrorBoundary extends Component<{ children: ReactNode; home: string }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(err: unknown) {
    console.error(err);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="screen screen--no-nav">
        <div className="empty">
          <h1 className="t-title3">Something went wrong</h1>
          <p className="empty__msg">This screen could not be shown. Your data is safe.</p>
          <Button
            onClick={() => {
              this.setState({ error: false });
              navigate(this.props.home, { replace: true });
            }}
          >
            Go to the start
          </Button>
        </div>
      </main>
    );
  }
}

export default function App() {
  const db = useDB();
  const loc = useLocation();
  const me = sel.currentUser(db);
  const r = useMemo(() => resolve(db, loc), [db, loc]);

  useEffect(() => {
    if (r.redirect) {
      navigate(r.redirect, { replace: true });
      if (r.message) toast(r.message, { icon: 'info' });
    }
  }, [r.redirect, r.message]);

  // A deep link into the user's other role switches role first (with a toast).
  const needSwitch = !!(me && r.def?.role && me.activeRole !== r.def.role && me.roles.includes(r.def.role));
  useEffect(() => {
    if (needSwitch && me && r.def?.role) {
      switchRole(me.id, r.def.role);
      toast(`Switched to ${r.def.role}`, { icon: 'info' });
    }
  }, [needSwitch, me, r.def]);

  // Remember the last tab route per role ("last role and tab").
  useEffect(() => {
    if (!me || !r.def?.tabbar || !me.activeRole) return;
    if (r.def.role && r.def.role !== me.activeRole) return;
    setLastRoute(me.id, me.activeRole, loc.path + (loc.search ? `?${loc.search}` : ''));
  }, [me, r.def, loc.path, loc.search]);

  // Time-based rules read the same clock: hold expiry and the simulated ID check.
  useEffect(() => {
    const id = window.setInterval(expireHolds, 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    for (const tp of db.teacherProfiles) if (tp.idStatus === 'pending' && tp.idCheckStartedAt && now() - tp.idCheckStartedAt > 5000) passIdCheck(tp.userId);
  }, [db]);

  const role: Role = (r.def?.role ?? me?.activeRole ?? 'student') as Role;
  const home = me?.activeRole ? ROLE_ROOT[me.activeRole] : '/welcome';
  setRoleRoot(home);

  let content: ReactNode = null;
  const def = r.redirect ? undefined : r.def;
  if (def && !needSwitch) {
    const props = { screen: def.screen, params: r.params, query: loc.query };
    if (/^A0[1-4]$/.test(def.screen)) content = <AuthScreens {...props} />;
    else if (def.screen.startsWith('A')) content = <SharedScreens {...props} />;
    else if (def.role === 'student') content = <StudentScreens {...props} />;
    else if (def.role === 'teacher') content = <TeacherScreens {...props} />;
  }
  const activeTab = def?.tab === 'role-root' ? (role === 'student' ? 'home' : 'today') : def?.tab;

  return (
    <div className="app">
      <ErrorBoundary home={home} key={loc.path}>
        <Suspense fallback={<main className="screen" aria-busy="true" />}>
          <div key={loc.path}>{content}</div>
        </Suspense>
      </ErrorBoundary>
      {def?.tabbar && me?.activeRole && <TabBar role={me.activeRole} active={activeTab} />}
      <Toasts />
      <Suspense fallback={null}>
        <DevPanel />
      </Suspense>
    </div>
  );
}
