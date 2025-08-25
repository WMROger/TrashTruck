import { auth } from '@/config/firebase';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  // Initialize auth listener
    
    if (!auth) {
      console.warn('useAuth: No auth object available');
      setLoading(false);
      return;
    }
  // Use the modular onAuthStateChanged(auth, callback) function.
  const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Auth state changed
      setUser(user);
      setLoading(false);
    }, (error) => {
      console.error('useAuth: Auth state listener error:', error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
  // Attempt sign-out
    
    if (!auth) {
      console.error('useAuth: Cannot logout - no auth object');
      setUser(null);
      return;
    }

  // The modular SDK provides the signOut(auth) function which is imported above.

    try {
  // Call signOut
  // log current user for rare debugging
  // console.debug('useAuth: Current user before signOut:', auth.currentUser);
      
      const result = await signOut(auth);
  // Clear the user state immediately
      setUser(null);
  // Ensure loading is false so UI routing logic can proceed
  setLoading(false);
      
      
    } catch (error) {
  console.error('useAuth: Firebase signOut error:', error);
  // Even if Firebase logout fails, clear local state and stop loading
  setUser(null);
  setLoading(false);
      throw error; // Re-throw to handle in the calling component
    }
  };

  return {
    user,
    loading,
    logout,
    isAuthenticated: !!user,
  };
}
