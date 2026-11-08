import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import express from "express";
import type { Pool } from "pg";
import WebSocket from "ws";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGameCenterVerifier } from "../gameCenterVerifier";
import { startIsolatedDatabase, type IsolatedDatabase } from "./support/realServer";
import {
  generateTestCertificates,
  signTestProof,
  TEST_INTERMEDIATE_URL,
  type TestCertificateSet,
} from "./support/testCertificates";

// Game Center friends and direct invites against the real routes, the real
// WebSocket server and a throwaway Postgres database. Players are linked with
// identity proofs signed by locally generated certificates.

const BUNDLE_ID = "com.sketchduel.app";
const TEST_TIMEOUT_MS = 60_000;
const MESSAGE_TIMEOUT_MS = 10_000;
const QUIET_WAIT_MS = 600;
const INVITE_TTL_MS = 1_500;
const INVITES_PER_MINUTE = 3;

type ServerMessage = { type: string; [key: string]: unknown };

let certs: TestCertificateSet;
let database: IsolatedDatabase;
let previousDatabaseUrl: string | undefined;
let httpServer: Server;
let wss: ReturnType<typeof import("../websocket").setupWebSocket>;
let appPool: Pool;
let baseUrl: string;
let wsUrl: string;
const openClients: Client[] = [];

type Player = { gcId: string; token: string };

async function api(method: string, path: string, body: unknown, token?: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { "x-session-token": token } : {}) },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) as Record<string, unknown> : {} };
}

/** A device signed in to Game Center as this player. */
async function linkedDevice(gcId: string): Promise<Player> {
  const token = randomBytes(32).toString("hex");
  const proof = signTestProof({ signer: certs.appleSigner, playerId: gcId, bundleId: BUNDLE_ID, timestamp: Date.now() });
  const linked = await api("POST", "/api/identity/game-center", proof, token);
  expect(linked.status).toBe(200);
  return { gcId, token };
}

/** A WebSocket session that records every server message and lets tests consume them in order. */
class Client {
  private readonly inbox: ServerMessage[] = [];
  private waiters: Array<() => void> = [];

  private constructor(private readonly ws: WebSocket) {
    ws.on("message", (data) => {
      this.inbox.push(JSON.parse(data.toString()) as ServerMessage);
      for (const wake of this.waiters.splice(0)) wake();
    });
  }

  static async open(token: string): Promise<Client> {
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((resolveOpen, reject) => {
      ws.once("open", () => resolveOpen());
      ws.once("error", reject);
    });
    const client = new Client(ws);
    openClients.push(client);
    client.send({ type: "authenticate", sessionToken: token });
    return client;
  }

  /** Opens the friends session the app keeps while active: authenticate, then upload the friend list. */
  static async social(player: Player, friendIds: string[]): Promise<Client> {
    const client = await Client.open(player.token);
    await client.uploadFriends(friendIds);
    return client;
  }

  async uploadFriends(friendIds: string[]): Promise<ServerMessage> {
    this.send({ type: "set_friends", friendIds });
    return this.take("friends_status");
  }

  send(message: Record<string, unknown>): void {
    this.ws.send(JSON.stringify(message));
  }

  /** Removes and returns the first message of this type (matching the filter), waiting if needed. */
  async take(type: string, filter: (message: ServerMessage) => boolean = () => true): Promise<ServerMessage> {
    const deadline = Date.now() + MESSAGE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const index = this.inbox.findIndex((message) => message.type === type && filter(message));
      if (index !== -1) return this.inbox.splice(index, 1)[0];
      await new Promise<void>((wake) => {
        const timer = setTimeout(wake, 100);
        this.waiters.push(() => {
          clearTimeout(timer);
          wake();
        });
      });
    }
    throw new Error(`Timed out waiting for ${type}; inbox ${JSON.stringify(this.inbox)}`);
  }

  async presence(friend: Player): Promise<unknown> {
    return (await this.take("friend_presence", (message) => message.playerId === friend.gcId)).status;
  }

  /** Waits briefly and returns any messages of this type that arrived. */
  async quiet(type: string): Promise<ServerMessage[]> {
    await new Promise((resolveWait) => setTimeout(resolveWait, QUIET_WAIT_MS));
    return this.inbox.filter((message) => message.type === type);
  }

  /** Removes every received message of this type. */
  drain(type: string): void {
    for (let i = this.inbox.length - 1; i >= 0; i--) {
      if (this.inbox[i].type === type) this.inbox.splice(i, 1);
    }
  }

  async close(): Promise<void> {
    if (this.ws.readyState === WebSocket.CLOSED) return;
    await new Promise<void>((resolveClose) => {
      this.ws.once("close", () => resolveClose());
      this.ws.close();
    });
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
}

