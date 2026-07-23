import { initializeApp, cert, getApps } from 'firebase-admin/app';

try {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY,
      }),
    });
    console.log('Firebase Admin SDK initialized successfully!');
  }
} catch (error: any) {
  console.error('Error initializing Firebase Admin SDK:', error.message);
}

export { getMessaging } from 'firebase-admin/messaging';