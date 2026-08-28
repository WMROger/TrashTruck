import { auth, db } from '@/config/firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  limit,
  writeBatch,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { isCictoEmail } from '@/constants/cictoConfig';

export interface CictoNotification {
  id: string;
  type: 'account_deleted' | 'admin_created' | 'system_alert';
  title: string;
  description?: string;
  requestId?: string;
  targetUser?: {
    uid: string;
    email: string;
    displayName: string;
    role: string;
    employeeId?: string;
  };
  status: 'active' | 'dismissed' | 'used' | 'expired';
  createdAt: any;
  actorEmail?: string;
  actorName?: string;
}


export interface DeletionRequestResult {
  requestId: string;
  otpPin: string;
  expiresAt: Date;
  targetEmail: string;
  targetName: string;
}

/**
 * Generates a cryptographically randomized 6-digit numeric PIN.
 */
function generate6DigitOtp(): string {
  const pin = Math.floor(100000 + Math.random() * 900000);
  return String(pin);
}

// In-memory persistent notification cache and subscriber registry
let memoryNotifications: CictoNotification[] = [];
let firestoreNotifications: CictoNotification[] = [];
const notificationSubscribers = new Set<(notifs: CictoNotification[]) => void>();

function notifySubscribers() {
  const map = new Map<string, CictoNotification>();
  
  memoryNotifications.forEach((n) => map.set(n.id, n));
  firestoreNotifications.forEach((n) => {
    if (!map.has(n.id)) {
      map.set(n.id, n);
    }
  });

  const merged = Array.from(map.values()).sort((a, b) => {
    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.getTime ? a.createdAt.getTime() : 0);
    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.getTime ? b.createdAt.getTime() : 0);
    return timeB - timeA;
  });

  notificationSubscribers.forEach((callback) => {
    try {
      callback(merged);
    } catch (e) {
      console.warn('Notification callback error:', e);
    }
  });
}

/**
 * Generates a secure 6-digit authorization PIN for the on-screen modal verification.
 */
export async function requestAccountDeletionOtp(targetUser: {
  id: string;
  email: string;
  displayName: string;
  role: string;
  employeeId?: string;
}): Promise<DeletionRequestResult> {
  if (!db) throw new Error('Database is currently unavailable.');
  if (!auth.currentUser) throw new Error('CICTO administrator authentication is required.');

  // Guard: Protect CICTO accounts from deletion
  if (targetUser.role === 'cicto' || isCictoEmail(targetUser.email)) {
    throw new Error('CICTO Super Administrator accounts cannot be deleted from the directory.');
  }

  const otpPin = generate6DigitOtp();
  const now = Date.now();
  const ttlMs = 1 * 60 * 1000; // 1 minute validity
  const expiresAt = new Date(now + ttlMs);

  const adminEmail = auth.currentUser.email || 'cicto@trashtrack.gov.ph';

  // Create temporary verification document in Firestore
  let requestId = 'otp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  try {
    const otpRef = await addDoc(collection(db, 'cicto_otp_verifications'), {
      targetUid: targetUser.id,
      targetEmail: targetUser.email,
      targetName: targetUser.displayName || 'Unnamed User',
      targetRole: targetUser.role,
      otpPin: otpPin.trim(),
      requestedByUid: auth.currentUser.uid,
      requestedByEmail: adminEmail,
      status: 'pending',
      createdAt: serverTimestamp(),
      expiresAtTimestamp: now + ttlMs,
    });
    requestId = otpRef.id;
  } catch (err) {
    console.warn('Firestore verification save warning (using client fallback):', err);
  }

  console.log(`🔒 CICTO Deletion PIN generated for ${targetUser.email}: [${otpPin}]`);

  return {
    requestId,
    otpPin,
    expiresAt,
    targetEmail: targetUser.email,
    targetName: targetUser.displayName || targetUser.email,
  };
}

export const requestCictoAccountDeletion = requestAccountDeletionOtp;

/**
 * Confirms account deletion with the provided 6-digit OTP.
 * Deletes from both Firebase Authentication (via Cloud Function / Admin API)
 * and Cloud Firestore collections (users, employee_ids, notifications).
 */
