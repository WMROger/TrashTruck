import { firebaseConfig, db } from '@/config/firebase';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, deleteUser, getAuth, sendEmailVerification, updateProfile } from 'firebase/auth';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

export type DriverProvisionInput = {
  mode: 'create' | 'upgrade';
  email?: string;
  password?: string;
  fullName: string;
  contactInfo?: string;
  existingUserId?: string;
  employeeId: string;
  licenseNumber: string;
  truckId?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_PATTERN = /^[A-Z0-9-]{4,40}$/i;

const normalize = (input: DriverProvisionInput) => {
  const value = {
    ...input,
    email: String(input.email || '').trim().toLowerCase(),
    password: String(input.password || ''),
    fullName: String(input.fullName || '').trim(),
    contactInfo: String(input.contactInfo || '').trim().slice(0, 100),
    existingUserId: String(input.existingUserId || '').trim(),
    employeeId: String(input.employeeId || '').trim().toUpperCase(),
    licenseNumber: String(input.licenseNumber || '').trim().toUpperCase(),
    truckId: String(input.truckId || '').trim(),
  };
  if (!ID_PATTERN.test(value.employeeId)) throw new Error('Enter a valid employee ID using letters, numbers, or hyphens.');
  if (!ID_PATTERN.test(value.licenseNumber)) throw new Error('Enter a valid license number using letters, numbers, or hyphens.');
  if (value.fullName.length < 2 || value.fullName.length > 100) throw new Error('Enter the driver’s full name.');
  if (value.mode === 'create') {
    if (!EMAIL_PATTERN.test(value.email)) throw new Error('Enter a valid driver email address.');
    if (value.password.length < 12 || value.password.length > 128) throw new Error('The temporary password must contain 12 to 128 characters.');
  } else if (!value.existingUserId) throw new Error('Select a resident account to upgrade.');
  return value;
};

async function writeDriverRecords(uid: string, input: ReturnType<typeof normalize>) {
  if (!db) throw new Error('Firestore is unavailable.');
  const userRef = doc(db, 'users', uid);
  const employeeRef = doc(db, 'employee_ids', input.employeeId);
  const licenseRef = doc(db, 'license_numbers', input.licenseNumber);
  const truckRef = input.truckId ? doc(db, 'trucks', input.truckId) : null;

  return runTransaction(db, async transaction => {
    const [profile, employee, license, truck] = await Promise.all([
      transaction.get(userRef),
      transaction.get(employeeRef),
      transaction.get(licenseRef),
      truckRef ? transaction.get(truckRef) : Promise.resolve(null),
    ]);
    if (input.mode === 'upgrade' && (!profile.exists() || profile.data()?.role !== 'user')) {
      throw new Error('Only an existing resident account can be upgraded.');
    }
    if (employee.exists() && employee.data()?.userId !== uid) throw new Error('This employee ID is already assigned.');
    if (license.exists() && license.data()?.userId !== uid) throw new Error('This license number is already assigned.');
    if (truckRef && (!truck?.exists() || truck.data()?.status !== 'active' || (truck.data()?.assignedDriverId && truck.data()?.assignedDriverId !== uid))) {
      throw new Error('The selected truck is no longer available.');
    }
    const timestamp = serverTimestamp();
    transaction.set(userRef, {
      uid,
      email: input.email || profile.data()?.email || '',
      displayName: input.fullName || profile.data()?.displayName || '',
      contactInfo: input.contactInfo || profile.data()?.contactInfo || '',
      employeeId: input.employeeId,
      licenseNumber: input.licenseNumber,
      role: 'driver',
      disabled: false,
      status: 'active',
      currentTruckId: input.truckId || null,
      currentTruckPlate: truck?.data()?.plateNumber || null,
      provider: profile.data()?.provider || 'password',
      verified: input.mode === 'upgrade' ? profile.data()?.verified === true : false,
      updatedAt: timestamp,
      ...(profile.exists() ? {} : { createdAt: timestamp }),
    }, { merge: true });
    transaction.set(employeeRef, { userId: uid, assignedAt: timestamp });
    transaction.set(licenseRef, { userId: uid, assignedAt: timestamp });
    if (truckRef) transaction.update(truckRef, {
      assignedDriverId: uid,
      assignedDriverName: input.fullName,
      updatedAt: timestamp,
    });
    return { uid, email: input.email || profile.data()?.email || '', truckId: input.truckId || null };
  });
}

export async function provisionDriverOnSpark(rawInput: DriverProvisionInput) {
  const input = normalize(rawInput);
  if (input.mode === 'upgrade') return writeDriverRecords(input.existingUserId, input);

  const secondaryApp = initializeApp(firebaseConfig, `driver-provision-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const secondaryAuth = getAuth(secondaryApp);
  let createdUser: Awaited<ReturnType<typeof createUserWithEmailAndPassword>>['user'] | null = null;
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, input.email, input.password);
    createdUser = credential.user;
    await updateProfile(createdUser, { displayName: input.fullName });
    await sendEmailVerification(createdUser);
    return await writeDriverRecords(createdUser.uid, input);
  } catch (error) {
    if (createdUser) await deleteUser(createdUser).catch(() => undefined);
    throw error;
  } finally {
    await deleteApp(secondaryApp).catch(() => undefined);
  }
}
