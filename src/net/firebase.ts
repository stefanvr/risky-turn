import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";
import type { Database } from "firebase/database";
import type { FirebaseApp } from "firebase/app";

/*
 * The web configuration of the `risky-turn` project. None of it is a secret:
 * a Firebase web key identifies a project, it does not authorise anything, and
 * the security rules in database.rules.json are the actual boundary. No
 * administrative credential, service account or TURN secret belongs here.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyC__q0zmoZWWMAddcA2chv06ySG6tXx61I",
  authDomain: "risky-turn.firebaseapp.com",
  databaseURL: "https://risky-turn-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "risky-turn",
  appId: "1:74281650271:web:80e1d9571aea50491633ea",
} as const;

/** Set when the checks run, so nothing in a test can reach the real project. */
export function usingEmulator(): boolean {
  return import.meta.env.VITE_FIREBASE_EMULATOR === "1";
}

export interface Connected {
  readonly database: Database;
  /** Who this browser is for the length of this visit. Nothing is kept. */
  readonly uid: string;
}

/**
 * Signs in and opens the database.
 *
 * The sign-in is anonymous and throwaway: it exists so the rules have someone
 * to name, not so the game knows who anybody is. Nothing about a player
 * survives the visit, which is what keeps "no account to make" true.
 */
export async function connect(name = "risky-turn"): Promise<Connected> {
  const app: FirebaseApp = initializeApp(firebaseConfig, name);
  const auth = getAuth(app);
  const database = getDatabase(app);

  if (usingEmulator()) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectDatabaseEmulator(database, "127.0.0.1", 9000);
  }

  const { user } = await signInAnonymously(auth);
  return { database, uid: user.uid };
}
