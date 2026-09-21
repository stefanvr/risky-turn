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
 * A room is where a match is met and how it is carried.
 *
 * It holds who the two players are and two lists of messages, one per side:
 * each side appends to its own and reads the other's. A message is never
 * amended or taken back — the rules refuse both — so what a side reads is
 * what the other side sent, in the order it sent it.
 */
export interface Room {
  readonly code: string;
  readonly side: Side;
  /** Appends to this side's list. The other side reads it. */
  send(message: string): Promise<void>;
  /** Every message the other side has sent, from the first, then as they come. */
  receive(found: (message: string) => void): void;
  /** Called once the other side, having been there, is gone. */
  whenTheOtherGoes(gone: () => void): void;
  /** Takes the room away, with everything either side put in it. */
  close(): Promise<void>;
}

function roomAt(database: Database, code: string, side: Side): Room {
  const at = (path: string): ReturnType<typeof ref> => ref(database, `rooms/${code}/${path}`);
  const theirs: Side = side === "host" ? "guest" : "host";

  return {
    code,
    side,
    async send(message) {
      await set(push(at(`wire/${side}`)), message);
    },
    receive(found) {
      onChildAdded(at(`wire/${theirs}`), (shot) => {
        const value = shot.val() as string | null;
        if (value !== null) found(value);
      });
    },
    /*
     * The other player is present exactly while their side of the room is.
     * A host who closes the tab takes the whole room with them, and a guest
     * who closes theirs takes their own place in it; either way this is where
     * the remaining player learns the match is over.
     */
    whenTheOtherGoes(gone) {
      let seen = false;
      onValue(at(theirs), (shot) => {
        if (shot.exists()) seen = true;
        else if (seen) gone();
      });
    },
    /*
     * Only the host can clear a room, and the rules allow it nothing else at
     * that path. The failure is not swallowed: a room that cannot be cleared
     * is one that stays on the database holding both players' identifiers and
     * everything they said, which is worth failing loudly over.
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
   * A host who goes away would otherwise leave the room standing for ever.
   * There is no server to sweep up, so the database is told now what to do
   * when this browser goes: the match depends on its host, and ends with it.
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
  // A guest who leaves takes their own place away, so the host is told.
  await onDisconnect(guest).remove();
  return room;
}
