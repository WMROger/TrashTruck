const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');

if (!fs.existsSync(keyPath)) {
  console.error('❌ serviceAccountKey.json was not found in the root directory.');
  console.log('To run admin CLI scripts, download serviceAccountKey.json from Firebase Console.');
  process.exit(1);
}

const serviceAccount = require(keyPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

async function deleteUserAccount(identifier) {
  if (!identifier) {
    console.error('❌ Please provide an email or UID to delete:');
    console.log('   Usage: node scripts/delete-user.js <email_or_uid>');
    process.exit(1);
  }

  const cleanIdentifier = identifier.trim();
  let userRecord;

  try {
    if (cleanIdentifier.includes('@')) {
      userRecord = await auth.getUserByEmail(cleanIdentifier);
    } else {
      userRecord = await auth.getUser(cleanIdentifier);
    }
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.warn(`⚠️ User "${cleanIdentifier}" not found in Firebase Auth. Searching Firestore only...`);
    } else {
      console.error(`❌ Error fetching user from Firebase Auth:`, err.message);
      process.exit(1);
    }
  }

  const uid = userRecord ? userRecord.uid : cleanIdentifier;
  const email = userRecord ? userRecord.email : cleanIdentifier;

  console.log(`\n🚨 Starting deletion for user: ${email} (UID: ${uid})`);

  // 1. Delete from Firebase Authentication
  if (userRecord) {
    try {
      await auth.deleteUser(uid);
      console.log('✅ 1. Deleted from Firebase Authentication.');
    } catch (authDeleteErr) {
      console.warn('⚠️ Could not delete from Firebase Auth:', authDeleteErr.message);
    }
  }

  // 2. Delete from Firestore
  try {
    const batch = db.batch();

    // Delete user profile doc
    const userDocRef = db.collection('users').doc(uid);
    batch.delete(userDocRef);

    // Delete any matching employee_ids
    const empSnap = await db.collection('employee_ids').where('userId', '==', uid).get();
    empSnap.forEach((doc) => {
      console.log(`   - Removing linked employee ID record: ${doc.id}`);
      batch.delete(doc.ref);
    });

    // Record audit log
    const auditDocRef = db.collection('audit_logs').doc();
    batch.set(auditDocRef, {
      event: 'user.deleted',
      actorUid: 'cli-admin-script',
      targetType: 'user',
      targetId: uid,
      metadata: {
        email,
        deletedVia: 'CLI delete-user script',
      },
      source: 'cli',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();
    console.log('✅ 2. Deleted from Cloud Firestore (users & employee_ids).');
    console.log(`🎉 Account ${email} was completely wiped in both Auth and Firestore!\n`);
  } catch (firestoreErr) {
    console.error('❌ Error deleting from Firestore:', firestoreErr.message);
  }
}

deleteUserAccount(process.argv[2]).catch(console.error);