function statuses(message: ServerMessage): Record<string, string> {
  const friends = message.friends as { playerId: string; status: string }[];
  return Object.fromEntries(friends.map((friend) => [friend.playerId, friend.status]));
}

beforeAll(async () => {
  certs = generateTestCertificates();
  database = await startIsolatedDatabase();
  previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = database.databaseUrl;

  // Imported after DATABASE_URL points at the throwaway database.
  const [{ registerRoutes }, { setupWebSocket }, dbModule] = await Promise.all([
    import("../routes"),
    import("../websocket"),
    import("../db"),
  ]);
  appPool = dbModule.pool as Pool;

  const gameCenterVerifier = createGameCenterVerifier({
    bundleIds: [BUNDLE_ID],
    trustedRoots: [certs.root],
    fetchCertificate: async (url) => (url === TEST_INTERMEDIATE_URL ? certs.intermediateDer : certs.appleSigner.der),
  });

  const app = express();
  app.use(express.json({ limit: "2mb" }));
  httpServer = await registerRoutes(app, { gameCenterVerifier, identityLinksPerMinute: 1_000 });
  wss = setupWebSocket(httpServer, { inviteTtlMs: INVITE_TTL_MS, invitesPerMinute: INVITES_PER_MINUTE });
  await new Promise<void>((resolveListen) => httpServer.listen(0, "127.0.0.1", resolveListen));
  const address = httpServer.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port");
  baseUrl = `http://127.0.0.1:${address.port}`;
  wsUrl = `ws://127.0.0.1:${address.port}/ws`;
}, TEST_TIMEOUT_MS);

afterAll(async () => {
  await Promise.all(openClients.map((client) => client.close()));
  if (wss) {
    for (const client of wss.clients) client.terminate();
    await new Promise<void>((resolveClose) => wss.close(() => resolveClose()));
  }
  if (httpServer?.listening) {
    await new Promise<void>((resolveClose) => httpServer.close(() => resolveClose()));
  }
  await appPool?.end();
  await database?.stop();
  certs?.cleanup();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
}, TEST_TIMEOUT_MS);

