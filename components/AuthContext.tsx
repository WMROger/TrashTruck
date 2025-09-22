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
      // Check if photoURL is a Cloudinary URL (long URLs)
      const isCloudinaryURL = profileData.photoURL && (
        profileData.photoURL.includes('cloudinary.com') || 
        profileData.photoURL.length > 2000
      );

      // Update Firebase Auth profile (only displayName, skip photoURL for Cloudinary URLs)
      const authUpdateData: { displayName?: string; photoURL?: string | null } = {
        displayName: profileData.displayName,
      };
      
      // Only update Firebase Auth photoURL if it's not a Cloudinary URL
      if (profileData.photoURL && !isCloudinaryURL) {
        authUpdateData.photoURL = profileData.photoURL;
      }

      await updateFirebaseProfile(auth.user, authUpdateData);

      // Update Firestore user document with the full photoURL (including Cloudinary URLs)
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

      if (isCloudinaryURL) {
        console.log('Profile updated: Cloudinary photo URL stored in Firestore only');
      } else {
        console.log('Profile updated successfully in both Auth and Firestore');
      }
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
