// This backend uses the stable first-generation callable/trigger API while
// running on the supported Node 20 runtime.
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const {
  validateProvisionInput,
  coordinateOf,
  haversineMeters,
  isScheduleForToday,
  clampRadius,
  notificationPreferenceAllows,
} = require('./lib/core');

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

async function requireCenroAdmin(context) {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication is required.');
  const profile = await db.collection('users').doc(context.auth.uid).get();
  const data = profile.data();
  const isActive = profile.exists && data?.disabled !== true && data?.status !== 'disabled';
  const isAdmin = context.auth.token?.admin === true || data?.role === 'admin';
  if (!isActive || !isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Active CENRO administrator access is required.');
  }
  return context.auth.uid;
}

async function provisionDriver(data, context) {
  const actorUid = await requireCenroAdmin(context);
  let input;
  try {
    input = validateProvisionInput(data);
  } catch (error) {
    throw new functions.https.HttpsError('invalid-argument', error.message);
  }

  let targetUser;
  let createdAuthUser = false;
  if (input.mode === 'create') {
    try {
      await admin.auth().getUserByEmail(input.email);
      throw new functions.https.HttpsError('already-exists', 'An account with this email already exists. Use resident upgrade instead.');
    } catch (error) {
      if (error instanceof functions.https.HttpsError) throw error;
      if (error.code !== 'auth/user-not-found') throw error;
    }
    targetUser = await admin.auth().createUser({
      email: input.email, password: input.password, emailVerified: true, displayName: input.fullName, disabled: false,
    });
    createdAuthUser = true;
  } else {
    targetUser = await admin.auth().getUser(input.existingUserId);
  }

  const userRef = db.collection('users').doc(targetUser.uid);
  const employeeRef = db.collection('employee_ids').doc(input.employeeId);
  const licenseRef = db.collection('license_numbers').doc(input.licenseNumber);
  const truckRef = input.truckId ? db.collection('trucks').doc(input.truckId) : null;
  try {
    await db.runTransaction(async transaction => {
      const [profileSnapshot, employeeSnapshot, licenseSnapshot, truckSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(employeeRef),
        transaction.get(licenseRef),
        truckRef ? transaction.get(truckRef) : Promise.resolve(null),
      ]);
      const existingProfile = profileSnapshot.data();
      if (input.mode === 'upgrade' && ['admin', 'dict'].includes(existingProfile?.role)) {
        throw new functions.https.HttpsError('failed-precondition', 'Elevated administrator accounts cannot be converted to drivers.');
      }
      if (employeeSnapshot.exists && employeeSnapshot.data()?.userId !== targetUser.uid) {
        throw new functions.https.HttpsError('already-exists', 'This employee ID is already assigned.');
      }
      if (licenseSnapshot.exists && licenseSnapshot.data()?.userId !== targetUser.uid) {
        throw new functions.https.HttpsError('already-exists', 'This license number is already assigned.');
      }
      if (truckSnapshot) {
        if (!truckSnapshot.exists) throw new functions.https.HttpsError('not-found', 'Selected truck does not exist.');
        const truck = truckSnapshot.data();
        if (truck.status !== 'active' || (truck.assignedDriverId && truck.assignedDriverId !== targetUser.uid)) {
          throw new functions.https.HttpsError('failed-precondition', 'Selected truck is not available.');
        }
      }

      transaction.set(userRef, {
        uid: targetUser.uid,
        email: targetUser.email || input.email,
        displayName: input.fullName || existingProfile?.displayName || targetUser.displayName || '',
        contactInfo: input.contactInfo || existingProfile?.contactInfo || '',
        employeeId: input.employeeId,
        licenseNumber: input.licenseNumber,
        role: 'driver',
        disabled: false,
        status: 'active',
        currentTruckId: input.truckId,
        currentTruckPlate: truckSnapshot?.data()?.plateNumber || null,
        provider: 'password',
        verified: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(profileSnapshot.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
      }, { merge: true });
      transaction.set(employeeRef, { userId: targetUser.uid, assignedAt: admin.firestore.FieldValue.serverTimestamp() });
      transaction.set(licenseRef, { userId: targetUser.uid, assignedAt: admin.firestore.FieldValue.serverTimestamp() });
      if (truckRef) transaction.update(truckRef, {
        assignedDriverId: targetUser.uid,
        assignedDriverName: input.fullName || existingProfile?.displayName || targetUser.displayName || targetUser.email,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.create(db.collection('audit_logs').doc(), {
        event: input.mode === 'create' ? 'driver.provisioned' : 'driver.upgraded',
        actorUid,
        targetType: 'user',
        targetId: targetUser.uid,
        metadata: { employeeId: input.employeeId, truckId: input.truckId },
        source: 'server',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    const existingClaims = targetUser.customClaims || {};
    await admin.auth().setCustomUserClaims(targetUser.uid, { ...existingClaims, admin: false, dict: false, driver: true, role: 'driver' });
    await admin.auth().revokeRefreshTokens(targetUser.uid);
    return { uid: targetUser.uid, email: targetUser.email, mode: input.mode, truckId: input.truckId };
  } catch (error) {
    if (createdAuthUser) await admin.auth().deleteUser(targetUser.uid).catch(() => undefined);
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('provisionDriver error', error);
    throw new functions.https.HttpsError('internal', 'Driver provisioning failed.');
  }
}

exports.provisionDriver = functions.https.onCall(provisionDriver);
// Callable to set/unset admin role by email (only admins can call)
exports.setAdminByEmail = functions.https.onCall(async (data, context) => {
  await requireCenroAdmin(context);
  const { email, makeAdmin } = data || {};
  if (!email || typeof email !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Parameter "email" is required');
  }
  const user = await admin.auth().getUserByEmail(email);
  const existingClaims = user.customClaims || {};
  await admin.auth().setCustomUserClaims(user.uid, {
    ...existingClaims,
    admin: !!makeAdmin,
    dict: false,
    driver: false,
    role: makeAdmin ? 'admin' : 'user',
  });
  await db.collection('users').doc(user.uid).set({
    tokenVersion: Date.now(),
    role: makeAdmin ? 'admin' : 'user',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  await admin.auth().revokeRefreshTokens(user.uid);
  await db.collection('audit_logs').add({
    event: makeAdmin ? 'user.admin_granted' : 'user.admin_revoked',
    actorUid: context.auth.uid,
    targetType: 'user',
    targetId: user.uid,
    source: 'server',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { uid: user.uid, email: user.email, admin: !!makeAdmin };
});

// Admin-only callable to set a user's role
exports.setUserRole = functions.https.onCall(async (data, context) => {
  await requireCenroAdmin(context);
  const userId = (data?.userId || '').toString();
  const role = (data?.role || '').toString();
  if (!userId || !role || !['user', 'admin', 'dict', 'coordinator'].includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid userId and role are required');
  }
  const target = await admin.auth().getUser(userId);
  const existingClaims = target.customClaims || {};
  await admin.auth().setCustomUserClaims(userId, {
    ...existingClaims,
    admin: role === 'admin',
    dict: role === 'dict',
    driver: false,
    role,
  });
  await db.collection('users').doc(userId).set({ role, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  await admin.auth().revokeRefreshTokens(userId);
  await db.collection('audit_logs').add({
    event: 'user.role_changed',
    actorUid: context.auth.uid,
    targetType: 'user',
    targetId: userId,
    metadata: { role },
    source: 'server',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

// Backward-compatible callable for the older admin screen. New CENRO flows use provisionDriver.
exports.createDriverAccount = functions.https.onCall(async (data, context) => {
  const username = String(data?.username || '').trim();
  return provisionDriver({
    mode: 'create', email: username.includes('@') ? username : `${username}@driver.com`,
    password: data?.password, fullName: username, employeeId: data?.employeeId,
    licenseNumber: data?.licenseNumber,
  }, context);
});

// Delete users who remain unverified for more than 10 minutes
exports.deleteStaleUnverifiedUsers = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
  const now = admin.firestore.Timestamp.now();
  const tenMinutesAgo = admin.firestore.Timestamp.fromMillis(now.toMillis() - 10 * 60 * 1000);

  const batch = db.batch();
  const staleSnap = await db
    .collection('users')
    .where('verified', '==', false)
    .where('createdAt', '<=', tenMinutesAgo)
    .get();

  for (const docSnap of staleSnap.docs) {
    batch.delete(docSnap.ref);
  }

  if (!staleSnap.empty) {
    await batch.commit();
  }

  return null;
});

async function sendFcmNotification(notificationRef, notification) {
  const userId = String(notification.userId || '');
  if (!userId) return { skipped: 'missing-user' };
  const [profile, settings, devices] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('user_settings').doc(userId).get(),
    db.collection('users').doc(userId).collection('devices').where('enabled', '==', true).get(),
  ]);
  if (!profile.exists || profile.data()?.disabled === true || profile.data()?.status === 'disabled') return { skipped: 'inactive-user' };
  if (!notificationPreferenceAllows(settings.data()?.notificationPreferences, notification.type)) return { skipped: 'preference' };

  const deviceDocs = devices.docs.filter(device => device.data().platform === 'android' && device.data().tokenType === 'fcm');
  if (!deviceDocs.length) return { skipped: 'no-fcm-token' };
  let successCount = 0;
  let failureCount = 0;
  for (let offset = 0; offset < deviceDocs.length; offset += 500) {
    const batchDocs = deviceDocs.slice(offset, offset + 500);
    const response = await admin.messaging().sendEachForMulticast({
      tokens: batchDocs.map(device => device.data().token),
      notification: { title: String(notification.title || 'TrashTrack'), body: String(notification.body || '') },
      data: { notificationId: notificationRef.id, type: String(notification.type || 'general') },
      android: { priority: 'high', notification: { channelId: 'trashtrack-alerts' } },
    });
    successCount += response.successCount;
    failureCount += response.failureCount;
    const cleanup = db.batch();
    let cleanupCount = 0;
    response.responses.forEach((result, index) => {
      if (!result.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(result.error?.code)) {
        cleanup.delete(batchDocs[index].ref);
        cleanupCount += 1;
      }
    });
    if (cleanupCount > 0) await cleanup.commit();
  }
  return { successCount, failureCount };
}

async function claimPushDelivery(notificationRef, eventId) {
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(notificationRef);
    const delivery = snapshot.data()?.pushDelivery;
    if (['processing', 'sent', 'skipped'].includes(delivery?.status)) return false;
    transaction.set(notificationRef, {
      pushDelivery: {
        status: 'processing',
        eventId,
        attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    }, { merge: true });
    return true;
  });
}

exports.onUserNotificationCreated = functions.firestore.document('userNotifications/{notificationId}').onCreate(async (snapshot, context) => {
  const claimed = await claimPushDelivery(snapshot.ref, context.eventId);
  if (!claimed) return null;
  try {
    const result = await sendFcmNotification(snapshot.ref, snapshot.data());
    await snapshot.ref.set({
      pushDelivery: {
        status: result.skipped ? 'skipped' : (result.successCount > 0 ? 'sent' : 'failed'),
        reason: result.skipped || null,
        successCount: result.successCount || 0,
        failureCount: result.failureCount || 0,
        eventId: context.eventId,
        attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    }, { merge: true });
    return result;
  } catch (error) {
    console.error('FCM delivery failed', snapshot.id, error);
    await snapshot.ref.set({
      pushDelivery: {
        status: 'failed',
        error: String(error.message || error),
        eventId: context.eventId,
        attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    }, { merge: true });
    return null;
  }
});

exports.onTruckLocationWritten = functions.firestore.document('truck_locations/{driverId}').onWrite(async (change, context) => {
  const location = change.after.exists ? change.after.data() : null;
  const truckCoordinate = coordinateOf(location);
  if (!location || location.status !== 'active' || !truckCoordinate) return null;

  const assignedSchedules = await db.collection('schedules')
    .where('assignedDriverId', '==', context.params.driverId)
    .where('status', 'in', ['pending', 'in-progress'])
    .get();
  const activeSchedules = assignedSchedules.docs.filter(schedule => {
    const data = schedule.data();
    return isScheduleForToday(data.dateText);
  });

  for (const scheduleSnapshot of activeSchedules) {
    const schedule = scheduleSnapshot.data();
    let report = null;
    if (schedule.reportId && (!schedule.userId || !coordinateOf(schedule.location))) {
      const reportSnapshot = await db.collection('reports').doc(schedule.reportId).get();
      if (reportSnapshot.exists) report = reportSnapshot.data();
    }
    const target = coordinateOf(report?.location || schedule.location);
    const userId = report?.userId || schedule.userId;
    if (!target || !userId) continue;

    const settingsSnapshot = await db.collection('user_settings').doc(userId).get();
    const preferences = settingsSnapshot.data()?.notificationPreferences;
    if (!notificationPreferenceAllows(preferences, 'truck_proximity')) continue;
    const radiusMeters = clampRadius(preferences?.proximityRadiusMeters);
    const distanceMeters = haversineMeters(truckCoordinate, target);
    if (distanceMeters > radiusMeters) continue;

    const alertRef = db.collection('proximity_alerts').doc(`${scheduleSnapshot.id}_${userId}`);
    await db.runTransaction(async transaction => {
      const existingAlert = await transaction.get(alertRef);
      if (existingAlert.exists) return;
      const notificationRef = db.collection('userNotifications').doc();
      transaction.create(alertRef, {
        scheduleId: scheduleSnapshot.id,
        reportId: schedule.reportId || null,
        userId,
        driverId: context.params.driverId,
        radiusMeters,
        distanceMeters: Math.round(distanceMeters),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.create(notificationRef, {
        userId,
        title: 'Collection Truck Nearby',
        body: `Your assigned truck is approximately ${Math.max(10, Math.round(distanceMeters / 10) * 10)} metres from ${schedule.street || report?.street || 'your pickup location'}.`,
        type: 'truck_proximity',
        scheduleId: scheduleSnapshot.id,
        reportId: schedule.reportId || null,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  }
  return null;
});

exports.auditScheduleWrite = functions.firestore.document('schedules/{scheduleId}').onWrite(async (change, context) => {
  const before = change.before.exists ? change.before.data() : null;
  const after = change.after.exists ? change.after.data() : null;
  const statusChanged = before?.status !== after?.status;
  if (before && after && !statusChanged) return null;
  const event = !before ? 'schedule.created' : !after ? 'schedule.deleted' : `schedule.${after.status || 'updated'}`;
  const auditId = String(context.eventId).replace(/[^A-Za-z0-9_-]/g, '_');
  return db.collection('audit_logs').doc(auditId).set({
    event,
    actorUid: after?.completedByUid || after?.reportedByUid || after?.createdByUid || after?.assignedDriverId || before?.assignedDriverId || null,
    targetType: 'schedule',
    targetId: context.params.scheduleId,
    metadata: { previousStatus: before?.status || null, status: after?.status || null },
    source: 'server-trigger',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: false });
});

// Sample documents for RAG (you can replace this with your own documents)
const sampleDocuments = [
  {
    id: 'doc1',
    content: 'TrashTrack is a waste management app that helps users track and manage their waste efficiently. The app provides tools for monitoring waste generation, setting recycling goals, and learning about sustainable practices.',
    keywords: ['waste', 'management', 'tracking', 'recycling', 'sustainability']
  },
  {
    id: 'doc2',
    content: 'The app features include: waste categorization, recycling tips, progress tracking, community challenges, and educational content about environmental impact.',
    keywords: ['features', 'categorization', 'tips', 'progress', 'community', 'education']
  },
  {
    id: 'doc3',
    content: 'Users can set personal waste reduction goals, track their daily waste generation, and receive personalized recommendations for improving their environmental footprint.',
    keywords: ['goals', 'tracking', 'recommendations', 'environmental', 'footprint']
  },
  {
    id: 'doc4',
    content: 'The app integrates with local recycling programs and provides information about proper waste disposal methods for different types of materials.',
    keywords: ['recycling', 'programs', 'disposal', 'materials', 'local']
  }
];

// Simple keyword-based document retrieval with trash-domain allowlist
function getRelevantDocs(query) {
  const queryLower = query.toLowerCase();
  const domainKeywords = [
    'trash','waste','recycle','recycling','compost','garbage','bin','landfill','plastic','paper','glass','metal',
    'e-waste','organic','hazardous','disposal','segregation','collection','pickup','schedule','litter','pollution',
    'sustainability','environment','eco','composting','reuse','reduce','sorting','incineration','municipal',
    'trashtrack','trash track','app','driver','route','dump','junk','debris','scrap','rubbish','refuse'
  ];

  const isInDomain = domainKeywords.some(k => queryLower.includes(k));
  if (!isInDomain) {
    return [];
  }

  const relevantDocs = sampleDocuments.filter(doc => {
    return doc.keywords.some(keyword => 
      queryLower.includes(keyword.toLowerCase())
    ) || doc.content.toLowerCase().includes(queryLower);
  });
  
  // Return top 2 most relevant documents
  return relevantDocs.slice(0, 2);
}

exports.chatWithRAG = functions.https.onCall(async (data, context) => {
  try {
    const { query } = data;
    
    if (!query) {
      throw new functions.https.HttpsError('invalid-argument', 'Query is required');
    }

    // Step 0: Hard domain guardrail
    const domainKeywords = [
      'trash','waste','recycle','recycling','compost','garbage','bin','landfill','plastic','paper','glass','metal',
      'e-waste','organic','hazardous','disposal','segregation','collection','pickup','schedule','litter','pollution',
      'sustainability','environment','eco','composting','reuse','reduce','sorting','incineration','municipal',
      'trashtrack','trash track','app','driver','route','dump','junk','debris','scrap','rubbish','refuse'
    ];
    const inDomain = domainKeywords.some(k => query.toLowerCase().includes(k));
    
    // Step 1: Retrieve relevant documents (only if in domain)
    const relevantDocs = inDomain ? getRelevantDocs(query) : [];
    
    // Step 2: Format context from documents
    const context = relevantDocs.length > 0 
      ? relevantDocs.map(doc => doc.content).join('\n\n')
      : 'No specific information available about this topic.';

    // Step 3: Create prompt for Groq API
    const prompt = `You are a helpful AI assistant for TrashTrack, a waste management app. ONLY answer questions related to trash, recycling, waste disposal, composting, sustainability, or the TrashTrack app itself. If the user asks something outside these topics, politely refuse and suggest asking about waste-related topics.

Context:
${context}

User Question: ${query}

Please provide a helpful and informative response:`;

    // Step 4: Call Groq API (you'll need to add your GROQ_API_KEY to Firebase Functions config)
    const groqApiKey = functions.config().groq?.key;
    
    if (!groqApiKey) {
      // Fallback response if Groq API key is not configured
      return {
        reply: `I understand you're asking about: "${query}". While I'm still being configured with advanced AI capabilities, I can help you with general waste management questions. For specific features of TrashTrack, please check the app's help section or contact support.`
      };
    }

    const groqResponse = await fetch('https://api.groq.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content: "You are a TrashTrack AI assistant. STRICTLY limit responses to waste management: trash, recycling, composting, disposal rules, pickup schedules, sustainability tips, and TrashTrack app support. If out-of-domain, respond with a brief refusal and guide the user back to trash-related topics."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!groqResponse.ok) {
      throw new Error(`Groq API error: ${groqResponse.status}`);
    }

    const groqResult = await groqResponse.json();
    const aiReply = groqResult.choices[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';

    // Step 5: Log the interaction (optional)
    await db.collection('chat_logs').add({
      query,
      context: relevantDocs.map(doc => doc.id),
      reply: aiReply,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      reply: aiReply
    };

  } catch (error) {
    console.error('Error in chatWithRAG:', error);
    throw new functions.https.HttpsError('internal', 'Failed to process chat request');
  }
});

// Optional: Function to add documents to the knowledge base
exports.addDocument = functions.https.onCall(async (data, context) => {
  try {
    const { content, keywords } = data;
    
    if (!content) {
      throw new functions.https.HttpsError('invalid-argument', 'Content is required');
    }

    const docRef = await db.collection('documents').add({
      content,
      keywords: keywords || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      id: docRef.id,
      message: 'Document added successfully'
    };

  } catch (error) {
    console.error('Error adding document:', error);
    throw new functions.https.HttpsError('internal', 'Failed to add document');
  }
});
