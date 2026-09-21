import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectDatabaseEmulator, get, getDatabase, push, ref, remove, set } from "firebase/database";
import type { DataSnapshot } from "firebase/database";
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

    await set(push(ref(host.database, `rooms/${code}/wire/host`)), "from the host");
    const heard = await get(ref(guest.database, `rooms/${code}/wire/host`));

    await set(push(ref(guest.database, `rooms/${code}/wire/guest`)), "from the guest");
    const back = await get(ref(host.database, `rooms/${code}/wire/guest`));

    const said = (shot: DataSnapshot): string[] => Object.values(shot.val() ?? {});
    return said(heard)[0] === "from the host" && said(back)[0] === "from the guest";
  } finally {
    await deleteApp(host.app);
    await deleteApp(guest.app);
  }
}

/** A side may only speak for itself: the guest may not append as the host. */
export async function guestSpeaksAsTheHost(): Promise<void> {
  const host = await somebody();
  const guest = await somebody();
  const code = room();
  try {
    await set(ref(host.database, `rooms/${code}/host`), { uid: host.uid });
    await set(ref(guest.database, `rooms/${code}/guest`), { uid: guest.uid });
    await set(push(ref(guest.database, `rooms/${code}/wire/host`)), "not from the host");
  } finally {
    await deleteApp(host.app);
    await deleteApp(guest.app);
  }
}

/** What was said stays said: not even its sender may amend or withdraw it. */
export async function hostAmendsWhatItSaid(): Promise<void> {
  const host = await somebody();
  const code = room();
  try {
    await set(ref(host.database, `rooms/${code}/host`), { uid: host.uid });
    const said = push(ref(host.database, `rooms/${code}/wire/host`));
    await set(said, "as it was sent");
    await set(said, "as it was never sent");
  } finally {
    await deleteApp(host.app);
  }
}

/**
 * A guest may give up its own place, which is how the host is told the other
 * player has gone: onDisconnect performs this write on their behalf.
 */
export async function guestLeavesItsOwnPlace(): Promise<boolean> {
  const host = await somebody();
  const guest = await somebody();
  const code = room();
  try {
    await set(ref(host.database, `rooms/${code}/host`), { uid: host.uid });
    await set(ref(guest.database, `rooms/${code}/guest`), { uid: guest.uid });
    await remove(ref(guest.database, `rooms/${code}/guest`));
    const left = await get(ref(host.database, `rooms/${code}/guest`));
    return !left.exists();
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
