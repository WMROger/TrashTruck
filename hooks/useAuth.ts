import { auth, db } from '@/config/firebase';
import { isCictoEmail } from '@/constants/cictoConfig';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFirestoreVerified, setIsFirestoreVerified] = useState(false);

  useEffect(() => {
    if (!auth) {
      console.warn('useAuth: No auth object available');
      setLoading(false);
      return;
    }

    let userUnsub: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (userUnsub) {
        userUnsub();
        userUnsub = null;
      }

      if (!currentUser || !db) {
        setIsFirestoreVerified(false);
        setLoading(false);
        return;
      }

      if (isCictoEmail(currentUser.email)) {
        setIsFirestoreVerified(true);
        setLoading(false);
        return;
      }

      const userRef = doc(db, 'users', currentUser.uid);
      userUnsub = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const role = data?.role;
          const isVerified = data?.verified === true || role === 'driver' || role === 'admin' || role === 'cicto' || role === 'coordinator';
          setIsFirestoreVerified(isVerified);
        } else {
          setIsFirestoreVerified(false);
        }
        setLoading(false);
      }, (error) => {
        console.warn('useAuth: user profile listener error:', error);
        setLoading(false);
      });
    }, (error) => {
      console.error('useAuth: Auth state listener error:', error);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (userUnsub) userUnsub();
    };
  }, []);

  const logout = async () => {
    if (!auth) {
      console.error('useAuth: Cannot logout - no auth object');
      setUser(null);
      return;
    }

    try {
      await signOut(auth);
      setUser(null);
      setIsFirestoreVerified(false);
      setLoading(false);
    } catch (error) {
      console.error('useAuth: Firebase signOut error:', error);
      setUser(null);
      setIsFirestoreVerified(false);
      setLoading(false);
      throw error;
    }
  };

  // Consider email/password users without verified email as unauthenticated
  const isPasswordProvider = (u: User | null) =>
    !!u && Array.isArray(u.providerData) && u.providerData.some(p => p?.providerId === 'password');

  const isAuthenticated = !!user && (!isPasswordProvider(user) || user.emailVerified === true || isFirestoreVerified);

  return {
    user,
    loading,
    logout,
    isAuthenticated,
  };
}
