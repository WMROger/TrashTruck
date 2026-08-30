import { auth, db } from "@/config/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

/**
 * CICTO (City Information and Communications Technology Office)
 * Governance Configurations.
 * Used to ensure CICTO governance access is maintained across municipal portals.
 */
export const CICTO_ADMIN_CONFIG = Object.freeze({
  primaryEmail:
    process.env.EXPO_PUBLIC_CICTO_ADMIN_EMAIL || "cicto@trashtrack.gov.ph",
  knownEmails: [
    process.env.EXPO_PUBLIC_CICTO_ADMIN_EMAIL || "cicto@trashtrack.gov.ph",
    "cicto@trashtrack.gov.ph",
    "cicto@trashtrack.com",
    "cicto.admin@danao.gov.ph",
    "cicto@danao.gov.ph",
    "cictoadmin@trashtrack.gov.ph",
  ],
  knownUsernames: [
    "cicto",
    "cictoadmin",
    "cicto_admin",
    "superadmin",
  ],
  displayName: "CICTO Super Administrator",
  role: "cicto" as const,
});

/**
 * Checks if a given email is a recognized CICTO Super Admin email.
 */
export function isCictoEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (
    CICTO_ADMIN_CONFIG.knownEmails.includes(normalized) ||
    normalized.startsWith("cicto@") ||
    normalized.startsWith("cicto.admin@")
  );
}

/**
 * Checks if a given string looks like a CICTO username or email.
 */
export function isCictoIdentifier(identifier?: string | null): boolean {
  if (!identifier) return false;
  const normalized = identifier.trim().toLowerCase();
  if (isCictoEmail(normalized)) return true;
  return CICTO_ADMIN_CONFIG.knownUsernames.includes(normalized);
}

/**
 * Ensures the CICTO Super Admin profile document exists in Firestore `/users/{uid}`.
 * Self-healing mechanism: when the master CICTO account logs in after a database wipe,
 * this function automatically reconstructs the master profile document.
 */
export async function ensureCictoProfileInFirestore(
  uid: string,
  email: string = "cicto@trashtrack.gov.ph",
  displayName: string = "CICTO Super Administrator",
): Promise<void> {
  if (!db) return;
  try {
    const userRef = doc(db, "users", uid);
    await setDoc(
      userRef,
      {
        uid,
        email,
        displayName,
        name: displayName,
        role: "cicto",
        verified: true,
        status: "active",
        department:
          "City Information and Communications Technology Office (CICTO Danao)",
        agency: "CICTO Danao City",
        permissions: [
          "system.oversight",
          "fleet.audit",
          "users.manage",
          "data.export",
          "cenro.command",
          "rewards.reconcile",
        ],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      },
      { merge: true },
    );
    console.log(
      "✅ CICTO Admin profile successfully self-healed in Firestore:",
      email,
    );
  } catch (error) {
    console.warn("Could not ensure CICTO profile in Firestore:", error);
  }
}

/**
 * Logs in and self-heals the CICTO Super Administrator account.
 */
export async function loginOrBootstrapCictoAccount(
  customEmail?: string,
  customPassword?: string,
) {
  if (!auth) {
    throw new Error("Firebase Auth is not initialized.");
  }

  const rawEmail = (customEmail || CICTO_ADMIN_CONFIG.primaryEmail).trim().toLowerCase();
  const emailToUse = rawEmail.includes('@') ? rawEmail : CICTO_ADMIN_CONFIG.primaryEmail;
  if (!customPassword) {
    throw new Error("Password is required to authenticate.");
  }

  try {
    const cred = await signInWithEmailAndPassword(
      auth,
      emailToUse,
      customPassword,
    );
    await ensureCictoProfileInFirestore(
      cred.user.uid,
      cred.user.email || emailToUse,
      cred.user.displayName || CICTO_ADMIN_CONFIG.displayName,
    );
    return { user: cred.user, isNewUser: false };
  } catch (signInError: any) {
    throw signInError;
  }
}
