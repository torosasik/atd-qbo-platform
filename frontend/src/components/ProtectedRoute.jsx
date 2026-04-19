import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

const TEST_MODE = import.meta.env.VITE_TEST_MODE === 'true';
const TEST_EMAIL = import.meta.env.VITE_TEST_EMAIL;
const TEST_PASSWORD = import.meta.env.VITE_TEST_PASSWORD;

export default function ProtectedRoute({ children }) {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    let unsubscribe;

    async function init() {
      // In test mode, sign in first then subscribe so first auth check is already authenticated
      if (TEST_MODE && TEST_EMAIL && TEST_PASSWORD) {
        try {
          await signInWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
        } catch (e) {
          // Already signed in or wrong credentials — fall through to onAuthStateChanged
        }
      }
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setUser(firebaseUser);
      });
    }

    init();
    return () => unsubscribe?.();
  }, []);

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-[#0462AC] rounded-full animate-spin" />
          <span className="text-gray-500 text-sm">Checking session…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
