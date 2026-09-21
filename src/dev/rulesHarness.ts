import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectDatabaseEmulator, get, getDatabase, ref, remove, set } from "firebase/database";
import { firebaseConfig } from "../net/firebase";
import type { Database } from "firebase/database";
import type { FirebaseApp } from "firebase/app";

/**
 * Two throwaway browsers, as far as the database is concerned: separate apps
 * mean separate anonymous users, which is the only way to ask the rules what
 * one player may do to another player's room.
 *
 * Always against the emulator. Nothing here may reach the live project.
 */
interface AsSomebody {
  readonly app: FirebaseApp;
  readonly database: Database;
  readonly uid: string;
}

let nextApp = 0;

async function somebody(): Promise<AsSomebody> {
  const app = initializeApp(firebaseConfig, `rules-${(nextApp += 1)}`);
  const auth = getAuth(app);
  const database = getDatabase(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectDatabaseEmulator(database, "127.0.0.1", 9000);
  const { user } = await signInAnonymously(auth);
  return { app, database, uid: user.uid };
}

const room = (): string => String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");

export async function readUnrelatedRoom(): Promise<void> {
  const host = await somebody();
  const stranger = await somebody();
  const code = room();
  try {
    await set(ref(host.database, `rooms/${code}/host`), { uid: host.uid });
    await get(ref(stranger.database, `rooms/${code}`));
  } finally {
    await deleteApp(host.app);
    await deleteApp(stranger.app);
  }
}

export async function exchangeInOwnRoom(): Promise<boolean> {
  const host = await somebody();
  const guest = await somebody();
  const code = room();
  try {
    await set(ref(host.database, `rooms/${code}/host`), { uid: host.uid });
    await set(ref(guest.database, `rooms/${code}/guest`), { uid: guest.uid });

    await set(ref(host.database, `rooms/${code}/offer`), { sdp: "an offer" });
    const seen = await get(ref(guest.database, `rooms/${code}/offer`));

    await set(ref(guest.database, `rooms/${code}/answer`), { sdp: "an answer" });
    const back = await get(ref(host.database, `rooms/${code}/answer`));

    return seen.val()?.sdp === "an offer" && back.val()?.sdp === "an answer";
  } finally {
    await deleteApp(host.app);
    await deleteApp(guest.app);
  }
}

export async function hostClearsOwnRoom(): Promise<boolean> {
  const host = await somebody();
  const guest = await somebody();
  const code = room();
  try {
    await set(ref(host.database, `rooms/${code}/host`), { uid: host.uid });
    await set(ref(guest.database, `rooms/${code}/guest`), { uid: guest.uid });
    await remove(ref(host.database, `rooms/${code}`));
    // Reading it back is itself refused, and rightly: with the room gone there
    // is no host to match, so nobody may look at where it was. A remove that
    // did not throw is the whole of what there is to check.
    return true;
  } finally {
    await deleteApp(host.app);
    await deleteApp(guest.app);
  }
}

export async function guestClearsTheRoom(): Promise<void> {
  const host = await somebody();
  const guest = await somebody();
  const code = room();
  try {
    await set(ref(host.database, `rooms/${code}/host`), { uid: host.uid });
    await set(ref(guest.database, `rooms/${code}/guest`), { uid: guest.uid });
    await remove(ref(guest.database, `rooms/${code}`));
  } finally {
    await deleteApp(host.app);
    await deleteApp(guest.app);
  }
}
