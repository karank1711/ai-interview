const googleButtonClass =
  'w-full inline-flex items-center justify-center gap-3 py-2.5 px-5 rounded-full bg-white text-[15px] font-medium text-neutral-800 border border-gray-200 shadow-[0_1px_2px_rgba(60,64,67,0.18),0_2px_6px_rgba(60,64,67,0.08)] hover:bg-[#f8f9fa] hover:shadow-[0_1px_3px_rgba(60,64,67,0.22)] active:bg-[#f1f3f4] disabled:opacity-50 disabled:cursor-not-allowed transition-all';

const githubButtonClass =
  'w-full inline-flex items-center justify-center gap-3 py-2.5 px-5 rounded-full text-[15px] font-medium text-neutral-900 border border-gray-300 bg-gradient-to-b from-white to-[#e8eaed] shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:from-[#f8f9fa] hover:to-[#dfe1e5] disabled:opacity-50 disabled:cursor-not-allowed transition-all';

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);

const GitHubIcon = () => (
  <svg className="w-5 h-5" fill="#24292f" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.76-1.605-2.665-.303-5.466-1.332-5.466-5.93 0-1.31.468-2.38 1.236-3.22-.124-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.873.118 3.176.77.84 1.235 1.91 1.235 3.22 0 4.61-2.807 5.624-5.48 5.92.43.372.814 1.102.814 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 21.796 24 17.297 24 12 24 5.37 18.63 0 12 0z" />
  </svg>
);

const OAuthButtons = ({ onGoogle, onGitHub, loading = false }) => (
  <div className="mt-6 space-y-3">
    <button type="button" onClick={onGoogle} disabled={loading} className={googleButtonClass}>
      <GoogleIcon />
      <span>Continue with Google</span>
    </button>
    <button type="button" onClick={onGitHub} disabled={loading} className={githubButtonClass}>
      <GitHubIcon />
      <span>Continue with GitHub</span>
    </button>
  </div>
);

export default OAuthButtons;
