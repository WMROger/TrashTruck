import { auth, db } from '@/config/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

export type AuditEvent =
  | 'pickup.completed'
  | 'pickup.issue_reported'
  | 'route.dispatched'
  | 'offline_action.synced'
  | 'notification.preferences_updated';

export async function writeAuditLog(event: AuditEvent, targetType: string, targetId: string, metadata: Record<string, unknown> = {}) {
  const user = auth.currentUser;
  if (!user || !db) return;
  try {
    // Client activity is useful diagnostic evidence, but it is not an authoritative
    // audit trail. Server triggers write the protected audit_logs collection.
    await addDoc(collection(db, 'client_activity'), {
      event,
      targetType,
      targetId,
      actorUid: user.uid,
      actorEmail: user.email || null,
      metadata,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Auditing should be observable but must not discard a completed field operation.
    console.warn('Unable to write audit log:', error);
  }
}
