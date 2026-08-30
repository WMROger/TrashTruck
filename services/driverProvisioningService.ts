import { firebaseConfig, db } from '@/config/firebase';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, deleteUser, getAuth, updateProfile } from 'firebase/auth';
import { doc, getDocs, collection, query, where, runTransaction, serverTimestamp } from 'firebase/firestore';

export type DriverProvisionInput = {
  mode: 'create' | 'upgrade';
  email?: string;
  password?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  contactInfo?: string;
  phoneNumber?: string;
  existingUserId?: string;
  employeeId: string;
  licenseNumber: string;
  truckId?: string;
  assignedBarangay?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_PATTERN = /^[A-Z0-9-]{4,40}$/i;

const normalize = (input: DriverProvisionInput) => {
  const getFullName = () => {
    if (input.fullName && input.fullName.trim()) return input.fullName.trim();
    const fn = String(input.firstName || '').trim();
    const mi = String(input.middleInitial || '').trim() ? `${String(input.middleInitial || '').trim().replace(/\.$/, '')}. ` : '';
    const ln = String(input.lastName || '').trim();
    return `${fn} ${mi}${ln}`.trim() || `${ln}, ${fn}`.trim();
  };

  const formattedName = getFullName();

  const value = {
    ...input,
    email: String(input.email || '').trim().toLowerCase(),
    password: String(input.password || ''),
    fullName: formattedName,
    firstName: String(input.firstName || '').trim(),
    lastName: String(input.lastName || '').trim(),
    middleInitial: String(input.middleInitial || '').trim(),
    contactInfo: String(input.contactInfo || input.phoneNumber || '').trim().slice(0, 100),
    phoneNumber: String(input.phoneNumber || input.contactInfo || '').trim().slice(0, 100),
    existingUserId: String(input.existingUserId || '').trim(),
    employeeId: String(input.employeeId || '').trim().toUpperCase(),
    licenseNumber: String(input.licenseNumber || '').trim().toUpperCase(),
    truckId: String(input.truckId || '').trim(),
    assignedBarangay: String(input.assignedBarangay || '').trim(),
  };
  if (!ID_PATTERN.test(value.employeeId)) throw new Error('Enter a valid employee ID using letters, numbers, or hyphens.');
  if (!ID_PATTERN.test(value.licenseNumber)) throw new Error('Enter a valid license number using letters, numbers, or hyphens.');
  if (value.fullName.length < 2 || value.fullName.length > 100) throw new Error('Enter the driver’s full name.');
  if (value.mode === 'create') {
    if (!EMAIL_PATTERN.test(value.email)) throw new Error('Enter a valid driver email address.');
    if (value.password.length < 8 || value.password.length > 128) throw new Error('The temporary password must contain at least 8 characters.');
  } else if (!value.existingUserId) throw new Error('Select a resident or driver account to modify.');
  return value;
};

async function writeDriverRecords(uid: string, input: ReturnType<typeof normalize>) {
  if (!db) throw new Error('Firestore is unavailable.');
  const userRef = doc(db, 'users', uid);
  const identifierRef = doc(db, 'identifiers', 'driver', 'items', input.employeeId);
  const truckRef = input.truckId ? doc(db, 'trucks', input.truckId) : null;

  // Enforce unique license number in identifiers collection
  if (input.licenseNumber) {
    const licSnap = await getDocs(query(collection(db, 'identifiers', 'license', 'items'), where('id', '==', input.licenseNumber)));
    const conflicting = licSnap.docs.find(d => d.data().userId !== uid && d.data().employeeId !== input.employeeId);
    if (conflicting) {
      throw new Error(`LTO License Number "${input.licenseNumber}" is already registered to employee ${conflicting.data().employeeId || conflicting.id}.`);
    }
  }

  return runTransaction(db, async transaction => {
    const [profile, identifierDoc, truck] = await Promise.all([
      transaction.get(userRef),
      transaction.get(identifierRef),
      truckRef ? transaction.get(truckRef) : Promise.resolve(null),
    ]);
    if (input.mode === 'upgrade' && (!profile.exists() || !['user', 'driver'].includes(String(profile.data()?.role)))) {
      throw new Error('Only an existing resident or driver account can be modified.');
    }
    if (identifierDoc.exists() && identifierDoc.data()?.userId !== uid) throw new Error('This employee ID is already assigned.');
    if (truckRef && (!truck?.exists() || truck.data()?.status !== 'active' || (truck.data()?.assignedDriverId && truck.data()?.assignedDriverId !== uid))) {
      throw new Error('The selected truck is no longer available.');
    }

    const previousTruckId = profile.data()?.currentTruckId;
    if (previousTruckId && previousTruckId !== input.truckId) {
      const prevTruckRef = doc(db, 'trucks', previousTruckId);
      transaction.update(prevTruckRef, {
        assignedDriverId: null,
        assignedDriverName: null,
        updatedAt: serverTimestamp(),
      });
    }

    const timestamp = serverTimestamp();
    const assignedBarangay = input.assignedBarangay || profile.data()?.assignedBarangay || profile.data()?.barangay || '';

    transaction.set(userRef, {
      uid,
      email: input.email || profile.data()?.email || '',
      displayName: input.fullName || profile.data()?.displayName || '',
      firstName: input.firstName || profile.data()?.firstName || '',
      lastName: input.lastName || profile.data()?.lastName || '',
      middleInitial: input.middleInitial || profile.data()?.middleInitial || '',
      contactInfo: input.contactInfo || profile.data()?.contactInfo || '',
      phoneNumber: input.phoneNumber || profile.data()?.phoneNumber || '',
      employeeId: input.employeeId,
      licenseNumber: input.licenseNumber,
      barangay: assignedBarangay,
      assignedBarangay: assignedBarangay,
      role: 'driver',
      disabled: false,
      status: 'active',
      currentTruckId: input.truckId || null,
      currentTruckPlate: truck?.data()?.plateNumber || null,
      provider: profile.data()?.provider || 'password',
      verified: true,
      mustChangePassword: input.mode === 'create' ? true : (profile.data()?.mustChangePassword === true),
      updatedAt: timestamp,
      ...(profile.exists() ? {} : { createdAt: timestamp }),
    }, { merge: true });

    transaction.set(identifierRef, {
      id: input.employeeId,
      type: 'driver',
      userId: uid,
      licenseNumber: input.licenseNumber,
      driverName: input.fullName || profile.data()?.displayName || '',
      assignedBarangay: assignedBarangay,
      assignedTruckId: input.truckId || null,
      assignedTruckPlate: truck?.data()?.plateNumber || null,
      role: 'driver',
      status: 'active',
      assignedAt: timestamp,
      updatedAt: timestamp,
    }, { merge: true });

    if (input.licenseNumber) {
      const unifiedLicRef = doc(db, 'identifiers', 'license', 'items', input.licenseNumber);
      transaction.set(unifiedLicRef, {
        id: input.licenseNumber,
        type: 'license',
        employeeId: input.employeeId,
        userId: uid,
        assignedAt: timestamp,
      }, { merge: true });
    }

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
    try {
      const { sendDriverWelcomeEmail } = await import('@/services/emailNotificationService');
      await sendDriverWelcomeEmail({
        toEmail: input.email,
        driverName: input.fullName,
        temporaryPassword: input.password,
        employeeId: input.employeeId,
        truckId: input.truckId || undefined,
      });
    } catch {}
    return await writeDriverRecords(createdUser.uid, input);
  } catch (error) {
    if (createdUser) await deleteUser(createdUser).catch(() => undefined);
    throw error;
  } finally {
    await deleteApp(secondaryApp).catch(() => undefined);
  }
}
