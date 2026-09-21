import { transportOver, decode, encode } from "../match/wire";
import type { Carried } from "../match/wire";
import type { Transport } from "../match/match";
import type { GameMap } from "../domain/map";
import type { Room } from "./rooms";

export type LinkState = "connecting" | "connected" | "lost";

export interface Link {
  readonly transport: Transport;
  state(): LinkState;
  onStateChange(listener: (state: LinkState) => void): void;
}

/*
 * A public STUN server, and no relay.
 *
 * STUN only tells a browser how it looks from outside, which is enough for two
 * players whose networks let them reach each other. Where they cannot — a
 * symmetric NAT, a strict mobile carrier — the connection fails and the game
 * says so rather than falling back, because a relay has to be paid for and run.
 * PRODUCT.md records why that is deferred.
 */
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/**
 * The peer connection, and the game's transport over its data channel.
 *
 * Firebase introduces the two browsers and is then emptied out: once the
 * channel is open, every move goes browser to browser and the database is
 * asked for nothing.
 */
export async function link(room: Room, map: GameMap): Promise<Link> {
  const connection = new RTCPeerConnection(ICE_SERVERS);
  let state: LinkState = "connecting";
  const watchers: ((state: LinkState) => void)[] = [];
  const announce = (next: LinkState): void => {
    if (next === state) return;
    state = next;
    for (const watcher of watchers) watcher(state);
  };

  connection.onicecandidate = (event) => {
    if (event.candidate) void room.addCandidate(event.candidate.toJSON());
  };
  connection.onconnectionstatechange = () => {
    if (connection.connectionState === "failed" || connection.connectionState === "closed") {
      announce("lost");
    }
  };
  room.watchCandidates((candidate) => {
    void connection.addIceCandidate(candidate as RTCIceCandidateInit).catch(() => undefined);
  });

  const channel = await (room.side === "host" ? offer(connection, room) : answer(connection, room));

  let deliver: ((message: Carried) => void) | undefined;
  channel.onmessage = (event: MessageEvent<string>) => deliver?.(decode(event.data, map));
  channel.onclose = () => announce("lost");

  const transport: Transport = transportOver({
    send: (message) => channel.send(encode(message)),
    receive: (handler) => {
      deliver = handler;
    },
  });

  await new Promise<void>((resolve) => {
    if (channel.readyState === "open") return resolve();
    channel.onopen = () => resolve();
  });
  announce("connected");
  // The introduction is over; nothing the room held is needed again.
  await room.close();

  return { transport, state: () => state, onStateChange: (listener) => void watchers.push(listener) };
}

async function offer(connection: RTCPeerConnection, room: Room): Promise<RTCDataChannel> {
  const channel = connection.createDataChannel("game", { ordered: true });
  const local = await connection.createOffer();
  await connection.setLocalDescription(local);
  await room.put("offer", { type: local.type, sdp: local.sdp });

  await new Promise<void>((resolve) => {
    room.watch("answer", (value) => {
      void connection
        .setRemoteDescription(value as RTCSessionDescriptionInit)
        .then(resolve)
        .catch(() => undefined);
    });
  });
  return channel;
}

async function answer(connection: RTCPeerConnection, room: Room): Promise<RTCDataChannel> {
  const arriving = new Promise<RTCDataChannel>((resolve) => {
    connection.ondatachannel = (event) => resolve(event.channel);
  });

  await new Promise<void>((resolve) => {
    room.watch("offer", (value) => {
      void connection
        .setRemoteDescription(value as RTCSessionDescriptionInit)
        .then(async () => {
          const local = await connection.createAnswer();
          await connection.setLocalDescription(local);
          await room.put("answer", { type: local.type, sdp: local.sdp });
          resolve();
        })
        .catch(() => undefined);
    });
  });
  return arriving;
}
