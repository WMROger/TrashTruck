const admin = require('firebase-admin');

// Path to your service account key file
const serviceAccount = require('./serviceAccountKey.json');

// Initialize the Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Replace with the UID of the user you want to make admin
const uid = 'aJr3uV6lnVgotISwvQzPYa5uuOe2';

admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log(`Admin claim set for user: ${uid}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Error setting admin claim:', error);
    process.exit(1);
  });