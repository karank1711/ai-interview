import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  VideoCameraIcon,
  ChartBarIcon,
  SparklesIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  InformationCircleIcon,
  EnvelopeIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import AnimatedBrain from './AnimatedBrain';
import RocketLaunch from './RocketLaunch';
import { useSidebar } from '../context/SidebarContext';

const DESKTOP_NAV_ITEMS = [
  { name: 'Home', href: '/', icon: HomeIcon },
  { name: 'Interview', href: '/interview', icon: VideoCameraIcon },
  { name: 'Features', href: '/features', icon: SparklesIcon },
  { name: 'Results', href: '/progress', icon: ChartBarIcon },
  { name: 'Profile', href: '/profile', icon: UserCircleIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
  { name: 'About', href: '/about', icon: InformationCircleIcon },
  { name: 'Contact Us', href: '/contact', icon: EnvelopeIcon },
];

const MOBILE_NAV_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Interview', href: '/interview', icon: VideoCameraIcon },
  { name: 'Features', href: '/features', icon: SparklesIcon },
  { name: 'Results', href: '/progress', icon: ChartBarIcon },
  { name: 'About', href: '/about', icon: InformationCircleIcon },
  { name: 'Profile', href: '/profile', icon: UserCircleIcon },
  { name: 'Contact Us', href: '/contact', icon: EnvelopeIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

function isNavActive(pathname, item) {
  if (item.name === 'Home' || item.name === 'Dashboard') {
    return pathname === '/' || pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  }
  if (item.name === 'Interview') {
    if (pathname.includes('/report')) return false;
    return pathname === '/interview' || pathname.startsWith('/interview/');
  }
  if (item.name === 'Results') {
    return (
      pathname.startsWith('/progress')
      || pathname.startsWith('/feedback')
      || pathname.startsWith('/results')
      || pathname.includes('/report')
    );
  }
  if (item.name === 'Features') return pathname === '/features';
  if (item.name === 'Profile') return pathname === '/profile';
  if (item.name === 'Settings') return pathname === '/settings';
  if (item.name === 'About') return pathname === '/about';
  if (item.name === 'Contact Us') return pathname === '/contact';
  return pathname === item.href;
}

function NavList({ items, pathname, onNavigate }) {
  return items.map((item) => {
    const active = isNavActive(pathname, item);
    return (
      <Link
        key={item.name}
        to={item.href}
        onClick={onNavigate}
        className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
          active
            ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        }`}
      >
        <item.icon className={`h-5 w-5 ${active ? 'text-violet-600 dark:text-violet-300' : ''}`} />
        {item.name}
      </Link>
    );
  });
}

export default function Sidebar() {
  const { open, close } = useSidebar();
  const location = useLocation();

  const handleNavigate = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) close();
  };

  return (
    <aside
      className={`fixed bottom-0 left-0 top-16 z-40 w-64 border-r border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-[#0b1224] max-sm:p-3 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
      style={{ transition: 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)' }}
    >
      <div className="flex h-full flex-col">
        <div className="mb-8 px-1 max-sm:mb-3">
          <Link to="/" onClick={handleNavigate} className="flex min-w-0 cursor-pointer items-center gap-2">
            <AnimatedBrain className="h-12 w-12 shrink-0 max-sm:h-9 max-sm:w-9" />
            <span className="text-lg font-bold leading-none text-slate-800 dark:text-white">
              Interview<span className="text-violet-600">IQ</span>
            </span>
          </Link>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto sm:hidden">
          <NavList items={MOBILE_NAV_ITEMS} pathname={location.pathname} onNavigate={handleNavigate} />
        </nav>
        <nav className="hidden min-h-0 flex-1 space-y-1 overflow-y-auto sm:block">
          <NavList items={DESKTOP_NAV_ITEMS} pathname={location.pathname} onNavigate={handleNavigate} />
        </nav>

        <div className="relative mt-6 overflow-visible rounded-2xl bg-white p-4 shadow-md ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700 max-sm:mt-3 max-sm:p-3">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold leading-tight text-slate-800 dark:text-white">
                Upgrade Your Interview Skills
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Practice. Improve. Succeed.</p>
              <Link
                to="/interview"
                onClick={handleNavigate}
                className="mt-4 inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-blue-500 px-4 py-2 text-sm font-medium text-white max-sm:mt-2"
              >
                Start Now
                <ArrowRightIcon className="ml-1.5 h-4 w-4" />
              </Link>
            </div>
            <RocketLaunch className="h-24 w-14 shrink-0 max-sm:h-16 max-sm:w-10 sm:h-28 sm:w-16" />
          </div>
        </div>
      </div>
    </aside>
  );
}
