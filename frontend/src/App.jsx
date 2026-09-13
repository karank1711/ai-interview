import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Component, lazy, Suspense, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { markRouteChange, perfLog } from './utils/perf';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Sidebar from './components/Sidebar';
import { SidebarProvider, useSidebar } from './context/SidebarContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AuthCallback from './pages/AuthCallback';
import { hasOAuthReturnParams } from './lib/supabase';
import { PopupProvider } from './components/AppPopup';
import ComingSoonPage from './components/ComingSoonPage';
import { authService } from './services/authService';
import { ThemeProvider } from './context/ThemeContext';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const DashboardDetails = lazy(() => import('./pages/DashboardDetails'));
const InterviewRoom = lazy(() => import('./pages/InterviewRoom'));
const Results = lazy(() => import('./pages/Results'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const About = lazy(() => import('./pages/About'));
const Features = lazy(() => import('./pages/Features'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Contact = lazy(() => import('./pages/Contact'));
const AiQuestions = lazy(() => import('./pages/AiQuestions'));
const MockTest = lazy(() => import('./pages/MockTest'));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'));
const ProgressTracking = lazy(() => import('./pages/ProgressTracking'));

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <ComingSoonPage
          title="Page failed to load"
          description="Use the sidebar or the browser Back button to return to an existing page. A refresh is not required."
        />
      );
    }
    return this.props.children;
  }
}

function OAuthReturnGate({ setUser, children }) {
  const location = useLocation();
  if (hasOAuthReturnParams(location.search)) {
    return <AuthCallback setUser={setUser} />;
  }
  return children;
}

function PageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-bg">
      <motion.div
        className="w-16 h-16 border-4 border-white border-t-transparent rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const bootStarted = performance.now();

    (async () => {
      try {
        const peeked = await authService.peekLocalUser();
        if (!mounted) return;
        setUser(peeked.user);
        setLoading(false);
        perfLog('first-shell-render', `${Math.round(performance.now() - bootStarted)}ms`);
        if (!peeked.session) return;
        try {
          const fullUser = await authService.hydrateAppUser(peeked.session);
          if (!mounted) return;
          setUser(fullUser);
          perfLog('profile-ready', `${Math.round(performance.now() - bootStarted)}ms`);
        } catch {
          if (!mounted) return;
          const again = await authService.peekLocalUser();
          if (!again.session) setUser(null);
        }
      } catch {
        if (!mounted) return;
        setUser(null);
        setLoading(false);
      }
    })();

    const subscription = authService.onAuthStateChange((sessionUser) => {
      if (!mounted) return;
      setUser(sessionUser);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    void import('./pages/Dashboard');
  }, [user]);

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  if (loading) {
    return (
      <ThemeProvider userId={user?.id}>
        <PageSpinner />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider userId={user?.id}>
      <Router>
        <PopupProvider>
          <AppShell user={user} logout={logout}>
            <Routes>
          <Route
            path="/"
            element={
              <OAuthReturnGate setUser={setUser}>
                <Home user={user} />
              </OAuthReturnGate>
            }
          />
          <Route path="/about" element={<About />} />
          <Route path="/features" element={<Features />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/contact" element={<Contact />} />
          
          <Route
            path="/login"
            element={
              <OAuthReturnGate setUser={setUser}>
                {!user ? <Login setUser={setUser} /> : <Navigate to="/" />}
              </OAuthReturnGate>
            }
          />
          <Route
            path="/signup"
            element={
              <OAuthReturnGate setUser={setUser}>
                {!user ? <Signup setUser={setUser} /> : <Navigate to="/" />}
              </OAuthReturnGate>
            }
          />
          <Route
            path="/auth/callback"
            element={<AuthCallback setUser={setUser} />}
          />
          
          <Route 
            path="/dashboard" 
            element={user ? <Home user={user} /> : <Navigate to="/login" />} 
          />
          <Route
            path="/dashboard/details"
            element={user ? <DashboardDetails /> : <Navigate to="/login" />}
          />
          <Route
            path="/interview"
            element={user ? <Dashboard user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/interview/setup"
            element={user ? <Dashboard user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/interview/report/:id"
            element={user ? <Results user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/interview/:id/*"
            element={user ? <InterviewRoom user={user} /> : <Navigate to="/login" />}
          />
          <Route 
            path="/results/:id" 
            element={user ? <Results user={user} /> : <Navigate to="/login" />} 
          />
          <Route
            path="/profile"
            element={user ? <Profile user={user} setUser={setUser} /> : <Navigate to="/login" />}
          />
          <Route
            path="/settings"
            element={user ? <Settings user={user} setUser={setUser} /> : <Navigate to="/login" />}
          />
          <Route
            path="/ai-questions"
            element={user ? <AiQuestions /> : <Navigate to="/login" />}
          />
          <Route
            path="/mock-test"
            element={user ? <MockTest /> : <Navigate to="/login" />}
          />
          <Route
            path="/feedback"
            element={user ? <FeedbackPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/progress"
            element={user ? <ProgressTracking /> : <Navigate to="/login" />}
          />
          
          <Route
            path="*"
            element={
              <ComingSoonPage
                title="Page not found"
                description="This route is not available. Choose an existing page from the sidebar or use the browser Back button."
              />
            }
          />
            </Routes>
          </AppShell>
        </PopupProvider>
      </Router>
    </ThemeProvider>
  );
}

function shouldShowSidebar(pathname, interviewSession) {
  if (interviewSession) return false;
  if (pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth/')) return false;
  return true;
}

function AppShell({ user, logout, children }) {
  const location = useLocation();
  const { pathname, key } = location;
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);
  useEffect(() => {
    markRouteChange(pathname);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);
  const interviewSession = /\/interview\/[^/]+\/session\/?$/.test(pathname);
  const showSidebar = shouldShowSidebar(pathname, interviewSession);
  return (
    <SidebarProvider>
      <AppShellLayout
        user={user}
        logout={logout}
        interviewSession={interviewSession}
        showSidebar={showSidebar}
        routeKey={key}
      >
        {children}
      </AppShellLayout>
    </SidebarProvider>
  );
}

function AppShellLayout({ user, logout, interviewSession, showSidebar, routeKey, children }) {
  const { open, close } = useSidebar();
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  ));

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const contentShift = showSidebar && open && isDesktop ? '16rem' : '0rem';
  return (
    <div
        className={`${interviewSession ? 'h-dvh overflow-hidden' : 'min-h-screen'} w-full max-w-full overflow-x-clip bg-gray-50 dark:bg-[#070b16] transition-colors duration-300`}
    >
      <Navbar user={user} logout={logout} showSidebarToggle={showSidebar} />
      {showSidebar && open && !isDesktop ? (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          className="fixed inset-0 top-16 z-30 cursor-pointer bg-slate-900/40"
          onClick={close}
        />
      ) : null}
      {showSidebar ? <Sidebar /> : null}
      <div
        className="min-h-[calc(100vh-4rem)] min-w-0 overflow-x-clip"
        style={{
          marginLeft: contentShift,
          transition: isDesktop ? 'margin-left 420ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
        }}
      >
        <RouteErrorBoundary resetKey={routeKey}>
          <Suspense fallback={<PageSpinner />}>
            {children}
          </Suspense>
        </RouteErrorBoundary>
        {interviewSession ? null : <Footer />}
      </div>
    </div>
  );
}

export default App;
