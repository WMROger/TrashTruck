import { db, firebaseConfig } from '@/config/firebase';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, deleteUser, getAuth, sendEmailVerification, updateProfile } from 'firebase/auth';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

export type CoordinatorProvisionInput = {
  mode: 'create' | 'upgrade';
  email?: string;
  password?: string;
  fullName: string;
  contactInfo?: string;
  existingUserId?: string;
  employeeId: string;
  barangay: string;
  zone?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_PATTERN = /^[A-Z0-9-]{4,40}$/i;

const normalize = (raw: CoordinatorProvisionInput) => {
  const input = {
    ...raw,
    email: String(raw.email || '').trim().toLowerCase(),
    password: String(raw.password || ''),
    fullName: String(raw.fullName || '').trim(),
    contactInfo: String(raw.contactInfo || '').trim().slice(0, 100),
    existingUserId: String(raw.existingUserId || '').trim(),
    employeeId: String(raw.employeeId || '').trim().toUpperCase(),
    barangay: String(raw.barangay || '').trim(),
    zone: String(raw.zone || '').trim().slice(0, 80),
  };
  if (!ID_PATTERN.test(input.employeeId)) throw new Error('Enter a valid coordinator employee ID.');
  if (input.fullName.length < 2 || input.fullName.length > 100) throw new Error("Enter the coordinator's full name.");
  if (!input.barangay) throw new Error('Select the assigned barangay.');
  if (input.mode === 'create') {
    if (!EMAIL_PATTERN.test(input.email)) throw new Error('Enter a valid coordinator email address.');
    if (input.password.length < 12 || input.password.length > 128) throw new Error('The temporary password must contain 12 to 128 characters.');
  } else if (!input.existingUserId) throw new Error('Select a resident account to upgrade.');
  return input;
};

async function writeCoordinatorRecords(uid: string, input: ReturnType<typeof normalize>) {
  if (!db) throw new Error('Firestore is unavailable.');
  const profileRef = doc(db, 'users', uid);
  const employeeRef = doc(db, 'coordinator_employee_ids', input.employeeId);
  return runTransaction(db, async transaction => {
    const [profile, employee] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(employeeRef),
    ]);
    if (input.mode === 'upgrade' && (!profile.exists() || profile.data()?.role !== 'user')) {
      throw new Error('Only an existing resident account can be upgraded.');
    }
    if (employee.exists() && employee.data()?.userId !== uid) throw new Error('This coordinator employee ID is already assigned.');
    const timestamp = serverTimestamp();
    transaction.set(profileRef, {
      uid,
      email: input.email || profile.data()?.email || '',
      displayName: input.fullName || profile.data()?.displayName || profile.data()?.name || '',
      contactInfo: input.contactInfo || profile.data()?.contactInfo || '',
      employeeId: input.employeeId,
      barangay: input.barangay,
      zone: input.zone,
      role: 'coordinator',
      status: 'active',
      disabled: false,
      verified: input.mode === 'upgrade' ? profile.data()?.verified === true : false,
      updatedAt: timestamp,
      ...(profile.exists() ? {} : { createdAt: timestamp, provider: 'password' }),
    }, { merge: true });

    transaction.set(employeeRef, { userId: uid, assignedAt: timestamp });

    const unifiedIdRef = doc(db, 'identifiers', `coord_${input.employeeId}`);
    transaction.set(unifiedIdRef, {
      id: input.employeeId,
      type: 'coordinator',
      userId: uid,
      barangay: input.barangay,
      zone: input.zone,
      role: 'coordinator',
      assignedAt: timestamp,
    }, { merge: true });

    return { uid, email: input.email || profile.data()?.email || '' };
  });
}

export async function provisionCoordinatorOnSpark(raw: CoordinatorProvisionInput) {
  const input = normalize(raw);
  if (input.mode === 'upgrade') return writeCoordinatorRecords(input.existingUserId, input);

  const secondaryApp = initializeApp(firebaseConfig, `coordinator-provision-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const secondaryAuth = getAuth(secondaryApp);
  let createdUser: Awaited<ReturnType<typeof createUserWithEmailAndPassword>>['user'] | null = null;
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, input.email, input.password);
    createdUser = credential.user;
    await updateProfile(createdUser, { displayName: input.fullName });
    await sendEmailVerification(createdUser);
    return await writeCoordinatorRecords(createdUser.uid, input);
  } catch (error) {
    if (createdUser) await deleteUser(createdUser).catch(() => undefined);
    throw error;
  } finally {
    await deleteApp(secondaryApp).catch(() => undefined);
  }
}
