import { auth, db } from '@/config/firebase';
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';

export type DictOversightSnapshot = {
  generatedAt: string;
  counts: Record<string, number>;
  roles: Record<string, number>;
  operations: {
    activeFleet: number;
    staleFleet: number;
    pendingReports: number;
    completedSchedules: number;
    activeSchedules: number;
  };
  dataQuality: {
    reportsMissingGps: number;
    completedSchedulesMissingMeasurement: number;
    expensePeriods: number;
  };
  fleetLocations: any[];
  recentAudit: any[];
  recentErrors: any[];
  recentActivity: any[];
  expenseRecords: any[];
  messages: any[];
};

const normalizeValue = (value: any): any => {
  if (value?.toDate) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeValue(item)]));
  }
  return value;
};

const rows = (snapshot: any) => snapshot.docs.map((item: any) => ({ id: item.id, ...normalizeValue(item.data()) }));
const safeGet = async (reference: any) => getDocs(reference).catch(() => ({ docs: [], size: 0 } as any));

export async function getDictOversightSnapshot(): Promise<DictOversightSnapshot> {
  if (!db) throw new Error('Firestore is unavailable.');
  const [users, reports, schedules, trucks, locations, audit, errors, activity, expenses, messages, announcements] = await Promise.all([
    safeGet(collection(db, 'users')),
    safeGet(collection(db, 'reports')),
    safeGet(collection(db, 'schedules')),
    safeGet(collection(db, 'trucks')),
    safeGet(collection(db, 'truck_locations')),
    safeGet(query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(20))),
    safeGet(query(collection(db, 'error_logs'), orderBy('createdAt', 'desc'), limit(12))),
    safeGet(query(collection(db, 'client_activity'), orderBy('createdAt', 'desc'), limit(250))),
    safeGet(query(collection(db, 'analytics', 'expense_records', 'items'), orderBy('period', 'desc'), limit(100))),
    safeGet(query(collection(db, 'interagency_messages'), orderBy('createdAt', 'desc'), limit(30))),
    safeGet(collection(db, 'announcements')),
  ]);

  const userRows = rows(users);
  const reportRows = rows(reports);
  const scheduleRows = rows(schedules);
  const locationRows = rows(locations);
  const expenseRows = rows(expenses);
  const now = Date.now();
  const activeFleet = locationRows.filter((item: any) => (
    item.status === 'active' && now - new Date(item.lastUpdate || 0).getTime() <= 2 * 60 * 1000
  )).length;

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      users: users.size,
      reports: reports.size,
      schedules: schedules.size,
      trucks: trucks.size,
      announcements: announcements.size,
      expenses: expenses.size,
      auditEvents: audit.size,
      errorEvents: errors.size,
    },
    roles: userRows.reduce((summary: Record<string, number>, item: any) => {
      const role = String(item.role || 'user');
      summary[role] = (summary[role] || 0) + 1;
      return summary;
    }, {}),
    operations: {
      activeFleet,
      staleFleet: locationRows.filter((item: any) => item.status === 'active').length - activeFleet,
      pendingReports: reportRows.filter((item: any) => ['pending', 'acknowledged', 'in-progress'].includes(String(item.status))).length,
      completedSchedules: scheduleRows.filter((item: any) => ['completed', 'done'].includes(String(item.status))).length,
      activeSchedules: scheduleRows.filter((item: any) => ['pending', 'in-progress'].includes(String(item.status))).length,
    },
    dataQuality: {
      reportsMissingGps: reportRows.filter((item: any) => (
        !Number.isFinite(item.location?.lat ?? item.location?.latitude)
        || !Number.isFinite(item.location?.lng ?? item.location?.longitude)
      )).length,
      completedSchedulesMissingMeasurement: scheduleRows.filter((item: any) => (
        ['completed', 'done'].includes(String(item.status)) && !(Number(item.collectionMeasurement?.value) > 0)
      )).length,
      expensePeriods: new Set(expenseRows.map((item: any) => item.period).filter(Boolean)).size,
    },
    fleetLocations: locationRows,
    recentAudit: rows(audit),
    recentErrors: rows(errors),
    recentActivity: rows(activity),
    expenseRecords: expenseRows,
    messages: rows(messages),
  };
}

export async function sendDictCommand(input: { subject: string; message: string; priority: 'normal' | 'high' | 'urgent' }) {
  if (!db || !auth.currentUser) throw new Error('An authenticated DICT account is required.');
  const subject = input.subject.trim();
  const message = input.message.trim();
  if (subject.length < 3 || subject.length > 120 || message.length < 5 || message.length > 2000) {
    throw new Error('Enter a valid subject and command message.');
  }
  const messageRef = await addDoc(collection(db, 'interagency_messages'), {
    subject,
    message,
    priority: input.priority,
    senderUid: auth.currentUser.uid,
    senderRole: 'dict',
    status: 'sent',
    deliveryMode: 'spark-firestore',
    createdAt: serverTimestamp(),
  });
  const admins = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
  return { id: messageRef.id, recipientCount: admins.size };
}
