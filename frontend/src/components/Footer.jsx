import { Link } from 'react-router-dom';
import { EnvelopeIcon, MapPinIcon, PhoneIcon } from '@heroicons/react/24/outline';
import AnimatedBrain from './AnimatedBrain';

const Footer = () => {
  return (
    <footer className="bg-[#0b1224] text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" className="mb-4 flex items-center gap-2">
              <AnimatedBrain className="h-9 w-9" />
              <span className="text-lg font-bold">
                Interview<span className="text-violet-400">IQ</span>
              </span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-slate-400">
              Smarter Practice. Better Interviews. AI-powered mock interviews to help you land your next role.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-200">Quick Links</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link to="/features" className="hover:text-white">Features</Link></li>
              <li><Link to="/about" className="hover:text-white">About</Link></li>
              <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
              <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-200">Support</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link to="/contact" className="hover:text-white">Help Center</Link></li>
              <li><Link to="/privacy" className="hover:text-white">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-white">Terms of Service</Link></li>
              <li><Link to="/contact" className="hover:text-white">Feedback</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-200">Connect With Us</h3>
            <ul className="space-y-3 text-sm text-slate-400">
              <li className="flex items-start gap-2">
                <EnvelopeIcon className="mt-0.5 h-4 w-4 text-violet-400" />
                <a href="mailto:karank47417@gmail.com" className="hover:text-white">karank47417@gmail.com</a>
              </li>
              <li className="flex items-start gap-2">
                <PhoneIcon className="mt-0.5 h-4 w-4 text-emerald-400" />
                <a href="tel:+918383075384" className="hover:text-white">+91 8383075384</a>
              </li>
              <li className="flex items-start gap-2">
                <MapPinIcon className="mt-0.5 h-4 w-4 text-sky-400" />
                <span>Faridabad, Sec-91</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} InterviewIQ. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
