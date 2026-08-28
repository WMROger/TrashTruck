import { auth, db } from "@/config/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

/**
 * Hardcoded CICTO (City Information and Communications Technology Office)
 * Super Administrator Credentials & Configurations.
 * Used to ensure CICTO governance access is never lost even if the Firestore database
 * or Firebase Auth accounts are cleared/reset.
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
  defaultPassword:
    process.env.EXPO_PUBLIC_CICTO_ADMIN_PASSWORD || "CictoAdmin2026!",
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
 */
export async function ensureCictoProfileInFirestore(
  uid: string,
  email: string = "cicto@trashtrack.gov.ph",
  displayName: string = "CICTO Super Administrator",
): Promise<void> {
  if (!db) return;
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
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
        "✅ CICTO Admin profile successfully created in Firestore:",
        email,
      );
    } else {
      const data = snap.data();
      if (data?.role !== "cicto") {
        await setDoc(
          userRef,
          {
            role: "cicto",
            verified: true,
            status: "active",
            agency: "CICTO Danao City",
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }
    }
  } catch (error) {
    console.warn("Could not ensure CICTO profile in Firestore:", error);
  }
}

/**
 * Logs in or bootstraps the CICTO Super Administrator account.
 */
export async function loginOrBootstrapCictoAccount(
  customEmail?: string,
  customPassword?: string,
) {
  if (!auth) {
    throw new Error("Firebase Auth is not initialized.");
  }

  const emailToUse =
    customEmail || CICTO_ADMIN_CONFIG.primaryEmail;
  const passwordToUse =
    customPassword || CICTO_ADMIN_CONFIG.defaultPassword;

  try {
    const cred = await signInWithEmailAndPassword(
      auth,
      emailToUse,
      passwordToUse,
    );
    await ensureCictoProfileInFirestore(
      cred.user.uid,
      cred.user.email || emailToUse,
      cred.user.displayName || CICTO_ADMIN_CONFIG.displayName,
    );
    return { user: cred.user, isNewUser: false };
  } catch (signInError: any) {
    if (
      signInError.code === "auth/user-not-found" ||
      signInError.code === "auth/invalid-credential"
    ) {
      try {
        const newCred = await createUserWithEmailAndPassword(
          auth,
          emailToUse,
          passwordToUse,
        );
        await updateProfile(newCred.user, {
          displayName: CICTO_ADMIN_CONFIG.displayName,
        });
        await ensureCictoProfileInFirestore(
          newCred.user.uid,
          emailToUse,
          CICTO_ADMIN_CONFIG.displayName,
        );
        return { user: newCred.user, isNewUser: true };
      } catch (createError: any) {
        if (createError.code === "auth/email-already-in-use") {
          throw new Error(
            "Account exists but password did not match. Please verify your credentials.",
          );
        }
        throw createError;
      }
    }
    throw signInError;
  }
}
