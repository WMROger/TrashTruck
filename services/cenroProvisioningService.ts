import { db, firebaseConfig } from '@/config/firebase';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, deleteUser, getAuth, sendEmailVerification, updateProfile } from 'firebase/auth';
import { collection, doc, getDocs, query, runTransaction, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { writeAuditLog } from './auditLogService';
import { sendCenroWelcomeEmail } from './emailNotificationService';

export type CenroProvisionInput = {
  mode: 'create' | 'upgrade';
  email?: string;
  password?: string;
  fullName?: string;
  contactInfo?: string;
  existingUserId?: string;
  employeeId?: string;
  department?: string;
  designation?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_PATTERN = /^[A-Z0-9-]{3,40}$/i;

const normalize = (raw: CenroProvisionInput) => {
  const input = {
    ...raw,
    email: String(raw.email || '').trim().toLowerCase(),
    password: String(raw.password || ''),
    fullName: String(raw.fullName || 'CENRO Administrator').trim(),
    contactInfo: String(raw.contactInfo || '').trim().slice(0, 100),
    existingUserId: String(raw.existingUserId || '').trim(),
    employeeId: String(raw.employeeId || 'CENRO-ADMIN-01').trim().toUpperCase(),
    department: String(raw.department || 'CENRO Danao City - Solid Waste Management Office').trim().slice(0, 120),
    designation: String(raw.designation || 'CENRO Administrator').trim().slice(0, 120),
  };

  if (!ID_PATTERN.test(input.employeeId)) {
    throw new Error('Employee ID must be 3-40 characters consisting of letters, numbers, and hyphens.');
  }

  if (input.mode === 'create') {
    if (!EMAIL_PATTERN.test(input.email)) {
      throw new Error('Enter a valid email address for the CENRO account.');
    }
    if (input.password.length < 6 || input.password.length > 128) {
      throw new Error('The password must contain at least 6 characters.');
    }
  } else if (!input.existingUserId) {
    throw new Error('Select an existing resident account to elevate to CENRO.');
  }

  return input;
};

async function writeCenroRecords(uid: string, input: ReturnType<typeof normalize>) {
  if (!db) throw new Error('Firestore is unavailable.');
  const profileRef = doc(db, 'users', uid);
  const identifierRef = doc(db, 'identifiers', 'cenro', 'items', input.employeeId);

  return runTransaction(db, async (transaction) => {
    const [profile, identifierDoc] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(identifierRef),
    ]);

    if (input.mode === 'upgrade' && !profile.exists()) {
      throw new Error('The selected user account could not be found.');
    }

    if (identifierDoc.exists() && identifierDoc.data()?.userId !== uid) {
      throw new Error(`Employee ID ${input.employeeId} is already assigned to another user.`);
    }

    const timestamp = serverTimestamp();
    const existingData = profile.exists() ? profile.data() : null;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5-minute temporary code expiration

    transaction.set(
      profileRef,
      {
        uid,
        email: input.email || existingData?.email || '',
        displayName: input.fullName || existingData?.displayName || existingData?.name || '',
        contactInfo: input.contactInfo || existingData?.contactInfo || '',
        employeeId: input.employeeId,
        department: input.department,
        designation: input.designation,
        role: 'admin', // CENRO Municipal Admin role
        status: 'active',
        disabled: false,
        verified: true,
        mustChangePassword: input.mode === 'create',
        temporaryPasswordCreatedAt: timestamp,
        temporaryPasswordExpiresAt: expiresAt,
        updatedAt: timestamp,
        ...(profile.exists() ? {} : { createdAt: timestamp, provider: 'password' }),
      },
      { merge: true }
    );

    transaction.set(identifierRef, {
      id: input.employeeId,
      type: 'cenro',
      userId: uid,
      role: 'admin',
      department: input.department,
      assignedAt: timestamp,
    }, { merge: true });

    return {
      uid,
      email: input.email || existingData?.email || '',
      displayName: input.fullName,
      role: 'admin',
    };
  });
}

