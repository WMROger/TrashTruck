import { db } from '@/config/firebase';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { Platform } from 'react-native';

export async function registerDeviceForFcm(userId: string): Promise<{ registered: boolean; reason?: string }> {
  if (!userId || Platform.OS !== 'android') return { registered: false, reason: 'android-only' };
  if (Constants.appOwnership === 'expo') {
    return { registered: false, reason: 'expo-go-not-supported' };
  }
  const settings = await getDoc(doc(db, 'user_settings', userId));
  if (settings.data()?.notificationPreferences?.pushEnabled === false) return { registered: false, reason: 'disabled-by-user' };

  await Notifications.setNotificationChannelAsync('trashtrack-alerts', {
    name: 'TrashTrack Alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 200, 250],
  });
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return { registered: false, reason: 'permission-denied' };

  const nativeToken = await Notifications.getDevicePushTokenAsync();
  const token = typeof nativeToken.data === 'string' ? nativeToken.data : JSON.stringify(nativeToken.data);
  if (!token) return { registered: false, reason: 'missing-token' };
  const deviceId = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, token);
  await setDoc(doc(db, 'users', userId, 'devices', deviceId), {
    token,
    tokenType: 'fcm',
    platform: 'android',
    enabled: true,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return { registered: true };
}

export async function setFcmPushEnabled(userId: string, enabled: boolean) {
  if (enabled) return registerDeviceForFcm(userId);
  const devices = await getDocs(collection(db, 'users', userId, 'devices'));
  const batch = writeBatch(db);
  devices.docs.forEach(device => batch.set(device.ref, { enabled: false, updatedAt: serverTimestamp() }, { merge: true }));
  await batch.commit();
  return { registered: false, reason: 'disabled-by-user' };
}
