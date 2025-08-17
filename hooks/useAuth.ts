import { auth } from '@/config/firebase';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    if (auth) {
      try {
        await signOut(auth);
        setUser(null); // Clear the user state immediately
        console.log('User logged out successfully');
      } catch (error) {
        console.error('Logout error:', error);
        // Even if Firebase logout fails, clear local state
        setUser(null);
      }
    } else {
      // If no Firebase auth, just clear local state
      setUser(null);
    }
  };

  return {
    user,
    loading,
    logout,
    isAuthenticated: !!user,
  };
}
