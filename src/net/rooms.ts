import { get, onChildAdded, onDisconnect, onValue, push, ref, remove, set } from "firebase/database";
import type { Database } from "firebase/database";
import type { Connected } from "./firebase";

export type Side = "host" | "guest";

export class RoomTakenError extends Error {
  override readonly name = "RoomTakenError";
}

export class NoSuchRoomError extends Error {
  override readonly name = "NoSuchRoomError";
}

/**
 * A room is a place to be introduced, and nothing else. It holds who the two
 * players are for this match, the offer and answer that open a peer
 * connection, and the candidates that route it — and it is emptied as soon as
 * the connection is up. No move ever passes through it.
 */
export interface Room {
  readonly code: string;
  readonly side: Side;
  put(what: "offer" | "answer", value: unknown): Promise<void>;
  watch(what: "offer" | "answer", found: (value: unknown) => void): void;
  addCandidate(candidate: unknown): Promise<void>;
  watchCandidates(found: (candidate: unknown) => void): void;
  /** Emptied once the players can talk without it. */
  close(): Promise<void>;
}

function roomAt(database: Database, code: string, side: Side): Room {
  const at = (path: string): ReturnType<typeof ref> => ref(database, `rooms/${code}/${path}`);
  const theirs: Side = side === "host" ? "guest" : "host";

  return {
    code,
    side,
    async put(what, value) {
      await set(at(what), value);
    },
    watch(what, found) {
      onValue(at(what), (shot) => {
        const value = shot.val();
        if (value !== null) found(value);
      });
    },
    async addCandidate(candidate) {
      await set(push(at(`ice/${side}`)), candidate);
    },
    watchCandidates(found) {
      onChildAdded(at(`ice/${theirs}`), (shot) => {
        const value = shot.val();
        if (value !== null) found(value);
      });
    },
    /*
     * Only the host can clear a room, and the rules allow it nothing else at
     * that path. The failure is not swallowed: a room that cannot be cleared
     * is one that stays on the database holding both players' identifiers for
     * good, which is worth failing loudly over.
     */
    async close() {
      if (side !== "host") return;
      await remove(ref(database, `rooms/${code}`));
    },
  };
}

/** Claims a room under this code, or says it is taken. */
export async function openRoom(connected: Connected, code: string): Promise<Room> {
  const host = ref(connected.database, `rooms/${code}/host`);
  try {
    await set(host, { uid: connected.uid });
  } catch {
    throw new RoomTakenError(`a game is already waiting on ${code}`);
  }
  /*
   * A host who closes the tab before anyone joins would otherwise leave the
   * room standing for ever. There is no server to sweep up, so the database is
   * told now what to do when this browser goes away.
   */
  await onDisconnect(ref(connected.database, `rooms/${code}`)).remove();
  return roomAt(connected.database, code, "host");
}

/**
 * Takes the guest's place in a room, or says there is none.
 *
 * The rules refuse the write unless a host is waiting and the place is free,
 * so a wrong code and a full room both arrive here as a refusal rather than as
 * something a guess could tell apart.
 */
export async function enterRoom(connected: Connected, code: string): Promise<Room> {
  const guest = ref(connected.database, `rooms/${code}/guest`);
  try {
    await set(guest, { uid: connected.uid });
  } catch {
    throw new NoSuchRoomError(`no game is waiting on ${code}`);
  }
  const room = roomAt(connected.database, code, "guest");
  const waiting = await get(ref(connected.database, `rooms/${code}/host`));
  if (!waiting.exists()) throw new NoSuchRoomError(`no game is waiting on ${code}`);
  return room;
}
