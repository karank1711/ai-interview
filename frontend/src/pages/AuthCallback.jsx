import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authService } from '../services/authService';
import { mapAuthError } from '../utils/authErrors.js';
import { usePopup } from '../components/AppPopup';

const AuthCallback = ({ setUser }) => {
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { showPopup } = usePopup();

  useEffect(() => {
    let cancelled = false;

    const complete = async () => {
      try {
        const user = await authService.completeOAuthRedirect();
        if (cancelled) return;
        setUser(user);
        showPopup({
          type: 'success',
          title: 'Welcome back',
          message: 'You are signed in. Redirecting you to Home.',
        });
        navigate('/', { replace: true });
      } catch (err) {
        if (cancelled) return;
        setError(mapAuthError(err, err.message || 'Sign-in failed.'));
        setTimeout(() => navigate('/login', { replace: true, state: { error: err.message } }), 1800);
      }
    };

    complete();
    return () => {
      cancelled = true;
    };
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="text-center px-6">
        {error ? (
          <p className="text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <>
            <motion.div
              className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <p className="text-gray-600 dark:text-gray-400">Finishing sign-in...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
