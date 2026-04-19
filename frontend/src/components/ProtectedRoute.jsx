import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

const TEST_MODE = import.meta.env.VITE_TEST_MODE === 'true';
const TEST_EMAIL = import.meta.env.VITE_TEST_EMAIL;
const TEST_PASSWORD = import.meta.env.VITE_TEST_PASSWORD;

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'authed' | 'unauthed'

  useEffect(() => {
    const run = async () => {
      // Wait for Firebase to fully initialize auth state
      await auth.authStateReady();

      // Already signed in — done
      if (auth.currentUser) {
        setStatus('authed');
        // Keep listening for sign-out
        onAuthStateChanged(auth, (u) => setStatus(u ? 'authed' : 'unauthed'));
        return;
      }

      // Not signed in — try test mode auto sign-in
      if (TEST_MODE && TEST_EMAIL && TEST_PASSWORD) {
        try {
          await signInWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
          setStatus('authed');
          onAuthStateChanged(auth, (u) => setStatus(u ? 'authed' : 'unauthed'));
          return;
        } catch (e) {
          // Test sign-in failed — fall through to unauthed
        }
      }

      setStatus('unauthed');
      // Keep listening in case user signs in elsewhere
      onAuthStateChanged(auth, (u) => setStatus(u ? 'authed' : 'unauthed'));
    };

    run();
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-[#0462AC] rounded-full animate-spin" />
          <span className="text-gray-500 text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (status === 'unauthed') {
    return <Navigate to="/login" replace />;
  }

  return children;
}
