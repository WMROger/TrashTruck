import { db } from '@/config/firebase';
import { useAuth } from '@/hooks/useAuth';
import { updateProfile as updateFirebaseProfile, User } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { createContext, ReactNode, useContext } from 'react';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  updateProfile: (profileData: { displayName?: string; photoURL?: string | null }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();

  const updateProfile = async (profileData: { displayName?: string; photoURL?: string | null }) => {
    if (!auth.user || !auth || !db) {
      throw new Error('User not authenticated or Firebase not available');
    }

    try {
      // Validate photo URL length (Firebase Auth has a limit)
      let validPhotoURL = profileData.photoURL;
      if (validPhotoURL && validPhotoURL.length > 2000) {
        console.warn('Photo URL too long for Firebase Auth, storing only in Firestore');
        validPhotoURL = null; // Don't update Firebase Auth with long URLs
      }

      // Update Firebase Auth profile (only if photo URL is valid)
      const authUpdateData: { displayName?: string; photoURL?: string | null } = {
        displayName: profileData.displayName,
      };
      
      if (validPhotoURL !== undefined) {
        authUpdateData.photoURL = validPhotoURL;
      }

      await updateFirebaseProfile(auth.user, authUpdateData);

      // Update Firestore user document (same as signup screen)
      // Store the original photoURL in Firestore even if it's long
      const userRef = doc(db, 'users', auth.user.uid);
      await setDoc(
        userRef,
        {
          displayName: profileData.displayName || auth.user.displayName || '',
          photoURL: profileData.photoURL || auth.user.photoURL || '',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      console.log('Profile updated successfully in both Auth and Firestore');
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ ...auth, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
