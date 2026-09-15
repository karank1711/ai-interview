import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  AcademicCapIcon,
  ChartBarIcon,
  UserIcon,
  ChevronDownIcon,
  VideoCameraIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { useSidebar } from '../context/SidebarContext';
import AnimatedBrain from './AnimatedBrain';
import UserAvatar from './UserAvatar';
import ThemeToggle from './ThemeToggle';

const Navbar = ({ user, logout, showSidebarToggle = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const location = useLocation();
  const sidebar = useSidebar();

  const mobileNavigation = [
    { name: 'Home', href: '/', icon: AcademicCapIcon },
    { name: 'Features', href: '/features', icon: ChartBarIcon },
    { name: 'About', href: '/about', icon: UserCircleIcon },
    { name: 'Contact', href: '/contact', icon: UserIcon },
  ];

  const desktopNavigation = [
    { name: 'Home', href: '/', icon: AcademicCapIcon },
    { name: 'Interview', href: '/interview', icon: VideoCameraIcon },
    { name: 'Interview Friend', href: '/interview-friend', icon: ChatBubbleLeftRightIcon },
    { name: 'Features', href: '/features', icon: ChartBarIcon },
    { name: 'About', href: '/about', icon: UserCircleIcon },
    { name: 'Contact', href: '/contact', icon: UserIcon },
  ];

  const isNavItemActive = (item) => {
    const path = location.pathname;
    if (item.name === 'Home') {
      return path === '/' || path === '/dashboard' || path.startsWith('/dashboard/');
    }
    if (item.name === 'Interview') {
      if (path.includes('/report')) return false;
      if (path.startsWith('/interview-friend')) return false;
      return path === '/interview' || path.startsWith('/interview/');
    }
    if (item.name === 'Interview Friend') {
      return path === '/interview-friend' || path.startsWith('/interview-friend/');
    }
    return path === item.href;
  };
  const handleLeftToggle = () => {
    if (showSidebarToggle) sidebar.toggle();
    else setIsOpen((current) => !current);
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/95 backdrop-blur-md shadow-sm dark:border-white/10 dark:bg-[#0b1224]/95">
      <div className="grid h-16 w-full grid-cols-[auto_1fr_auto] items-center gap-2 px-3 sm:gap-3 sm:px-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:px-6">
        <div className="flex min-w-0 items-center gap-2 justify-self-start">
          {showSidebarToggle ? (
            <button
              type="button"
              aria-label={sidebar.open ? 'Close sidebar' : 'Open sidebar'}
              onClick={handleLeftToggle}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 sm:h-10 sm:w-10"
            >
              {sidebar.open ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            </button>
          ) : (
            <button
              type="button"
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              onClick={handleLeftToggle}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 md:hidden"
            >
              {isOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            </button>
          )}
          <Link
            to="/"
            className="flex min-w-0 cursor-pointer items-center gap-2"
            onClick={() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' })}
          >
            <AnimatedBrain className="h-8 w-8 shrink-0 sm:h-10 sm:w-10" />
            <span className="truncate text-[clamp(0.95rem,3.8vw,1.25rem)] font-bold leading-none gradient-text">InterviewIQ</span>
          </Link>
        </div>

        <div className="hidden items-center justify-center gap-2 md:flex lg:gap-6">
          {desktopNavigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => {
                if (item.href === '/') {
                  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                }
              }}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 py-1 text-sm font-medium leading-none transition-colors ${
                isNavItemActive(item)
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-700 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1 justify-self-end sm:gap-2">
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full py-1 pl-1 pr-2 text-gray-700 transition-colors hover:bg-gray-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-blue-400 sm:min-h-0"
              >
                <UserAvatar user={user} className="h-8 w-8" />
                <span className="hidden max-w-[10rem] truncate font-medium leading-none sm:inline">{user.name || user.email}</span>
                <ChevronDownIcon className={`hidden h-4 w-4 text-slate-400 transition sm:block ${showProfileMenu ? 'rotate-180' : ''}`} />
              </button>

                <AnimatePresence>
                  {showProfileMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96, y: -8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: -8 }}
                      className="absolute right-0 z-50 mt-2 w-[min(14rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-gray-200 bg-white py-2 shadow-xl dark:border-white/10 dark:bg-[#121a2e]"
                    >
                      <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-700">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{user.name || 'Account'}</p>
                        <p className="truncate text-xs text-gray-500">{user.email}</p>
                      </div>
                      <button
                        onClick={() => {
                          logout();
                          setShowProfileMenu(false);
                        }}
                        className="flex min-h-11 w-full items-center px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-gray-700"
                      >
                        <ArrowRightOnRectangleIcon className="mr-2 h-4 w-4" />
                        Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="hidden items-center space-x-4 md:flex">
                <Link
                  to="/login"
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105"
                >
                  Sign Up
                </Link>
              </div>
            )}
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile Navigation (marketing pages only; app pages use the sidebar) */}
      <AnimatePresence>
        {!showSidebarToggle && isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white dark:bg-[#0b1224] border-t border-gray-200 dark:border-white/10"
          >
            <div className="px-2 pt-2 pb-3 space-y-1">
              {mobileNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    isNavItemActive(item)
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => {
                    setIsOpen(false);
                    if (item.href === '/') {
                      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                    }
                  }}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              ))}

              {user && (
                <>
                  <Link
                    to="/dashboard"
                    className="flex items-center px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => setIsOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/interview-friend"
                    className="flex items-center px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => setIsOpen(false)}
                  >
                    Interview Friend
                  </Link>
                  <Link
                    to="/profile"
                    className="flex items-center px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => setIsOpen(false)}
                  >
                    Profile
                  </Link>
                </>
              )}

              {!user ? (
                <>
                  <Link
                    to="/login"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => setIsOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    className="block px-3 py-2 rounded-md text-base font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    onClick={() => setIsOpen(false)}
                  >
                    Sign Up
                  </Link>
                </>
              ) : (
                <button
                  onClick={() => {
                    logout();
                    setIsOpen(false);
                  }}
                  className="w-full text-left flex items-center px-3 py-2 rounded-md text-base font-medium text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ArrowRightOnRectangleIcon className="w-5 h-5 mr-3" />
                  Logout
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
