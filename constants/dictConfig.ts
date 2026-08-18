import { auth, db } from '@/config/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

/**
 * Hardcoded DICT Super Administrator Credentials & Configurations.
 * Used to ensure DICT access is never lost even if the Firestore database
 * or Firebase Auth accounts are cleared/reset.
 */
export const DICT_ADMIN_CONFIG = {
  primaryEmail: 'dict@trashtrack.gov.ph',
  knownEmails: [
    'dict@trashtrack.gov.ph',
    'dict@trashtrack.com',
    'dict.admin@danao.gov.ph',
    'dictadmin@trashtrack.gov.ph',
    'dict@gov.ph',
  ],
  knownUsernames: ['dict', 'dictadmin', 'dict_admin', 'superadmin'],
  defaultPassword: 'DictAdmin2024!',
  displayName: 'DICT Super Administrator',
  role: 'dict' as const,
};

/**
 * Checks if a given email is a recognized DICT Super Admin email.
 */
export function isDictEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (
    DICT_ADMIN_CONFIG.knownEmails.includes(normalized) ||
    normalized.startsWith('dict@') ||
    normalized.startsWith('dict.admin@')
  );
}

/**
 * Checks if a given username or email matches DICT Super Admin identifiers.
 */
export function isDictIdentifier(usernameOrEmail: string): boolean {
  const normalized = usernameOrEmail.trim().toLowerCase();
  if (isDictEmail(normalized)) return true;
  return DICT_ADMIN_CONFIG.knownUsernames.includes(normalized);
}

/**
 * Ensures the DICT user profile document exists in Firestore with role: 'dict'.
 * Automatically heals or recreates the document if the database was wiped.
 */
export async function ensureDictProfileInFirestore(uid: string, email: string, displayName?: string) {
  if (!db) return;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);

    if (!snap.exists() || snap.data()?.role !== 'dict') {
      console.log('Auto-provisioning / healing DICT profile in Firestore for UID:', uid);
      await setDoc(
        userRef,
        {
          uid,
          email: email.toLowerCase(),
          displayName: displayName || DICT_ADMIN_CONFIG.displayName,
          role: 'dict',
          status: 'active',
          disabled: false,
          verified: true,
          department: 'Department of Information and Communications Technology',
          designation: 'Super Administrator',
          createdAt: snap.exists() ? snap.data().createdAt || serverTimestamp() : serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    console.warn('Error ensuring DICT profile in Firestore:', error);
  }
}

/**
 * Attempts to log in using hardcoded DICT credentials.
 * If the user account was deleted from Firebase Auth (e.g. database wiped),
 * this automatically recreates the Auth user and seeds the Firestore record.
 */
export async function loginOrBootstrapDictAccount(inputUsername: string, inputPass: string) {
  const normalizedInput = inputUsername.trim().toLowerCase();
  const email = normalizedInput.includes('@')
    ? normalizedInput
    : DICT_ADMIN_CONFIG.primaryEmail;

  // 1. Try standard sign in with provided password
  try {
    const credential = await signInWithEmailAndPassword(auth, email, inputPass);
    await ensureDictProfileInFirestore(credential.user.uid, email, credential.user.displayName || DICT_ADMIN_CONFIG.displayName);
    return credential.user;
  } catch (err: any) {
    console.log('Initial DICT sign in attempt result:', err.code);

    // If account doesn't exist in Firebase Auth or password matches default hardcoded password
    const isDefaultPassword = inputPass === DICT_ADMIN_CONFIG.defaultPassword;
    const isAccountMissing =
      err.code === 'auth/user-not-found' ||
      err.code === 'auth/invalid-credential';

    if (isAccountMissing || isDefaultPassword) {
      console.log('Bootstrapping hardcoded DICT user in Firebase Auth...');
      try {
        // Create user in Firebase Auth
        const newCred = await createUserWithEmailAndPassword(auth, email, inputPass);
        await updateProfile(newCred.user, { displayName: DICT_ADMIN_CONFIG.displayName });
        await ensureDictProfileInFirestore(newCred.user.uid, email, DICT_ADMIN_CONFIG.displayName);
        return newCred.user;
      } catch (createErr: any) {
        if (createErr.code === 'auth/email-already-in-use') {
          // If email exists, try signing in with default password if different
          if (!isDefaultPassword) {
            const fallbackCred = await signInWithEmailAndPassword(auth, email, DICT_ADMIN_CONFIG.defaultPassword);
            await ensureDictProfileInFirestore(fallbackCred.user.uid, email);
            return fallbackCred.user;
          }
        }
        throw err;
      }
    }

    throw err;
  }
}
