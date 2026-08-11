'use strict';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPLOYEE_ID_PATTERN = /^[A-Z0-9-]{4,32}$/i;
const LICENSE_PATTERN = /^[A-Z0-9-]{4,40}$/i;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validateProvisionInput(data) {
  const mode = data?.mode === 'upgrade' ? 'upgrade' : 'create';
  const email = normalizeEmail(data?.email);
  const password = String(data?.password || '');
  const fullName = String(data?.fullName || '').trim();
  const employeeId = String(data?.employeeId || '').trim().toUpperCase();
  const licenseNumber = String(data?.licenseNumber || '').trim().toUpperCase();
  const existingUserId = String(data?.existingUserId || '').trim();
  const truckId = String(data?.truckId || '').trim() || null;

  if (!EMPLOYEE_ID_PATTERN.test(employeeId)) throw new Error('A valid employee ID is required.');
  if (!LICENSE_PATTERN.test(licenseNumber)) throw new Error('A valid license number is required.');
  if (mode === 'create') {
    if (!EMAIL_PATTERN.test(email)) throw new Error('A valid email address is required.');
    if (password.length < 12 || password.length > 128) throw new Error('Password must contain 12 to 128 characters.');
    if (fullName.length < 2 || fullName.length > 100) throw new Error('A valid full name is required.');
  } else if (!existingUserId) {
    throw new Error('An existing resident account is required for upgrade.');
  }

  return {
    mode, email, password, fullName, employeeId, licenseNumber, existingUserId, truckId,
    contactInfo: String(data?.contactInfo || '').trim().slice(0, 100),
  };
}

function coordinateOf(value) {
  const latitude = value?.lat ?? value?.latitude ?? value?.location?.lat ?? value?.location?.latitude;
  const longitude = value?.lng ?? value?.longitude ?? value?.location?.lng ?? value?.location?.longitude;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude: Number(latitude), longitude: Number(longitude) };
}

function haversineMeters(left, right) {
  const a = coordinateOf(left);
  const b = coordinateOf(right);
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const radians = degrees => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const value = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function manilaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}

function isScheduleForToday(dateText, now = new Date()) {
  if (!dateText) return false;
  if (String(dateText).trim().toLowerCase() === 'today') return true;
  const parsed = new Date(String(dateText));
  if (Number.isNaN(parsed.getTime())) return false;
  const today = manilaDateParts(now);
  return parsed.getFullYear() === today.year && parsed.getMonth() + 1 === today.month && parsed.getDate() === today.day;
}

function notificationPreferenceAllows(preferences, type) {
  if (preferences?.pushEnabled === false) return false;
  if (type === 'announcement') return preferences?.announcements !== false;
  if (type === 'report_update') return preferences?.reportUpdates !== false;
  if (type === 'pickup_reminder' || type === 'route') return preferences?.pickupReminders !== false;
  if (type === 'truck_proximity') return preferences?.proximityAlerts !== false;
  return true;
}

function clampRadius(value, fallback = 500) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(2000, Math.max(100, parsed)) : fallback;
}

module.exports = {
  normalizeEmail,
  validateProvisionInput,
  coordinateOf,
  haversineMeters,
  isScheduleForToday,
  clampRadius,
  notificationPreferenceAllows,
};