/**
 * Provisions or elevates an account to CENRO Admin (role: 'admin').
 * Executed exclusively by CICTO Super Admin.
 */
export async function provisionCenroOnSpark(raw: CenroProvisionInput) {
  const input = normalize(raw);

  if (input.mode === 'upgrade') {
    const result = await writeCenroRecords(input.existingUserId, input);
    await writeAuditLog('notification.preferences_updated' as any, 'user_role', input.existingUserId, {
      action: 'cicto_elevate_cenro',
      employeeId: input.employeeId,
      department: input.department,
    });
    return result;
  }

  // Create new account using secondary Firebase Auth instance
  const secondaryApp = initializeApp(
    firebaseConfig,
    `cenro-provision-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const secondaryAuth = getAuth(secondaryApp);
  let createdUser: Awaited<ReturnType<typeof createUserWithEmailAndPassword>>['user'] | null = null;

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, input.email, input.password);
    createdUser = credential.user;
    await updateProfile(createdUser, { displayName: input.fullName });

    // Dispatch professional executive welcome email with credentials & password
    try {
      await sendCenroWelcomeEmail({
        toEmail: input.email,
        temporaryPassword: input.password,
        adminName: input.fullName,
        department: input.department,
        designation: input.designation,
      });
    } catch (emailErr) {
      console.warn('Welcome email dispatch note:', emailErr);
    }

    const result = await writeCenroRecords(createdUser.uid, input);
    await writeAuditLog('notification.preferences_updated' as any, 'user_role', createdUser.uid, {
      action: 'cicto_create_cenro',
      email: input.email,
      employeeId: input.employeeId,
    });

    return result;
  } catch (error: any) {
    if (error?.code === 'auth/email-already-in-use' && db) {
      // Find existing user in Firestore or create profile in wiped database
      try {
        const q = query(collection(db, 'users'), where('email', '==', input.email));
        const existingSnap = await getDocs(q);
        let targetUid = input.employeeId.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        let isUpgrade = false;

        if (!existingSnap.empty) {
          targetUid = existingSnap.docs[0].id;
          isUpgrade = true;
        }

        const result = await writeCenroRecords(targetUid, {
          ...input,
          mode: isUpgrade ? 'upgrade' : 'create',
          existingUserId: isUpgrade ? targetUid : '',
        });

        // Dispatch welcome email with temporary password & portal link
        try {
          await sendCenroWelcomeEmail({
            toEmail: input.email,
            temporaryPassword: input.password,
            adminName: input.fullName,
            department: input.department,
            designation: input.designation,
          });
        } catch (emailErr) {
          console.warn('Welcome email dispatch note:', emailErr);
        }

        await writeAuditLog('notification.preferences_updated' as any, 'user_role', targetUid, {
          action: isUpgrade ? 'cicto_elevate_cenro' : 'cicto_create_cenro_existing_auth',
          email: input.email,
          employeeId: input.employeeId,
        });

        return result;
      } catch (elevateErr: any) {
        console.warn('CENRO provisioning fallback error:', elevateErr);
        throw new Error(elevateErr?.message || `Failed to provision CENRO profile for ${input.email}.`);
      }
    }

    if (createdUser) {
      await deleteUser(createdUser).catch(() => undefined);
    }
    throw error;
  } finally {
    await deleteApp(secondaryApp).catch(() => undefined);
  }
}

/**
 * Revokes CENRO Admin status back to resident (role: 'user').
 * Executed exclusively by CICTO Super Admin.
 */
export async function revokeCenroAdmin(userId: string) {
  if (!db) throw new Error('Firestore is unavailable.');
  const profileRef = doc(db, 'users', userId);

  await updateDoc(profileRef, {
    role: 'user',
    designation: null,
    updatedAt: serverTimestamp(),
  });

  await writeAuditLog('notification.preferences_updated' as any, 'user_role', userId, {
    action: 'cicto_revoke_cenro',
  });
}
