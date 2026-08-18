import { auth, db } from '@/config/firebase';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';

export type RewardSouvenir = {
  id: string;
  name: string;
  type: string;
  cost: number;
  stock?: number;
  category?: string;
  createdAt?: any;
};

export const COMPLETION_REWARD_TOKENS = 50;

export const DEFAULT_REWARD_SOUVENIRS: RewardSouvenir[] = [
  { id: 'tumbler', name: 'Eco-Friendly Tumbler', type: 'Matte Green, Double-walled insulation', cost: 1000, category: 'Merchandise', stock: 50 },
  { id: 'tote', name: 'CENRO Tote Bag', type: 'Canvas, Heavy Duty', cost: 500, category: 'Apparel', stock: 100 },
  { id: 'kit', name: 'Reusable Utensil Kit', type: 'Bamboo with pouch', cost: 2000, category: 'Eco Kit', stock: 30 },
];

export const REWARD_SOUVENIRS = DEFAULT_REWARD_SOUVENIRS;

type ScheduleRewardSource = {
  status?: string;
  reportId?: string;
  userId?: string;
  completedByUid?: string;
  collectionMeasurement?: { value?: number };
};

export type RewardReconciliation = {
  scanned: number;
  awarded: number;
  alreadyAwarded: number;
  ineligible: number;
};

export async function awardVerifiedCompletion(
  scheduleId: string,
  source?: ScheduleRewardSource,
): Promise<'awarded' | 'already-awarded' | 'ineligible'> {
  if (!db || !scheduleId) return 'ineligible';
  const schedule = source || (await getDoc(doc(db, 'schedules', scheduleId))).data() as ScheduleRewardSource | undefined;
  const status = String(schedule?.status || '').toLowerCase();
  const reportId = String(schedule?.reportId || '').trim();
  const userId = String(schedule?.userId || '').trim();
  if (
    !['completed', 'done'].includes(status)
    || !reportId
    || !userId
    || !schedule?.completedByUid
    || !(Number(schedule?.collectionMeasurement?.value) > 0)
  ) return 'ineligible';

  const awardRef = doc(db, 'reward_awards', `report_${reportId}`);
  try {
    if ((await getDoc(awardRef)).exists()) return 'already-awarded';
  } catch (error: any) {
    // Drivers can create their assigned award but cannot browse citizen ledgers.
    if (error?.code !== 'permission-denied' && error?.code !== 'unavailable') throw error;
  }
  try {
    await setDoc(awardRef, {
      userId,
      reportId,
      scheduleId,
      tokens: COMPLETION_REWARD_TOKENS,
      reason: 'verified-collection-completed',
      createdByUid: auth.currentUser?.uid || schedule.completedByUid,
      awardedAt: serverTimestamp(),
    });
  } catch (error: any) {
    // A deterministic award ID turns a second create into a denied update.
    if (error?.code === 'permission-denied') return 'already-awarded';
    throw error;
  }
  return 'awarded';
}

export async function reconcileCompletedRewardAwards(): Promise<RewardReconciliation> {
  if (!db) throw new Error('Firestore is unavailable.');
  const completed = await getDocs(query(
    collection(db, 'schedules'),
    where('status', 'in', ['completed', 'done']),
    limit(200),
  ));
  const summary: RewardReconciliation = { scanned: completed.size, awarded: 0, alreadyAwarded: 0, ineligible: 0 };
  for (const schedule of completed.docs) {
    try {
      const result = await awardVerifiedCompletion(schedule.id, schedule.data() as ScheduleRewardSource);
      if (result === 'awarded') summary.awarded += 1;
      else if (result === 'already-awarded') summary.alreadyAwarded += 1;
      else summary.ineligible += 1;
    } catch (error: any) {
      if (error?.code === 'permission-denied') throw error;
      summary.ineligible += 1;
    }
  }
  return summary;
}

export async function addRewardCatalogItem(item: {
  name: string;
  type: string;
  cost: number;
  stock?: number;
  category?: string;
}) {
  if (!db) throw new Error('Firestore is unavailable.');
  const id = item.name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36);
  
  const newItem: RewardSouvenir = {
    id,
    name: item.name.trim(),
    type: item.type.trim(),
    cost: Number(item.cost),
    stock: Number(item.stock || 50),
    category: item.category?.trim() || 'General',
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'reward_catalog', id), newItem);
  return newItem;
}

export async function deleteRewardCatalogItem(id: string) {
  if (!db) throw new Error('Firestore is unavailable.');
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'reward_catalog', id));
}

export async function adjustCitizenPoints(
  userId: string,
  userName: string,
  deltaTokens: number,
  reason: string,
  currentBalance: number
) {
  if (!db || !auth.currentUser) throw new Error('Authentication required.');

  const awardDocRef = doc(collection(db, 'reward_awards'));
  const timestamp = serverTimestamp();

  await setDoc(awardDocRef, {
    userId,
    userName,
    tokens: deltaTokens,
    reason: `dict_adjustment: ${reason.trim()}`,
    adjustedBy: 'DICT Super Admin',
    createdByUid: auth.currentUser.uid,
    actorEmail: auth.currentUser.email || 'dict@trashtrack.gov.ph',
    awardedAt: timestamp,
    previousBalance: currentBalance,
    newBalance: Math.max(0, currentBalance + deltaTokens),
  });

  // Record into client activity audit trail
  try {
    const { writeAuditLog } = await import('./auditLogService');
    await writeAuditLog('notification.preferences_updated' as any, 'citizen_points', userId, {
      action: 'dict_adjust_points',
      actorEmail: auth.currentUser.email || 'dict@trashtrack.gov.ph',
      deltaTokens,
      reason,
      previousBalance: currentBalance,
      newBalance: Math.max(0, currentBalance + deltaTokens),
    });
  } catch (auditErr) {
    console.warn('Audit logging note:', auditErr);
  }

  return {
    id: awardDocRef.id,
    deltaTokens,
    newBalance: Math.max(0, currentBalance + deltaTokens),
  };
}

export async function redeemRewardFromLedger(userId: string, userName: string, souvenir: RewardSouvenir) {
  if (!db || !auth.currentUser) throw new Error('An authenticated DICT account is required.');
  const redemption = await addDoc(collection(db, 'reward_redemptions'), {
    userId,
    userName,
    souvenirId: souvenir.id,
    souvenirName: souvenir.name,
    cost: souvenir.cost,
    issuedByUid: auth.currentUser.uid,
    issuedAt: serverTimestamp(),
    status: 'completed',
    mode: 'spark-ledger',
  });
  return redemption.id;
}
