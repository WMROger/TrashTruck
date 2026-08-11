import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { auth, db } from '@/config/firebase';
import { cloudinaryService, UPLOAD_FOLDERS } from '@/services/cloudinaryService';
import { writeAuditLog } from '@/services/auditLogService';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';

const QUEUE_KEY = 'trashtrack.driver.offline-actions.v1';

type Measurement = { value: number; unit: 'kg' | 'ton' | 'm3'; bagCount: number | null };
type QueueItem = {
  id: string;
  action: 'completion' | 'issue';
  driverUid: string;
  scheduleId: string;
  imageUri: string;
  uploadedUrl?: string;
  location: { lat: number; lng: number };
  description: string;
  measurement?: Measurement;
  queuedAt: string;
  attempts: number;
};

export type DriverEvidencePayload = Omit<QueueItem, 'id' | 'action' | 'driverUid' | 'queuedAt' | 'attempts' | 'uploadedUrl'>;

const readQueue = async (): Promise<QueueItem[]> => {
  try {
    return JSON.parse(await AsyncStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
};

const saveQueue = (items: QueueItem[]) => AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));

const enqueue = async (action: QueueItem['action'], payload: DriverEvidencePayload, uploadedUrl?: string) => {
  const queue = await readQueue();
  const driverUid = auth.currentUser?.uid;
  if (!driverUid) throw new Error('An authenticated driver is required to queue evidence.');
  queue.push({
    ...payload,
    action,
    driverUid,
    uploadedUrl,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  });
  await saveQueue(queue);
};

const persist = async (item: QueueItem, imageUrl: string) => {
  if (item.action === 'completion') {
    await updateDoc(doc(db, 'schedules', item.scheduleId), {
      status: 'completed', completionImage: imageUrl, completionLocation: item.location,
      completionNotes: item.description, collectionMeasurement: item.measurement,
      completedByUid: item.driverUid,
      completedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    await writeAuditLog('pickup.completed', 'schedule', item.scheduleId, { measurement: item.measurement, offline: item.attempts > 0 });
  } else {
    await updateDoc(doc(db, 'schedules', item.scheduleId), {
      status: 'issue', issueImage: imageUrl, issueLocation: item.location,
      issueDescription: item.description, issueReportedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      reportedByUid: item.driverUid,
    });
    await writeAuditLog('pickup.issue_reported', 'schedule', item.scheduleId, { offline: item.attempts > 0 });
  }
};

async function submit(action: QueueItem['action'], payload: DriverEvidencePayload): Promise<{ queued: boolean; imageUrl?: string }> {
  const network = await NetInfo.fetch();
  if (!network.isConnected || network.isInternetReachable === false) {
    await enqueue(action, payload);
    return { queued: true };
  }

  let imageUrl: string | undefined;
  try {
    const upload = await cloudinaryService.uploadImage(payload.imageUri, { folder: UPLOAD_FOLDERS.REPORTS });
    if (!upload.success || !upload.url) throw new Error('Evidence upload failed');
    imageUrl = upload.url;
    await persist({ ...payload, action, driverUid: auth.currentUser?.uid || '', id: '', queuedAt: '', attempts: 0 }, imageUrl);
    return { queued: false, imageUrl };
  } catch {
    await enqueue(action, payload, imageUrl);
    return { queued: true, imageUrl };
  }
}

export const submitPickupCompletion = (payload: DriverEvidencePayload) => submit('completion', payload);
export const submitPickupIssue = (payload: DriverEvidencePayload) => submit('issue', payload);

export async function syncOfflineDriverActions(): Promise<{ synced: number; remaining: number }> {
  const network = await NetInfo.fetch();
  const queue = await readQueue();
  const driverUid = auth.currentUser?.uid;
  if (!network.isConnected || network.isInternetReachable === false || queue.length === 0) return { synced: 0, remaining: queue.length };

  const remaining: QueueItem[] = [];
  let synced = 0;
  for (const item of queue) {
    if (!driverUid || item.driverUid !== driverUid) {
      remaining.push(item);
      continue;
    }
    try {
      let imageUrl = item.uploadedUrl;
      if (!imageUrl) {
        const upload = await cloudinaryService.uploadImage(item.imageUri, { folder: UPLOAD_FOLDERS.REPORTS });
        if (!upload.success || !upload.url) throw new Error('Evidence upload failed');
        imageUrl = upload.url;
      }
      await persist({ ...item, attempts: item.attempts + 1 }, imageUrl);
      await writeAuditLog('offline_action.synced', 'schedule', item.scheduleId, { action: item.action, queuedAt: item.queuedAt });
      synced += 1;
    } catch {
      remaining.push({ ...item, attempts: item.attempts + 1 });
    }
  }
  await saveQueue(remaining);
  return { synced, remaining: remaining.length };
}

export const getOfflineQueueCount = async () => (await readQueue()).length;