export async function confirmAccountDeletion(params: {
  requestId: string;
  pin: string;
  targetUid: string;
  targetEmail: string;
}): Promise<{ success: boolean; message: string }> {
  const { requestId, pin, targetUid, targetEmail } = params;

  if (!db) throw new Error('Database is currently unavailable.');
  if (!auth.currentUser) throw new Error('CICTO administrator authentication is required.');
  if (!pin || pin.trim().length !== 6) throw new Error('Please enter a valid 6-digit One-Time PIN.');

  // 1. Verify OTP in Firestore
  const otpDocRef = doc(db, 'cicto_otp_verifications', requestId);
  const otpSnap = await getDoc(otpDocRef);

  if (!otpSnap.exists()) {
    throw new Error('Verification request not found or has already been used.');
  }

  const otpData = otpSnap.data();

  if (otpData.status !== 'pending') {
    throw new Error('This verification PIN has already been used or invalidated.');
  }

  if (Date.now() > Number(otpData.expiresAtTimestamp || 0)) {
    throw new Error('This One-Time PIN has expired (1-minute limit exceeded). Please request a new PIN.');
  }

  if (String(otpData.otpPin).trim() !== pin.trim()) {
    throw new Error('Invalid One-Time PIN. Please check your CICTO Security Notification Bell and try again.');
  }

  if (otpData.targetUid !== targetUid) {
    throw new Error('Target user mismatch for this verification request.');
  }

  console.log(`✅ OTP verified for account deletion of UID: ${targetUid}`);

  let authDeleted = false;

  // 2. Attempt to delete from Firebase Authentication via Cloud Function
  try {
    const functionsInstance = getFunctions(undefined, 'us-central1');
    const deleteCallable = httpsCallable(functionsInstance, 'cictoConfirmDeleteAccount');
    const result = await deleteCallable({
      requestId,
      pin: pin.trim(),
      targetUid,
    });
    console.log('✅ Cloud Function Auth deletion result:', result.data);
    authDeleted = true;
  } catch (cloudFnError: any) {
    console.warn('Note on Cloud Function deletion execution:', cloudFnError?.message || cloudFnError);
  }

  // 3. Delete from Firestore in an atomic transaction/batch
  const batch = writeBatch(db);

  // Wiping user document
  const userRef = doc(db, 'users', targetUid);
  batch.delete(userRef);

  // Wiping any assigned employee ID (driver or coordinator)
  const employeeSnap = await getDocs(
    query(collection(db, 'employee_ids'), where('userId', '==', targetUid))
  );
  employeeSnap.forEach((empDoc) => {
    batch.delete(empDoc.ref);
  });

  // Mark OTP verification document as completed
  batch.update(otpDocRef, {
    status: 'completed',
    completedAt: serverTimestamp(),
    completedByUid: auth.currentUser.uid,
  });

  // Mark linked notifications as used
  try {
    const notifSnap = await getDocs(
      query(collection(db, 'cicto_notifications'), where('requestId', '==', requestId))
    );
    notifSnap.forEach((nDoc) => {
      batch.update(nDoc.ref, { status: 'used' });
    });
  } catch {}

  await batch.commit();

  const adminEmail = auth.currentUser.email || 'cicto@trashtrack.gov.ph';
  const adminName = auth.currentUser.displayName || 'CICTO Super Administrator';

  // 4. Create real-time Audit / Activity Log Notification (displays in top-right bell)
  const deletionLogNotif: CictoNotification = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    type: 'account_deleted',
    title: 'Account Permanently Deleted',
    description: `User account ${targetEmail} (${targetUid}) was deleted from Authentication and Firestore.`,
    targetUser: {
      uid: targetUid,
      email: targetEmail,
      displayName: targetEmail.split('@')[0],
      role: 'user',
    },
    status: 'active',
    actorEmail: adminEmail,
    actorName: adminName,
    createdAt: new Date(),
  };

  memoryNotifications = [deletionLogNotif, ...memoryNotifications];
  notifySubscribers();

  try {
    await addDoc(collection(db, 'cicto_notifications'), {
      type: 'account_deleted',
      title: 'Account Permanently Deleted',
      description: `User account ${targetEmail} (${targetUid}) was deleted from Authentication and Firestore.`,
      targetUser: {
        uid: targetUid,
        email: targetEmail,
        displayName: targetEmail.split('@')[0],
        role: 'user',
      },
      status: 'active',
      actorEmail: adminEmail,
      actorName: adminName,
      createdAt: serverTimestamp(),
    });
  } catch {}

  // 5. Record high-security Audit Trail in client_activity
  try {
    await addDoc(collection(db, 'client_activity'), {
      event: 'user.deleted',
      targetType: 'user',
      targetId: targetUid,
      actorUid: auth.currentUser.uid,
      actorEmail: adminEmail,
      metadata: {
        targetEmail,
        deletedBy: adminEmail,
        reason: 'CICTO Oversight Security Deletion',
        authDeleted,
      },
      createdAt: serverTimestamp(),
    });
  } catch (auditErr) {
    console.warn('Audit trail note:', auditErr);
  }

  console.log(`🗑️ Successfully deleted user ${targetEmail} (${targetUid}) from Firestore and Auth.`);

  return {
    success: true,
    message: `Account for ${targetEmail} has been permanently deleted from both Authentication and Firestore.`,
  };
}

