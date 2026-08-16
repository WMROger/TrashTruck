'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertFails, assertSucceeds, initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } = require('firebase/firestore');

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

test('Firestore rules enforce role, ownership, and driver boundaries', { skip: !emulatorAvailable }, async t => {
  const environment = await initializeTestEnvironment({
    projectId: 'trashtrack-rules-test',
    firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });

  t.after(async () => environment.cleanup());
  await environment.withSecurityRulesDisabled(async context => {
    const firestore = context.firestore();
    const users = [
      ['admin-1', { uid: 'admin-1', email: 'admin@example.com', role: 'admin', status: 'active', disabled: false }],
      ['dict-1', { uid: 'dict-1', email: 'dict@example.com', role: 'dict', status: 'active', disabled: false }],
      ['resident-1', { uid: 'resident-1', email: 'one@example.com', role: 'user', status: 'active', disabled: false }],
      ['resident-2', { uid: 'resident-2', email: 'two@example.com', role: 'user', status: 'active', disabled: false }],
      ['resident-legacy', { uid: 'resident-legacy', email: 'legacy@example.com', role: 'user' }],
      ['driver-1', { uid: 'driver-1', email: 'driver@example.com', role: 'driver', status: 'active', disabled: false, currentTruckId: 'truck-1' }],
    ];
    for (const [id, data] of users) await setDoc(doc(firestore, 'users', id), data);
    await setDoc(doc(firestore, 'trucks', 'truck-1'), {
      plateNumber: 'ABC-123', status: 'active', assignedDriverId: 'driver-1', assignedDriverName: 'Driver One',
    });
    await setDoc(doc(firestore, 'reports', 'report-1'), { userId: 'resident-1', status: 'pending', street: 'Rizal Street' });
    await setDoc(doc(firestore, 'reports', 'report-2'), { userId: 'resident-2', status: 'pending', street: 'Bonifacio Street' });
    await setDoc(doc(firestore, 'schedules', 'schedule-1'), {
      assignedDriverId: 'driver-1', userId: 'resident-1', reportId: 'report-1', status: 'pending', street: 'Rizal Street',
    });
  });

  const resident = environment.authenticatedContext('resident-1', { email: 'one@example.com' }).firestore();
  const otherResident = environment.authenticatedContext('resident-2', { email: 'two@example.com' }).firestore();
  const driver = environment.authenticatedContext('driver-1', { email: 'driver@example.com', role: 'driver' }).firestore();
  const admin = environment.authenticatedContext('admin-1', { email: 'admin@example.com', role: 'admin' }).firestore();
  const dictUser = environment.authenticatedContext('dict-1', { email: 'dict@example.com', role: 'dict' }).firestore();
  const legacyResident = environment.authenticatedContext('resident-legacy', { email: 'legacy@example.com' }).firestore();

  await t.test('residents cannot promote themselves or mutate fleet configuration', async () => {
    await assertFails(updateDoc(doc(resident, 'users', 'resident-1'), { role: 'admin' }));
    await assertFails(addDoc(collection(resident, 'trucks'), { plateNumber: 'MAL-001', status: 'active' }));
    await assertFails(addDoc(collection(resident, 'barangay_schedules'), { barangayName: 'Poblacion' }));
  });

  await t.test('admins can manage protected operational records', async () => {
    await assertSucceeds(addDoc(collection(admin, 'trucks'), { plateNumber: 'NEW-001', status: 'active' }));
    await assertSucceeds(addDoc(collection(admin, 'barangay_schedules'), { barangayName: 'Poblacion' }));
    await assertSucceeds(addDoc(collection(admin, 'schedules'), { assignedDriverId: 'driver-1', status: 'pending' }));
    await assertSucceeds(setDoc(doc(admin, 'employee_ids', 'CENRO-2026-001'), { userId: 'driver-1', assignedAt: new Date() }));
    await assertSucceeds(setDoc(doc(admin, 'license_numbers', 'N01-23-456789'), { userId: 'driver-1', assignedAt: new Date() }));
    await assertSucceeds(setDoc(doc(admin, 'coordinator_employee_ids', 'CENRO-COORD-001'), { userId: 'resident-2', assignedAt: new Date() }));
    await assertFails(setDoc(doc(resident, 'employee_ids', 'FAKE-001'), { userId: 'resident-1' }));
    await assertFails(setDoc(doc(resident, 'coordinator_employee_ids', 'FAKE-COORD'), { userId: 'resident-1' }));
    await assertFails(getDoc(doc(resident, 'license_numbers', 'N01-23-456789')));
  });

  await t.test('report access is owner-scoped and query-compatible', async () => {
    await assertSucceeds(getDoc(doc(resident, 'reports', 'report-1')));
    await assertFails(getDoc(doc(resident, 'reports', 'report-2')));
    const ownReports = await assertSucceeds(getDocs(query(collection(resident, 'reports'), where('userId', '==', 'resident-1'))));
    assert.equal(ownReports.size, 1);
    await assertFails(getDocs(query(collection(resident, 'reports'), where('status', '==', 'pending'))));
  });

  await t.test('legacy active profiles without explicit status flags remain usable', async () => {
    await assertSucceeds(addDoc(collection(legacyResident, 'reports'), {
      userId: 'resident-legacy', status: 'pending', street: 'Legacy Street',
    }));
  });

  await t.test('drivers can publish only their own truck location', async () => {
    await assertSucceeds(setDoc(doc(driver, 'truck_locations', 'driver-1'), {
      driverId: 'driver-1', truckId: 'truck-1', lat: 10.52, lng: 124.03, status: 'active',
    }));
    await assertFails(setDoc(doc(driver, 'truck_locations', 'driver-2'), {
      driverId: 'driver-2', truckId: 'truck-1', lat: 10.52, lng: 124.03, status: 'active',
    }));
  });

  await t.test('assigned drivers can submit evidence but cannot reassign routes', async () => {
    await assertSucceeds(updateDoc(doc(driver, 'schedules', 'schedule-1'), {
      status: 'completed',
      completedByUid: 'driver-1',
      completionImage: 'https://example.com/evidence.jpg',
      completionLocation: { lat: 10.52, lng: 124.03 },
      collectionMeasurement: { value: 42, unit: 'kg', bagCount: 3 },
    }));
    await assertFails(updateDoc(doc(driver, 'schedules', 'schedule-1'), { assignedDriverId: 'driver-2' }));
  });

  await t.test('verified completions create one immutable reward ledger award', async () => {
    const award = {
      userId: 'resident-1', reportId: 'report-1', scheduleId: 'schedule-1', tokens: 100,
      reason: 'verified-collection-completed', createdByUid: 'driver-1', awardedAt: new Date(),
    };
    await assertSucceeds(setDoc(doc(driver, 'reward_awards', 'report_report-1'), award));
    await assertFails(setDoc(doc(driver, 'reward_awards', 'report_report-1'), award));
    await assertSucceeds(getDoc(doc(resident, 'reward_awards', 'report_report-1')));
    await assertFails(getDoc(doc(otherResident, 'reward_awards', 'report_report-1')));
    await assertFails(setDoc(doc(resident, 'reward_awards', 'report_report-2'), { ...award, reportId: 'report-2' }));
    const redemption = await assertSucceeds(addDoc(collection(dictUser, 'reward_redemptions'), {
      userId: 'resident-1', souvenirId: 'tote', souvenirName: 'CENRO Tote Bag', cost: 500,
      issuedByUid: 'dict-1', issuedAt: new Date(), status: 'completed', mode: 'spark-ledger',
    }));
    await assertSucceeds(getDoc(doc(resident, 'reward_redemptions', redemption.id)));
    await assertFails(getDoc(doc(otherResident, 'reward_redemptions', redemption.id)));
    await assertFails(updateDoc(doc(dictUser, 'reward_redemptions', redemption.id), { cost: 1 }));
    await assertFails(deleteDoc(doc(dictUser, 'reward_redemptions', redemption.id)));
    await assertFails(addDoc(collection(dictUser, 'reward_redemptions'), {
      userId: 'resident-1', souvenirId: 'tote', souvenirName: 'CENRO Tote Bag', cost: 1,
      issuedByUid: 'dict-1', issuedAt: new Date(), status: 'completed', mode: 'spark-ledger',
    }));
  });

  await t.test('DICT oversight works directly on Spark without Cloud Functions', async () => {
    await assertSucceeds(getDocs(collection(dictUser, 'reports')));
    await assertSucceeds(getDocs(collection(dictUser, 'schedules')));
    await assertSucceeds(updateDoc(doc(dictUser, 'users', 'resident-2'), { role: 'coordinator', updatedAt: new Date() }));
    await assertFails(updateDoc(doc(dictUser, 'users', 'dict-1'), { role: 'user', updatedAt: new Date() }));
    await assertFails(updateDoc(doc(dictUser, 'users', 'resident-1'), { tokens: 99999 }));
    await assertSucceeds(addDoc(collection(dictUser, 'interagency_messages'), {
      subject: 'Route review', message: 'Review the high-priority collection route.', priority: 'high',
      senderUid: 'dict-1', senderRole: 'dict', status: 'sent', deliveryMode: 'spark-firestore', createdAt: new Date(),
    }));
    await assertSucceeds(getDocs(collection(admin, 'interagency_messages')));
    await assertFails(addDoc(collection(resident, 'interagency_messages'), {
      subject: 'Fake command', message: 'This must not be accepted.', priority: 'urgent',
      senderUid: 'resident-1', senderRole: 'dict', status: 'sent', createdAt: new Date(),
    }));
  });

  await t.test('resident-to-CENRO-to-driver-to-DICT capstone workflow succeeds', async () => {
    await assertSucceeds(setDoc(doc(resident, 'reports', 'e2e-report'), {
      userId: 'resident-1', status: 'pending', title: 'Roadside waste', street: 'Rizal Street',
      barangay: 'Poblacion', location: { lat: 10.52, lng: 124.03 }, createdAt: new Date(),
    }));
    await assertSucceeds(setDoc(doc(admin, 'schedules', 'e2e-schedule'), {
      reportId: 'e2e-report', userId: 'resident-1', assignedDriverId: 'driver-1', truckId: 'truck-1',
      status: 'pending', street: 'Rizal Street', location: { lat: 10.52, lng: 124.03 }, createdAt: new Date(),
    }));
    await assertSucceeds(updateDoc(doc(admin, 'reports', 'e2e-report'), { status: 'in-progress', updatedAt: new Date() }));
    await assertSucceeds(updateDoc(doc(driver, 'schedules', 'e2e-schedule'), {
      status: 'completed', completedByUid: 'driver-1', completedAt: new Date(), updatedAt: new Date(),
      completionImage: 'https://example.com/completion.jpg', completionLocation: { lat: 10.52, lng: 124.03 },
      collectionMeasurement: { value: 125, unit: 'kg', bagCount: 8 },
    }));
    await assertSucceeds(setDoc(doc(driver, 'reward_awards', 'report_e2e-report'), {
      userId: 'resident-1', reportId: 'e2e-report', scheduleId: 'e2e-schedule', tokens: 100,
      reason: 'verified-collection-completed', createdByUid: 'driver-1', awardedAt: new Date(),
    }));
    const awards = await assertSucceeds(getDocs(query(collection(dictUser, 'reward_awards'), where('userId', '==', 'resident-1'))));
    assert.ok(awards.docs.some(item => item.id === 'report_e2e-report'));
  });

  await t.test('device tokens are owner-scoped and audit records are server-protected', async () => {
    await assertSucceeds(setDoc(doc(resident, 'users', 'resident-1', 'devices', 'device-1'), {
      token: 'native-fcm-token', tokenType: 'fcm', platform: 'android', enabled: true,
    }));
    await assertFails(setDoc(doc(otherResident, 'users', 'resident-1', 'devices', 'device-2'), {
      token: 'stolen-token', tokenType: 'fcm', platform: 'android', enabled: true,
    }));
    await assertFails(addDoc(collection(resident, 'audit_logs'), { actorUid: 'resident-1', event: 'fake.admin.event' }));
    await assertSucceeds(addDoc(collection(resident, 'client_activity'), { actorUid: 'resident-1', event: 'screen.opened' }));
    await assertFails(addDoc(collection(resident, 'proximity_alerts'), { userId: 'resident-1' }));
  });
});