describe("Game Center friends", () => {
  it("shows a friend as active only when each player's list includes the other", async () => {
    const [alice, bob, carol] = await Promise.all([
      linkedDevice("T:_mutual-alice"),
      linkedDevice("T:_mutual-bob"),
      linkedDevice("T:_mutual-carol"),
    ]);
    const NOT_ON_SKETCHDUEL = "T:_not-on-sketchduel";

    const aliceSession = await Client.open(alice.token);
    const aliceList = await aliceSession.uploadFriends([bob.gcId, carol.gcId, NOT_ON_SKETCHDUEL, alice.gcId]);
    // Friends without a SketchDuel account (and the player themself) are not listed.
    expect(statuses(aliceList)).toEqual({ [bob.gcId]: "offline", [carol.gcId]: "offline" });

    const bobSession = await Client.social(bob, [alice.gcId]);
    expect(await aliceSession.presence(bob)).toBe("online");

    // Carol is online but has not listed Alice, so Alice cannot see that.
    const carolSession = await Client.open(carol.token);
    expect(statuses(await carolSession.uploadFriends([]))).toEqual({});
    expect(await aliceSession.quiet("friend_presence")).toEqual([]);
    // Carol listing Alice while Alice is online but has not listed her back:
    const carolView = await carolSession.uploadFriends([alice.gcId, bob.gcId]);
    expect(statuses(carolView)).toEqual({ [alice.gcId]: "online", [bob.gcId]: "offline" });
    expect(await aliceSession.presence(carol)).toBe("online");

    await bobSession.close();
    expect(await aliceSession.presence(bob)).toBe("offline");
    expect((await carolSession.quiet("friend_presence")).filter((message) => message.playerId === bob.gcId)).toEqual([]);
    await Promise.all([aliceSession.close(), carolSession.close()]);
  }, TEST_TIMEOUT_MS);

  it("keeps uploaded friend IDs in memory only", async () => {
    const player = await linkedDevice("T:_memory-only");
    const secretFriend = "T:_never-stored-friend-id";
    const session = await Client.social(player, [secretFriend]);

    const columns = await appPool.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
       where table_schema = 'public' and data_type in ('text', 'character varying', 'jsonb', 'json')`,
    );
    expect(columns.rows.length).toBeGreaterThan(0);
    for (const { table_name, column_name } of columns.rows) {
      const found = await appPool.query(
        `select 1 from "${table_name}" where "${column_name}"::text like $1 limit 1`,
        [`%${secretFriend}%`],
      );
      expect(found.rowCount, `${table_name}.${column_name}`).toBe(0);
    }
    await session.close();
  }, TEST_TIMEOUT_MS);

  it("starts a private match when an invite is accepted, with live in-game status and blocks", async () => {
    const [dave, erin, frank, outsider] = await Promise.all([
      linkedDevice("T:_invite-dave"),
      linkedDevice("T:_invite-erin"),
      linkedDevice("T:_invite-frank"),
      linkedDevice("T:_invite-outsider"),
    ]);
    const daveSocial = await Client.social(dave, [erin.gcId, frank.gcId]);
    const erinSocial = await Client.social(erin, [dave.gcId, frank.gcId]);
    const frankSocial = await Client.social(frank, [dave.gcId, erin.gcId]);
    expect(await daveSocial.presence(erin)).toBe("online");

    daveSocial.send({ type: "invite_friend", playerId: erin.gcId });
    const sent = await daveSocial.take("invite_sent");
    expect(sent).toMatchObject({ playerId: erin.gcId, expiresInMs: INVITE_TTL_MS });
    const received = await erinSocial.take("invite_received");
    expect(received).toMatchObject({ inviteId: sent.inviteId, playerId: dave.gcId });

    erinSocial.send({ type: "respond_invite", inviteId: received.inviteId, accept: true });
    const [daveAccepted, erinAccepted] = await Promise.all([
      daveSocial.take("invite_accepted"),
      erinSocial.take("invite_accepted"),
    ]);
    const roomCode = daveAccepted.roomCode as string;
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(erinAccepted.roomCode).toBe(roomCode);

    // The reserved room is only for the two invited players.
    const outsiderGame = await Client.open(outsider.token);
    outsiderGame.send({ type: "join_room", roomCode });
    expect(await outsiderGame.take("room_error")).toMatchObject({ code: "ROOM_NOT_FOUND" });

    const daveGame = await Client.open(dave.token);
    daveGame.send({ type: "join_room", roomCode });
    await daveGame.take("room_joined");
    const erinGame = await Client.open(erin.token);
    erinGame.send({ type: "join_room", roomCode });
    const [daveMatch, erinMatch] = await Promise.all([daveGame.take("match_found"), erinGame.take("match_found")]);
    expect(daveMatch).toMatchObject({ matchType: "friend", gameId: erinMatch.gameId });

    expect(await frankSocial.presence(dave)).toBe("in_game");
    expect(await frankSocial.presence(erin)).toBe("in_game");
    frankSocial.send({ type: "invite_friend", playerId: dave.gcId });
    expect(await frankSocial.take("invite_error")).toMatchObject({ code: "FRIEND_UNAVAILABLE" });

    await daveGame.close();
    expect(await frankSocial.presence(dave)).toBe("online");
    expect(await frankSocial.presence(erin)).toBe("online");

    // Erin blocks Dave (they have now played together).
    const blocked = await api("POST", "/api/blocks", { blockedPlayerId: erinMatch.opponentPlayerId }, erin.token);
    expect(blocked.status).toBe(201);
    expect((await daveSocial.take("friend_removed")).playerId).toBe(erin.gcId);
    expect((await erinSocial.take("friend_removed")).playerId).toBe(dave.gcId);

    expect(statuses(await daveSocial.uploadFriends([erin.gcId, frank.gcId]))).toEqual({ [frank.gcId]: "online" });
    expect(statuses(await erinSocial.uploadFriends([dave.gcId, frank.gcId]))).toEqual({ [frank.gcId]: "online" });
    daveSocial.send({ type: "invite_friend", playerId: erin.gcId });
    expect(await daveSocial.take("invite_error")).toMatchObject({ code: "FRIEND_UNAVAILABLE" });
    expect(await erinSocial.quiet("invite_received")).toEqual([]);
    // Neither sees the other's status changes any more; Frank still sees both.
    daveSocial.drain("friend_presence");
    await erinSocial.close();
    expect(await frankSocial.presence(erin)).toBe("offline");
    expect((await daveSocial.quiet("friend_presence")).filter((message) => message.playerId === erin.gcId)).toEqual([]);

    await Promise.all([daveSocial.close(), frankSocial.close(), erinGame.close(), outsiderGame.close()]);
  }, TEST_TIMEOUT_MS);

  it("clears declined, cancelled and expired invites on both sides", async () => {
    const [gina, hal] = await Promise.all([linkedDevice("T:_close-gina"), linkedDevice("T:_close-hal")]);
    const ginaSocial = await Client.social(gina, [hal.gcId]);
    const halSocial = await Client.social(hal, [gina.gcId]);

    ginaSocial.send({ type: "invite_friend", playerId: hal.gcId });
    let invite = await halSocial.take("invite_received");
    halSocial.send({ type: "respond_invite", inviteId: invite.inviteId, accept: false });
    expect(await ginaSocial.take("invite_closed")).toMatchObject({ inviteId: invite.inviteId, reason: "declined" });
    expect(await halSocial.take("invite_closed")).toMatchObject({ inviteId: invite.inviteId, reason: "declined" });

    ginaSocial.send({ type: "invite_friend", playerId: hal.gcId });
    invite = await halSocial.take("invite_received");
    ginaSocial.send({ type: "cancel_invite", inviteId: invite.inviteId });
    expect(await halSocial.take("invite_closed")).toMatchObject({ inviteId: invite.inviteId, reason: "cancelled" });
    expect(await ginaSocial.take("invite_closed")).toMatchObject({ inviteId: invite.inviteId, reason: "cancelled" });
    // Only the sender can cancel.
    halSocial.send({ type: "cancel_invite", inviteId: invite.inviteId });
    expect(await halSocial.take("invite_error")).toMatchObject({ code: "INVITE_NOT_FOUND" });

    ginaSocial.send({ type: "invite_friend", playerId: hal.gcId });
    invite = await halSocial.take("invite_received");
    const started = Date.now();
    expect(await ginaSocial.take("invite_closed")).toMatchObject({ inviteId: invite.inviteId, reason: "expired" });
    expect(await halSocial.take("invite_closed")).toMatchObject({ inviteId: invite.inviteId, reason: "expired" });
    expect(Date.now() - started).toBeGreaterThanOrEqual(INVITE_TTL_MS - 500);
    halSocial.send({ type: "respond_invite", inviteId: invite.inviteId, accept: true });
    expect(await halSocial.take("invite_error")).toMatchObject({ code: "INVITE_NOT_FOUND" });
    expect(await ginaSocial.quiet("invite_accepted")).toEqual([]);

    await Promise.all([ginaSocial.close(), halSocial.close()]);
  }, TEST_TIMEOUT_MS);

  it("closes an invite when the sender goes away", async () => {
    const [mia, ned] = await Promise.all([linkedDevice("T:_gone-mia"), linkedDevice("T:_gone-ned")]);
    const miaSocial = await Client.social(mia, [ned.gcId]);
    const nedSocial = await Client.social(ned, [mia.gcId]);
    miaSocial.send({ type: "invite_friend", playerId: ned.gcId });
    const invite = await nedSocial.take("invite_received");
    await miaSocial.close();
    expect(await nedSocial.take("invite_closed")).toMatchObject({ inviteId: invite.inviteId, reason: "unavailable" });
    await nedSocial.close();
  }, TEST_TIMEOUT_MS);

  it("lets only the first of two simultaneous answers through", async () => {
    const ivy = await linkedDevice("T:_race-ivy");
    const jayPhone = await linkedDevice("T:_race-jay");
    const jayTablet = await linkedDevice("T:_race-jay");
    const ivySocial = await Client.social(ivy, [jayPhone.gcId]);
    const phone = await Client.social(jayPhone, [ivy.gcId]);
    const tablet = await Client.social(jayTablet, [ivy.gcId]);

    ivySocial.send({ type: "invite_friend", playerId: jayPhone.gcId });
    const [onPhone, onTablet] = await Promise.all([phone.take("invite_received"), tablet.take("invite_received")]);
    expect(onPhone.inviteId).toBe(onTablet.inviteId);

    phone.send({ type: "respond_invite", inviteId: onPhone.inviteId, accept: true });
    tablet.send({ type: "respond_invite", inviteId: onTablet.inviteId, accept: true });
    phone.send({ type: "respond_invite", inviteId: onPhone.inviteId, accept: true });

    expect((await ivySocial.take("invite_accepted")).inviteId).toBe(onPhone.inviteId);
    const accepted = [...await phone.quiet("invite_accepted"), ...await tablet.quiet("invite_accepted")];
    expect(accepted).toHaveLength(1);
    expect(await ivySocial.quiet("invite_accepted")).toEqual([]);
    const notFound = [...await phone.quiet("invite_error"), ...await tablet.quiet("invite_error")];
    expect(notFound.length).toBeGreaterThanOrEqual(2);
    expect(notFound.every((message) => message.code === "INVITE_NOT_FOUND")).toBe(true);

    // The reserved room admits one session per player, so the same account cannot fill both seats.
    const roomCode = accepted[0].roomCode as string;
    const phoneGame = await Client.open(jayPhone.token);
    phoneGame.send({ type: "join_room", roomCode });
    await phoneGame.take("room_joined");
    const tabletGame = await Client.open(jayTablet.token);
    tabletGame.send({ type: "join_room", roomCode });
    expect(await tabletGame.take("room_error")).toMatchObject({ code: "STATE_BLOCKED" });
    expect(await phoneGame.quiet("match_found")).toEqual([]);

    await Promise.all([ivySocial.close(), phone.close(), tablet.close(), phoneGame.close(), tabletGame.close()]);
  }, TEST_TIMEOUT_MS);

  it("allows one waiting invite at a time and rate-limits invites", async () => {
    const [kim, lee, otherFriend] = await Promise.all([
      linkedDevice("T:_limit-kim"),
      linkedDevice("T:_limit-lee"),
      linkedDevice("T:_limit-other"),
    ]);
    const kimSocial = await Client.social(kim, [lee.gcId, otherFriend.gcId]);
    const leeSocial = await Client.social(lee, [kim.gcId]);

    // Not a friend back, and offline: no invite.
    kimSocial.send({ type: "invite_friend", playerId: otherFriend.gcId });
    expect(await kimSocial.take("invite_error")).toMatchObject({ code: "FRIEND_UNAVAILABLE" });

    kimSocial.send({ type: "invite_friend", playerId: lee.gcId });
    const first = await kimSocial.take("invite_sent");
    kimSocial.send({ type: "invite_friend", playerId: lee.gcId });
    expect(await kimSocial.take("invite_error")).toMatchObject({ code: "ALREADY_INVITING" });
    kimSocial.send({ type: "cancel_invite", inviteId: first.inviteId });
    await kimSocial.take("invite_closed");

    // Every attempt counts toward the limit of 3 per minute.
    kimSocial.send({ type: "invite_friend", playerId: lee.gcId });
    expect(await kimSocial.take("invite_error")).toMatchObject({ code: "RATE_LIMITED" });
    expect((await leeSocial.quiet("invite_received")).length).toBe(1);

    await Promise.all([kimSocial.close(), leeSocial.close()]);
  }, TEST_TIMEOUT_MS);
});

describe("Friend visibility", () => {
  async function setVisibility(client: Client, visibility: string): Promise<void> {
    client.send({ type: "set_visibility", visibility });
    expect(await client.take("visibility_status", (message) => message.visibility === visibility))
      .toMatchObject({ visibility });
  }

  it("Appear Offline shows the player as offline and stops invites to them", async () => {
    const [opal, pete] = await Promise.all([linkedDevice("T:_hide-opal"), linkedDevice("T:_hide-pete")]);
    const opalSocial = await Client.social(opal, [pete.gcId]);
    const peteSocial = await Client.social(pete, [opal.gcId]);
    expect(await opalSocial.presence(pete)).toBe("online");
    expect(await peteSocial.take("visibility_status")).toMatchObject({ visibility: "visible" });

    // An invite waiting when the player hides ends as if they had gone.
    opalSocial.send({ type: "invite_friend", playerId: pete.gcId });
    const pending = await peteSocial.take("invite_received");
    await setVisibility(peteSocial, "appear_offline");
    expect(await opalSocial.take("invite_closed")).toMatchObject({ inviteId: pending.inviteId, reason: "unavailable" });
    expect(await peteSocial.take("invite_closed")).toMatchObject({ inviteId: pending.inviteId, reason: "declined" });
    expect(await opalSocial.presence(pete)).toBe("offline");

    // Opal's friend list (even reloaded) shows Pete offline, and the server refuses invites to him.
    expect(statuses(await opalSocial.uploadFriends([pete.gcId]))).toEqual({ [pete.gcId]: "offline" });
    opalSocial.send({ type: "invite_friend", playerId: pete.gcId });
    expect(await opalSocial.take("invite_error")).toMatchObject({ code: "FRIEND_UNAVAILABLE" });
    expect(await peteSocial.quiet("invite_received")).toEqual([]);

    // Pete still sees Opal and can invite her himself.
    peteSocial.send({ type: "invite_friend", playerId: opal.gcId });
    const outgoing = await peteSocial.take("invite_sent");
    peteSocial.send({ type: "cancel_invite", inviteId: outgoing.inviteId });
    await peteSocial.take("invite_closed");

    await setVisibility(peteSocial, "visible");
    expect(await opalSocial.presence(pete)).toBe("online");
    await Promise.all([opalSocial.close(), peteSocial.close()]);
  }, TEST_TIMEOUT_MS);

  it("Do Not Disturb shows the player as busy and declines invites politely", async () => {
    const [quinn, rosa] = await Promise.all([linkedDevice("T:_dnd-quinn"), linkedDevice("T:_dnd-rosa")]);
    const quinnSocial = await Client.social(quinn, [rosa.gcId]);
    const rosaSocial = await Client.social(rosa, [quinn.gcId]);
    expect(await quinnSocial.presence(rosa)).toBe("online");

    quinnSocial.send({ type: "invite_friend", playerId: rosa.gcId });
    const pending = await rosaSocial.take("invite_received");
    await setVisibility(rosaSocial, "do_not_disturb");
    expect(await quinnSocial.take("invite_closed")).toMatchObject({ inviteId: pending.inviteId, reason: "busy" });
    expect(await rosaSocial.take("invite_closed")).toMatchObject({ inviteId: pending.inviteId, reason: "declined" });
    expect(await quinnSocial.presence(rosa)).toBe("busy");

    quinnSocial.send({ type: "invite_friend", playerId: rosa.gcId });
    const declined = await quinnSocial.take("invite_error");
    expect(declined).toMatchObject({ code: "FRIEND_BUSY" });
    expect(declined.message).toMatch(/Do Not Disturb/);
    expect(await rosaSocial.quiet("invite_received")).toEqual([]);

    // A game does not change what friends see while Do Not Disturb is on.
    const rosaGame = await Client.open(rosa.token);
    const quinnGame = await Client.open(quinn.token);
    rosaGame.send({ type: "create_room" });
    const { roomCode } = await rosaGame.take("room_created");
    quinnGame.send({ type: "join_room", roomCode });
    await rosaGame.take("match_found");
    expect(await quinnSocial.quiet("friend_presence")).toEqual([]);
    await Promise.all([rosaGame.close(), quinnGame.close()]);

    await Promise.all([quinnSocial.close(), rosaSocial.close()]);
  }, TEST_TIMEOUT_MS);

  it("keeps the choice across reconnects and on every device, and updates other devices live", async () => {
    const sam = await linkedDevice("T:_sync-sam");
    const samPhone = sam;
    const samTablet = await linkedDevice("T:_sync-sam");
    const tess = await linkedDevice("T:_sync-tess");
    const tessSocial = await Client.social(tess, [sam.gcId]);

    let phone = await Client.social(samPhone, [tess.gcId]);
    expect(await phone.take("visibility_status")).toMatchObject({ visibility: "visible" });
    expect(await tessSocial.presence(sam)).toBe("online");
    await setVisibility(phone, "do_not_disturb");
    expect(await tessSocial.presence(sam)).toBe("busy");
    await phone.close();
    expect(await tessSocial.presence(sam)).toBe("offline");

    const saved = await appPool.query<{ friend_visibility: string }>(
      "select friend_visibility from player_accounts where game_center_player_id = $1",
      [sam.gcId],
    );
    expect(saved.rows).toEqual([{ friend_visibility: "do_not_disturb" }]);

    // Reconnecting, on the same device or another one, restores the saved choice.
    phone = await Client.social(samPhone, [tess.gcId]);
    expect(await phone.take("visibility_status")).toMatchObject({ visibility: "do_not_disturb" });
    expect(await tessSocial.presence(sam)).toBe("busy");
    const tablet = await Client.social(samTablet, [tess.gcId]);
    expect(await tablet.take("visibility_status")).toMatchObject({ visibility: "do_not_disturb" });
    // Friends who load their list now see the saved choice straight away.
    expect(statuses(await tessSocial.uploadFriends([sam.gcId]))).toEqual({ [sam.gcId]: "busy" });

    // A change on one device reaches the other at once.
    await setVisibility(tablet, "appear_offline");
    expect(await phone.take("visibility_status", (message) => message.visibility === "appear_offline"))
      .toMatchObject({ visibility: "appear_offline" });
    expect(await tessSocial.presence(sam)).toBe("offline");
    await setVisibility(phone, "visible");
    expect(await tablet.take("visibility_status", (message) => message.visibility === "visible"))
      .toMatchObject({ visibility: "visible" });
    expect(await tessSocial.presence(sam)).toBe("online");

    await Promise.all([tessSocial.close(), phone.close(), tablet.close()]);
  }, TEST_TIMEOUT_MS);

  it("refuses the setting without Game Center and limits how often it changes", async () => {
    const unlinked = await Client.open(randomBytes(32).toString("hex"));
    unlinked.send({ type: "set_visibility", visibility: "appear_offline" });
    expect(await unlinked.take("friends_error")).toMatchObject({ code: "NOT_LINKED" });
    expect(await unlinked.quiet("visibility_status")).toEqual([]);

    const uma = await linkedDevice("T:_visibility-limit-uma");
    const umaSocial = await Client.social(uma, []);
    await umaSocial.take("visibility_status");
    for (let i = 0; i < 10; i++) {
      umaSocial.send({ type: "set_visibility", visibility: i % 2 === 0 ? "do_not_disturb" : "visible" });
    }
    umaSocial.send({ type: "set_visibility", visibility: "appear_offline" });
    expect(await umaSocial.take("friends_error")).toMatchObject({ code: "RATE_LIMITED" });
    // Changes are applied in order, so the last accepted one (visible) is what was saved.
    const updates = (await umaSocial.quiet("visibility_status")).map((message) => message.visibility);
    expect(updates).toHaveLength(10);
    expect(updates.at(-1)).toBe("visible");
    const saved = await appPool.query<{ friend_visibility: string }>(
      "select friend_visibility from player_accounts where game_center_player_id = $1",
      [uma.gcId],
    );
    expect(saved.rows).toEqual([{ friend_visibility: "visible" }]);

    await Promise.all([unlinked.close(), umaSocial.close()]);
  }, TEST_TIMEOUT_MS);
});