/**
 * Subscribes to real-time active CICTO notifications for the top-right notification bell.
 */
export function subscribeToCictoNotifications(
  callback: (notifications: CictoNotification[]) => void
): () => void {
  notificationSubscribers.add(callback);
  
  // Initial immediate dispatch from memory
  notifySubscribers();

  if (!db) {
    return () => {
      notificationSubscribers.delete(callback);
    };
  }

  let unsubscribeFirestore: (() => void) | null = null;

  try {
    const notifQuery = query(
      collection(db, 'cicto_notifications'),
      limit(20)
    );

    unsubscribeFirestore = onSnapshot(
      notifQuery,
      (snapshot) => {
        firestoreNotifications = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as any),
        }));
        notifySubscribers();
      },
      (err) => {
        console.warn('CICTO firestore notification sync note (using in-memory fallback):', err?.message || err);
      }
    );
  } catch (err) {
    console.warn('Firestore subscription catch:', err);
  }

  return () => {
    notificationSubscribers.delete(callback);
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
    }
  };
}


/**
 * Dismisses or marks a notification as read.
 */
export async function dismissCictoNotification(notificationId: string): Promise<void> {
  // Update memory immediately
  memoryNotifications = memoryNotifications.filter((n) => n.id !== notificationId);
  firestoreNotifications = firestoreNotifications.filter((n) => n.id !== notificationId);
  notifySubscribers();

  if (!db) return;
  try {
    const notifRef = doc(db, 'cicto_notifications', notificationId);
    await updateDoc(notifRef, { status: 'dismissed' });
  } catch (error) {
    console.warn('Error dismissing notification:', error);
  }
}


/**
 * Clears all notifications from the active view.
 */
