const { Session } = require("../dist/sessions/Session");
const { MemoryObjectStorage } = require("../dist/storage/ObjectStorage");

class FakeSocket {
  constructor() {
    this.readyState = 1;
    this.bufferedAmount = 0;
    this.messages = [];
  }

  send(raw) {
    this.messages.push(JSON.parse(raw));
  }
}

async function run() {
  const rejectionReason = (socket) => socket.messages.filter((message) => message.type === "action_result").at(-1)?.reason;

  const unreadySession = new Session("host", "arena", new FakeSocket(), new MemoryObjectStorage());
  const unreadySpectator = new FakeSocket();
  unreadySession.addSpectator(unreadySpectator, "Waiting");
  if (unreadySession.tryForwardAction(unreadySpectator, {
    type: "action",
    sessionId: unreadySession.sessionId,
    requestId: "manifest-not-ready",
    action: "meteor",
    worldX: 1,
    worldZ: 2,
  })) throw new Error("Launch without manifest should be rejected.");
  if (rejectionReason(unreadySpectator) !== "manifest_not_ready") throw new Error("Missing manifest rejection reason mismatch.");

  const player = new FakeSocket();
  const alice = new FakeSocket();
  const bob = new FakeSocket();
  const session = new Session("host", "arena", player, new MemoryObjectStorage());
  session.addSpectator(alice, "Alice");
  session.addSpectator(bob, "Bob");
  session.setAbilityManifest({
    type: "ability_manifest",
    abilities: [
      {
        id: "meteor",
        targetingMode: "area",
        cooldownMs: 1000,
        rateLimitGroupId: "area_damage",
        rateLimitGroupLabel: "Area",
        rateLimitCategory: "area_damage",
        rateLimitCapacity: 1,
        rateLimitRefillMs: 20,
      },
      { id: "broken", targetingMode: "point", cooldownMs: 0 },
    ],
  });

  const launch = (requestId, socket) => session.tryForwardAction(socket, {
    type: "action",
    sessionId: session.sessionId,
    requestId,
    action: "meteor",
    worldX: 1,
    worldZ: 2,
  });

  if (!launch("alice-1", alice)) throw new Error("First launch should be accepted.");
  if (launch("bob-1", bob)) throw new Error("Second launch should hit the shared group limit.");
  if (rejectionReason(bob) !== "group_limited") throw new Error("Shared group rejection reason mismatch.");

  const eventCount = player.messages.filter((message) => message.type === "event").length;
  if (!launch("alice-1", alice)) throw new Error("Duplicate request should replay the accepted result.");
  if (player.messages.filter((message) => message.type === "event").length !== eventCount) {
    throw new Error("Duplicate request forwarded a second Unity event.");
  }

  await new Promise((resolve) => setTimeout(resolve, 30));
  if (!launch("bob-2", bob)) throw new Error("Refill should restore one group slot.");

  if (session.tryForwardAction(bob, {
    type: "action",
    sessionId: session.sessionId,
    requestId: "broken-profile",
    action: "broken",
    worldX: 1,
    worldZ: 2,
  })) throw new Error("Ability without profile should be rejected.");
  if (rejectionReason(bob) !== "missing_profile") throw new Error("Missing profile rejection reason mismatch.");

  if (session.tryForwardAction(bob, {
    type: "action",
    sessionId: session.sessionId,
    requestId: "invalid-target",
    action: "meteor",
  })) throw new Error("Area ability without target should be rejected.");
  if (rejectionReason(bob) !== "invalid_target") throw new Error("Invalid target rejection reason mismatch.");

  session.removeSpectator(alice);
  const aliceReconnect = new FakeSocket();
  session.addSpectator(aliceReconnect, "Alice");
  await new Promise((resolve) => setTimeout(resolve, 30));
  if (launch("alice-reconnect", aliceReconnect)) throw new Error("Reconnect should not reset personal cooldown.");
  if (rejectionReason(aliceReconnect) !== "personal_cooldown") throw new Error("Reconnect cooldown rejection reason mismatch.");

  console.log("shared limiter smoke test passed");
}

void run();