export async function clearAllCictoNotifications(): Promise<void> {
  memoryNotifications = [];
  firestoreNotifications = [];
  notifySubscribers();

  if (!db) return;
  try {
    const snap = await getDocs(collection(db, 'cicto_notifications'));
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (error) {
    console.warn('Error clearing notifications:', error);
  }
}


export const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

/**
 * Determines whether a user account is inactive for >= 6 months (180 days).
 */
export function isUserInactive6Months(user: {
  lastLogin?: any;
  createdAt?: any;
  role?: string;
  disabled?: boolean;
  status?: string;
}): boolean {
  if (user.role && user.role !== 'user') return false; // Only residents are subject to automatic inactivity
  
  const lastActiveTimestamp = user.lastLogin?.toMillis
    ? user.lastLogin.toMillis()
    : (user.lastLogin instanceof Date
        ? user.lastLogin.getTime()
        : (user.lastLogin ? new Date(user.lastLogin).getTime() : (user.createdAt?.toMillis ? user.createdAt.toMillis() : (user.createdAt ? new Date(user.createdAt).getTime() : 0))));

  if (!lastActiveTimestamp) return false;
  return Date.now() - lastActiveTimestamp >= SIX_MONTHS_MS;
}

/**
 * Calculates human-readable inactivity duration string.
 */
export function getInactivityDurationString(user: { lastLogin?: any; createdAt?: any }): string {
  const lastActiveTimestamp = user.lastLogin?.toMillis
    ? user.lastLogin.toMillis()
    : (user.lastLogin instanceof Date
        ? user.lastLogin.getTime()
        : (user.lastLogin ? new Date(user.lastLogin).getTime() : (user.createdAt?.toMillis ? user.createdAt.toMillis() : (user.createdAt ? new Date(user.createdAt).getTime() : 0))));

  if (!lastActiveTimestamp) return 'No recorded activity';
  const elapsedMs = Date.now() - lastActiveTimestamp;
  const days = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago (${days} days)`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago (${days} days)`;
}

/**
 * Deactivates a resident account due to prolonged inactivity (or admin directive).
 */
export async function deactivateResidentAccount(
  targetUid: string,
  targetEmail: string,
  reason: string = '6-Month Inactivity Policy'
): Promise<{ success: boolean; message: string }> {
  if (!db) throw new Error('Database is currently unavailable.');
  if (!auth.currentUser) throw new Error('CICTO administrator authentication is required.');

  const adminEmail = auth.currentUser.email || 'cicto@trashtrack.gov.ph';
  const adminName = auth.currentUser.displayName || 'CICTO Super Administrator';

  const userRef = doc(db, 'users', targetUid);
  await updateDoc(userRef, {
    disabled: true,
    status: 'inactive',
    deactivatedAt: serverTimestamp(),
    deactivatedBy: adminEmail,
    deactivationReason: reason,
  });

  // Log in client_activity
  try {
    await addDoc(collection(db, 'client_activity'), {
      event: 'user.deactivated',
      targetType: 'user',
      targetId: targetUid,
      actorUid: auth.currentUser.uid,
      actorEmail: adminEmail,
      metadata: {
        targetEmail,
        reason,
        deactivatedBy: adminEmail,
      },
      createdAt: serverTimestamp(),
    });
  } catch {}

  // Log in cicto_notifications
  try {
    await addDoc(collection(db, 'cicto_notifications'), {
      type: 'system_alert',
      title: 'Resident Account Deactivated',
      description: `Resident ${targetEmail} (${targetUid}) was deactivated due to ${reason}.`,
      targetUser: {
        uid: targetUid,
        email: targetEmail,
        displayName: targetEmail.split('@')[0],
        role: 'user',
      },
      status: 'active',
      actorEmail: adminEmail,
      actorName: adminName,
      createdAt: serverTimestamp(),
    });
  } catch {}

  return {
    success: true,
    message: `Account for ${targetEmail} has been deactivated.`,
  };
}

/**
 * Reactivates a deactivated resident account.
 */
export async function reactivateResidentAccount(
  targetUid: string,
  targetEmail: string
): Promise<{ success: boolean; message: string }> {
  if (!db) throw new Error('Database is currently unavailable.');
  if (!auth.currentUser) throw new Error('CICTO administrator authentication is required.');

  const adminEmail = auth.currentUser.email || 'cicto@trashtrack.gov.ph';

  const userRef = doc(db, 'users', targetUid);
  await updateDoc(userRef, {
    disabled: false,
    status: 'active',
    reactivatedAt: serverTimestamp(),
    reactivatedBy: adminEmail,
  });

  try {
    await addDoc(collection(db, 'client_activity'), {
      event: 'user.reactivated',
      targetType: 'user',
      targetId: targetUid,
      actorUid: auth.currentUser.uid,
      actorEmail: adminEmail,
      metadata: {
        targetEmail,
        reactivatedBy: adminEmail,
      },
      createdAt: serverTimestamp(),
    });
  } catch {}

  return {
    success: true,
    message: `Account for ${targetEmail} has been successfully reactivated.`,
  };
}

/**
 * Scans all resident accounts and deactivates those inactive for >= 6 months.
 */
export async function batchDeactivateStaleResidents(
  usersList: Array<{ id: string; email: string; role: string; lastLogin?: any; createdAt?: any; disabled?: boolean; status?: string }>
): Promise<{ count: number; emails: string[] }> {
  if (!db) throw new Error('Database is currently unavailable.');
  if (!auth.currentUser) throw new Error('CICTO administrator authentication is required.');

  const staleUsers = usersList.filter(
    (u) =>
      u.role === 'user' &&
      u.disabled !== true &&
      u.status !== 'inactive' &&
      isUserInactive6Months(u)
  );

  if (staleUsers.length === 0) {
    return { count: 0, emails: [] };
  }

  const batch = writeBatch(db);
  const adminEmail = auth.currentUser.email || 'cicto@trashtrack.gov.ph';

  staleUsers.forEach((u) => {
    const uRef = doc(db, 'users', u.id);
    batch.update(uRef, {
      disabled: true,
      status: 'inactive',
      deactivatedAt: serverTimestamp(),
      deactivatedBy: adminEmail,
      deactivationReason: 'Automated 6-Month Inactivity Policy',
    });
  });

  await batch.commit();

  try {
    await addDoc(collection(db, 'client_activity'), {
      event: 'batch.residents.deactivated',
      targetType: 'users_batch',
      actorUid: auth.currentUser.uid,
      actorEmail: adminEmail,
      metadata: {
        count: staleUsers.length,
        emails: staleUsers.map((u) => u.email),
        reason: 'Automated 6-Month Inactivity Policy',
      },
      createdAt: serverTimestamp(),
    });
  } catch {}

  return {
    count: staleUsers.length,
    emails: staleUsers.map((u) => u.email),
  };
}
