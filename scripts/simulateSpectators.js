#!/usr/bin/env node

const crypto = require('crypto');
const WebSocket = require('ws');

const DEFAULTS = {
  url: 'ws://localhost:8080',
  count: 100,
  durationMs: 300_000,
  rampMs: 20_000,
  mode: 'realistic',
  namePrefix: 'Bot',
  reportEveryMs: 5_000,
  joinTimeoutMs: 10_000,
  sessionTimeoutMs: 8_000,
  stressIntervalMs: 750,
  realisticMinMs: 2_800,
  realisticMaxMs: 7_500,
  soakMinMs: 8_000,
  soakMaxMs: 18_000,
};

const VALID_MODES = new Set(['realistic', 'stress', 'soak']);
const TARGETING_MODES = new Set(['point', 'area', 'global', 'player']);

function printUsage() {
  console.log(`
Specton spectator simulator

Usage:
  npm run simulate:spectators -- [options]
  npm run simulate:spectators -- <count> <duration> <ramp> <sessionId> <url>

Options:
  --url <ws-url>              WebSocket server URL. Default: ${DEFAULTS.url}
  --session <id>              Join this session. If omitted, the first live session is discovered.
  --count <n>                 Number of spectator bots. Default: ${DEFAULTS.count}
  --duration <time>           Run duration, e.g. 30s, 5m. Default: 300s
  --ramp <time>               Time to spread joins across. Default: 20s
  --mode <realistic|stress|soak>
                              realistic respects cooldowns; stress pushes rate limits; soak is slow.
  --name-prefix <text>        Bot name prefix. Default: Bot
  --seed <text>               Repeatable random seed.
  --report-every <time>       Live metric interval. Default: 5s
  --stress-interval-ms <n>    Per-bot action interval in stress mode. Default: 750
  --verbose                   Print per-bot events.
  --json                      Print final summary as JSON only.
  --help                      Show this help.

Windows/npm fallback:
  If npm strips option names in PowerShell, use positional args:
  npm run simulate:spectators -- 25 60s 10s abc123 ws://localhost:8080
`);
}

function parseArgs(argv) {
  const options = { ...DEFAULTS, sessionId: '', seed: '', verbose: false, json: false };
  const raw = [...argv];
  const positionals = [];

  for (let i = 0; i < raw.length; i += 1) {
    const arg = raw[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--verbose') {
      options.verbose = true;
      continue;
    }

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    const [keyWithDashes, inlineValue] = arg.split(/=(.*)/s, 2);
    const key = keyWithDashes.slice(2);
    const value = inlineValue !== undefined ? inlineValue : raw[++i];
    if (value === undefined) throw new Error(`Missing value for --${key}.`);

    switch (key) {
      case 'url':
        options.url = value;
        break;
      case 'session':
        options.sessionId = value;
        break;
      case 'count':
        options.count = parsePositiveInt(value, '--count');
        break;
      case 'duration':
        options.durationMs = parseDuration(value, '--duration');
        break;
      case 'ramp':
        options.rampMs = parseDuration(value, '--ramp');
        break;
      case 'mode':
        options.mode = value;
        break;
      case 'name-prefix':
        options.namePrefix = String(value).slice(0, 18) || DEFAULTS.namePrefix;
        break;
      case 'seed':
        options.seed = String(value);
        break;
      case 'report-every':
        options.reportEveryMs = parseDuration(value, '--report-every');
        break;
      case 'stress-interval-ms':
        options.stressIntervalMs = parsePositiveInt(value, '--stress-interval-ms');
        break;
      default:
        throw new Error(`Unknown option --${key}.`);
    }
  }

  applyPositionals(options, positionals);

  if (!VALID_MODES.has(options.mode)) {
    throw new Error(`Invalid --mode "${options.mode}". Use realistic, stress, or soak.`);
  }
  if (options.count < 1) throw new Error('--count must be at least 1.');
  if (options.count > 1_000) throw new Error('--count is capped at 1000 for this dev tool.');
  if (options.durationMs < 1_000) throw new Error('--duration must be at least 1s.');
  if (options.reportEveryMs < 1_000) throw new Error('--report-every must be at least 1s.');

  return options;
}

function applyPositionals(options, positionals) {
  if (!positionals.length) return;
  if (positionals.length > 5) {
    throw new Error(`Unexpected positional arguments: ${positionals.join(' ')}.`);
  }

  const [count, duration, ramp, sessionId, url] = positionals;
  if (count !== undefined) options.count = parsePositiveInt(count, 'count');
  if (duration !== undefined) options.durationMs = parseDuration(duration, 'duration');
  if (ramp !== undefined) options.rampMs = parseDuration(ramp, 'ramp');
  if (sessionId !== undefined) options.sessionId = sessionId;
  if (url !== undefined) options.url = url;
}

function parsePositiveInt(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function parseDuration(value, label) {
  const text = String(value).trim().toLowerCase();
  const match = text.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)?$/);
  if (!match) throw new Error(`${label} must be a duration like 500ms, 30s, or 5m.`);
  const amount = Number(match[1]);
  const unit = match[2] || 'ms';
  const multiplier = unit === 'h' ? 3_600_000 : unit === 'm' ? 60_000 : unit === 's' ? 1_000 : 1;
  return Math.max(1, Math.round(amount * multiplier));
}

function formatMs(ms) {
  if (!Number.isFinite(ms)) return 'n/a';
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function createRng(seedText) {
  let seed = 0x9e3779b9;
  const text = seedText || crypto.randomBytes(8).toString('hex');
  for (let i = 0; i < text.length; i += 1) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 0x85ebca6b) >>> 0;
  }

  return function random() {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function randomBetween(rng, min, max) {
  return min + rng() * (max - min);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeJsonParse(data) {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function sendJson(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
    return true;
  }
  return false;
}

function normalizeTargetingMode(value) {
  const normalized = String(value || '').toLowerCase();
  return TARGETING_MODES.has(normalized) ? normalized : 'point';
}

function normalizeAbility(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id.trim()) {
    return null;
  }

  return {
    id: raw.id.trim(),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : raw.id.trim(),
    targetingMode: normalizeTargetingMode(raw.targetingMode),
    cooldownMs: Number.isFinite(Number(raw.cooldownMs)) ? Math.max(0, Number(raw.cooldownMs)) : 0,
    rateLimitGroupId: typeof raw.rateLimitGroupId === 'string' ? raw.rateLimitGroupId : '',
  };
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function buildToken(seed, index) {
  return crypto.createHash('sha1').update(`${seed || 'specton'}:${index}`).digest('hex').slice(0, 32);
}

class Metrics {
  constructor() {
    this.startedAt = Date.now();
    this.connectionsAttempted = 0;
    this.connected = 0;
    this.joined = 0;
    this.joinFailed = 0;
    this.closed = 0;
    this.errors = 0;
    this.actionsAttempted = 0;
    this.actionsAccepted = 0;
    this.actionsRejected = 0;
    this.rejectReasons = new Map();
    this.latencies = [];
    this.spectatorCount = 0;
    this.finished = false;
    this.sessionEnded = false;
    this.serverErrors = new Map();
  }

  addReject(reason) {
    const key = reason || 'unknown';
    this.rejectReasons.set(key, (this.rejectReasons.get(key) || 0) + 1);
  }

  addServerError(message) {
    const key = message || 'Unknown server error';
    this.serverErrors.set(key, (this.serverErrors.get(key) || 0) + 1);
  }

  summary(options, sessionId) {
    const now = Date.now();
    return {
      sessionId,
      mode: options.mode,
      requestedSpectators: options.count,
      uptimeMs: now - this.startedAt,
      connectionsAttempted: this.connectionsAttempted,
      connected: this.connected,
      joined: this.joined,
      joinFailed: this.joinFailed,
      closed: this.closed,
      errors: this.errors,
      currentSpectatorCount: this.spectatorCount,
      actionsAttempted: this.actionsAttempted,
      actionsAccepted: this.actionsAccepted,
      actionsRejected: this.actionsRejected,
      rejectReasons: Object.fromEntries(this.rejectReasons),
      actionLatencyMs: {
        count: this.latencies.length,
        p50: percentile(this.latencies, 50),
        p95: percentile(this.latencies, 95),
        max: this.latencies.length ? Math.max(...this.latencies) : 0,
      },
      finished: this.finished,
      sessionEnded: this.sessionEnded,
      serverErrors: Object.fromEntries(this.serverErrors),
    };
  }
}

class SimulatorState {
  constructor() {
    this.abilities = [];
    this.abilityById = new Map();
    this.groups = new Map();
    this.gameState = null;
    this.routeLayout = null;
    this.finished = false;
    this.sessionEnded = false;
  }

  updateFromMessage(message) {
    if (!message || typeof message !== 'object') return;

    if (message.type === 'ability_manifest' && Array.isArray(message.abilities)) {
      const abilities = message.abilities.map(normalizeAbility).filter(Boolean);
      this.abilities = abilities;
      this.abilityById = new Map(abilities.map((ability) => [ability.id, ability]));
      return;
    }

    if (message.type === 'ability_limit_state' && Array.isArray(message.groups)) {
      for (const group of message.groups) {
        if (group && typeof group.groupId === 'string') {
          this.groups.set(group.groupId, {
            availableTokens: Number(group.availableTokens) || 0,
            capacity: Number(group.capacity) || 0,
            refillMs: Number(group.refillMs) || 0,
            updatedAt: Number(group.updatedAt) || Date.now(),
          });
        }
      }
      return;
    }

    if (message.type === 'game_state') {
      this.gameState = message;
      return;
    }

    if (message.type === 'route_layout') {
      this.routeLayout = message;
      return;
    }

    if (message.type === 'game_finished') this.finished = true;
    if (message.type === 'session_ended') this.sessionEnded = true;
  }
}

class SpectatorBot {
  constructor(index, sessionId, options, sharedState, metrics, rng) {
    this.index = index;
    this.sessionId = sessionId;
    this.options = options;
    this.sharedState = sharedState;
    this.metrics = metrics;
    this.rng = rng;
    this.name = `${options.namePrefix}${String(index + 1).padStart(3, '0')}`;
    this.token = buildToken(options.seed || options.namePrefix, index);
    this.ws = null;
    this.joined = false;
    this.stopped = false;
    this.actionTimer = null;
    this.joinTimer = null;
    this.pendingActions = new Map();
    this.personalCooldowns = new Map();
  }

  log(message) {
    if (this.options.verbose && !this.options.json) {
      console.log(`[${this.name}] ${message}`);
    }
  }

  start() {
    this.metrics.connectionsAttempted += 1;
    this.ws = new WebSocket(this.options.url);

    this.joinTimer = setTimeout(() => {
      if (!this.joined) {
        this.metrics.joinFailed += 1;
        this.log('join timeout');
        this.stop();
      }
    }, this.options.joinTimeoutMs);

    this.ws.on('open', () => {
      this.metrics.connected += 1;
      sendJson(this.ws, {
        type: 'join_session',
        sessionId: this.sessionId,
        spectatorName: this.name,
        spectatorToken: this.token,
      });
    });

    this.ws.on('message', (data) => this.handleMessage(data.toString()));
    this.ws.on('error', (error) => {
      this.metrics.errors += 1;
      this.log(`socket error: ${error.message}`);
    });
    this.ws.on('close', () => {
      this.metrics.closed += 1;
      this.stopped = true;
      if (this.actionTimer) clearTimeout(this.actionTimer);
      if (this.joinTimer) clearTimeout(this.joinTimer);
    });
  }

  handleMessage(data) {
    const message = safeJsonParse(data);
    if (!message || typeof message.type !== 'string') return;

    this.sharedState.updateFromMessage(message);

    switch (message.type) {
      case 'session_joined':
        if (!this.joined) {
          this.joined = true;
          this.metrics.joined += 1;
          if (this.joinTimer) clearTimeout(this.joinTimer);
          this.log('joined');
          this.scheduleNextAction();
        }
        break;
      case 'spectator_count':
        this.metrics.spectatorCount = Number(message.count) || this.metrics.spectatorCount;
        break;
      case 'ability_limit_state':
        this.handleLimitState(message);
        break;
      case 'action_result':
        this.handleActionResult(message);
        break;
      case 'game_finished':
        this.metrics.finished = true;
        this.stopActions();
        break;
      case 'session_ended':
        this.metrics.sessionEnded = true;
        this.stopActions();
        break;
      case 'error':
        this.metrics.addServerError(message.message);
        this.log(`server error: ${message.message || 'unknown'}`);
        break;
      default:
        break;
    }
  }

  handleLimitState(message) {
    const now = Date.now();
    if (!message.personalCooldowns || typeof message.personalCooldowns !== 'object') return;
    for (const [action, cooldownEnd] of Object.entries(message.personalCooldowns)) {
      const end = Number(cooldownEnd);
      if (Number.isFinite(end) && end > now) {
        this.personalCooldowns.set(action, end);
      } else {
        this.personalCooldowns.delete(action);
      }
    }
  }

  handleActionResult(message) {
    const sentAt = this.pendingActions.get(message.requestId);
    if (sentAt) {
      this.pendingActions.delete(message.requestId);
      this.metrics.latencies.push(Date.now() - sentAt);
    }

    if (message.accepted) {
      this.metrics.actionsAccepted += 1;
      const ability = this.sharedState.abilityById.get(message.action);
      const cooldownMs = Number(message.personalCooldownMs) || ability?.cooldownMs || 0;
      if (cooldownMs > 0) this.personalCooldowns.set(message.action, Date.now() + cooldownMs);
      return;
    }

    this.metrics.actionsRejected += 1;
    this.metrics.addReject(message.reason);
    if (message.reason === 'personal_cooldown' && Number(message.personalCooldownMs) > 0) {
      this.personalCooldowns.set(message.action, Date.now() + Number(message.personalCooldownMs));
    }
    if (message.reason === 'game_finished') this.stopActions();
  }

  scheduleNextAction() {
    if (this.stopped || !this.joined || this.sharedState.finished || this.sharedState.sessionEnded) return;
    const delay = this.resolveActionDelay();
    this.actionTimer = setTimeout(() => {
      this.actionTimer = null;
      this.trySendAction();
      this.scheduleNextAction();
    }, delay);
  }

  resolveActionDelay() {
    if (this.options.mode === 'stress') {
      return Math.max(50, this.options.stressIntervalMs + Math.round(randomBetween(this.rng, -150, 150)));
    }
    if (this.options.mode === 'soak') {
      return Math.round(randomBetween(this.rng, this.options.soakMinMs, this.options.soakMaxMs));
    }
    return Math.round(randomBetween(this.rng, this.options.realisticMinMs, this.options.realisticMaxMs));
  }

  trySendAction() {
    if (this.stopped || !this.joined || this.ws?.readyState !== WebSocket.OPEN) return;
    if (this.sharedState.finished || this.sharedState.sessionEnded) return;

    const ability = this.chooseAbility();
    if (!ability) return;

    const requestId = `${this.index}-${Date.now().toString(36)}-${Math.floor(this.rng() * 1e8).toString(36)}`;
    const payload = {
      type: 'action',
      sessionId: this.sessionId,
      requestId,
      action: ability.id,
    };

    const target = this.resolveTarget(ability);
    if (target) {
      payload.worldX = target.worldX;
      payload.worldZ = target.worldZ;
    }

    if (sendJson(this.ws, payload)) {
      this.metrics.actionsAttempted += 1;
      this.pendingActions.set(requestId, Date.now());
      this.log(`action ${ability.id}${target ? ` @ ${target.worldX.toFixed(1)},${target.worldZ.toFixed(1)}` : ''}`);
    }
  }

  chooseAbility() {
    const now = Date.now();
    const abilities = this.sharedState.abilities;
    if (!abilities.length) return null;

    const candidates = abilities.filter((ability) => {
      if (this.options.mode === 'stress') return true;
      const cooldownEnd = this.personalCooldowns.get(ability.id) || 0;
      if (cooldownEnd > now) return false;
      if (ability.rateLimitGroupId) {
        const group = this.sharedState.groups.get(ability.rateLimitGroupId);
        if (group && estimateGroupAvailableTokens(group, now) < 1) return false;
      }
      return true;
    });

    const pool = candidates.length ? candidates : (this.options.mode === 'stress' ? abilities : []);
    if (!pool.length) return null;

    const playerTargeted = pool.filter((ability) => ability.targetingMode === 'player');
    const pointTargeted = pool.filter((ability) => ability.targetingMode === 'point' || ability.targetingMode === 'area');
    const global = pool.filter((ability) => ability.targetingMode === 'global');

    if (this.options.mode !== 'stress') {
      if (this.rng() < 0.45 && playerTargeted.length) return sample(playerTargeted, this.rng);
      if (this.rng() < 0.85 && pointTargeted.length) return sample(pointTargeted, this.rng);
      if (global.length) return sample(global, this.rng);
    }

    return sample(pool, this.rng);
  }

  resolveTarget(ability) {
    if (ability.targetingMode === 'global' || ability.targetingMode === 'player') return null;

    const bounds = this.resolveBounds();
    const gameState = this.sharedState.gameState;
    let x = Number(gameState?.playerX);
    let z = Number(gameState?.playerZ);

    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      x = randomBetween(this.rng, bounds.minX, bounds.maxX);
      z = randomBetween(this.rng, bounds.minZ, bounds.maxZ);
    } else {
      const offsetRadius = ability.targetingMode === 'area' ? 6 : 3;
      const angle = randomBetween(this.rng, 0, Math.PI * 2);
      const distance = randomBetween(this.rng, 0, offsetRadius);
      x += Math.cos(angle) * distance;
      z += Math.sin(angle) * distance;
    }

    return {
      worldX: clamp(round2(x), bounds.minX, bounds.maxX),
      worldZ: clamp(round2(z), bounds.minZ, bounds.maxZ),
    };
  }

  resolveBounds() {
    const source = this.sharedState.gameState || this.sharedState.routeLayout || {};
    const minX = Number(source.mapMinX);
    const maxX = Number(source.mapMaxX);
    const minZ = Number(source.mapMinZ);
    const maxZ = Number(source.mapMaxZ);

    if ([minX, maxX, minZ, maxZ].every(Number.isFinite) && minX < maxX && minZ < maxZ) {
      return { minX, maxX, minZ, maxZ };
    }

    return { minX: -25, maxX: 25, minZ: -25, maxZ: 25 };
  }

  stopActions() {
    if (this.actionTimer) clearTimeout(this.actionTimer);
    this.actionTimer = null;
  }

  stop() {
    this.stopActions();
    this.stopped = true;
    if (this.joinTimer) clearTimeout(this.joinTimer);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      sendJson(this.ws, { type: 'leave_session', sessionId: this.sessionId });
      this.ws.close(1000, 'simulator shutdown');
    } else if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.terminate();
    }
  }
}

function sample(items, rng) {
  return items[Math.floor(rng() * items.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function estimateGroupAvailableTokens(group, now) {
  const capacity = Math.max(0, Number(group.capacity) || 0);
  const refillMs = Math.max(1, Number(group.refillMs) || 1);
  const updatedAt = Number(group.updatedAt) || now;
  const snapshotTokens = Math.max(0, Number(group.availableTokens) || 0);

  if (capacity <= 0) return 0;
  if (snapshotTokens >= capacity) return capacity;

  const refillCount = Math.floor(Math.max(0, now - updatedAt) / refillMs);
  return Math.min(capacity, snapshotTokens + refillCount);
}

async function discoverSession(options) {
  if (options.sessionId) return options.sessionId;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(options.url);
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error(`Timed out waiting for session_list from ${options.url}.`));
    }, options.sessionTimeoutMs);

    ws.on('open', () => {
      sendJson(ws, { type: 'list_sessions' });
    });

    ws.on('message', (data) => {
      const message = safeJsonParse(data.toString());
      if (!message) return;

      if (message.type === 'session_list') {
        clearTimeout(timer);
        const sessions = Array.isArray(message.sessions) ? message.sessions : [];
        const ready = sessions.find((session) => session && session.routeReady && session.bootPhase === 'ready');
        const fallback = sessions.find((session) => session && session.sessionId);
        const chosen = ready || fallback;
        ws.close(1000, 'discovery complete');

        if (!chosen) {
          reject(new Error('No live sessions found. Start a Unity-hosted arena or pass --session <id>.'));
          return;
        }

        resolve(chosen.sessionId);
      } else if (message.type === 'error') {
        clearTimeout(timer);
        ws.close(1000, 'discovery error');
        reject(new Error(message.message || 'Server returned an error during session discovery.'));
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function printLiveReport(metrics, options, sessionId) {
  const summary = metrics.summary(options, sessionId);
  const rejectText = Object.entries(summary.rejectReasons)
    .map(([reason, count]) => `${reason}:${count}`)
    .join(', ') || 'none';
  const latency = summary.actionLatencyMs;

  console.log(
    `[${formatMs(summary.uptimeMs)}] joined ${summary.joined}/${summary.requestedSpectators}, ` +
    `actions ${summary.actionsAccepted}/${summary.actionsAttempted} accepted, rejected ${summary.actionsRejected} ` +
    `(${rejectText}), latency p50 ${formatMs(latency.p50)} p95 ${formatMs(latency.p95)}, ` +
    `spectators ${summary.currentSpectatorCount}`
  );
}

function printFinalReport(metrics, options, sessionId) {
  const summary = metrics.summary(options, sessionId);
  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log('\nFinal spectator simulation summary');
  console.log(`Session: ${summary.sessionId}`);
  console.log(`Mode: ${summary.mode}`);
  console.log(`Duration: ${formatMs(summary.uptimeMs)}`);
  console.log(`Joined: ${summary.joined}/${summary.requestedSpectators}`);
  console.log(`Connections: ${summary.connected} opened, ${summary.closed} closed, ${summary.errors} socket errors`);
  console.log(`Actions: ${summary.actionsAccepted}/${summary.actionsAttempted} accepted, ${summary.actionsRejected} rejected`);
  console.log(`Reject reasons: ${Object.entries(summary.rejectReasons).map(([k, v]) => `${k}:${v}`).join(', ') || 'none'}`);
  console.log(
    `Latency: p50 ${formatMs(summary.actionLatencyMs.p50)}, ` +
    `p95 ${formatMs(summary.actionLatencyMs.p95)}, max ${formatMs(summary.actionLatencyMs.max)}`
  );
  console.log(`Final flags: game_finished=${summary.finished}, session_ended=${summary.sessionEnded}`);
  const serverErrors = Object.entries(summary.serverErrors);
  if (serverErrors.length) {
    console.log(`Server errors: ${serverErrors.map(([k, v]) => `${k} (${v})`).join('; ')}`);
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const seed = options.seed || crypto.randomBytes(8).toString('hex');
  const rng = createRng(seed);
  options.seed = seed;

  const sessionId = await discoverSession(options);
  const metrics = new Metrics();
  const sharedState = new SimulatorState();
  const bots = [];

  if (!options.json) {
    console.log(`Specton spectator simulator`);
    console.log(`URL: ${options.url}`);
    console.log(`Session: ${sessionId}`);
    console.log(`Mode: ${options.mode}`);
    console.log(`Spectators: ${options.count}, ramp: ${formatMs(options.rampMs)}, duration: ${formatMs(options.durationMs)}`);
    console.log(`Seed: ${seed}`);
    if (options.mode === 'stress') {
      console.log('Stress mode is intentionally noisy and will trigger rate-limit rejections.');
    }
  }

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (reportTimer) clearInterval(reportTimer);
    if (durationTimer) clearTimeout(durationTimer);
    for (const bot of bots) bot.stop();
    await sleep(250);
    printFinalReport(metrics, options, sessionId);
  };

  const reportTimer = options.json
    ? null
    : setInterval(() => printLiveReport(metrics, options, sessionId), options.reportEveryMs);

  const durationTimer = setTimeout(() => {
    shutdown().then(() => process.exit(0));
  }, options.durationMs);

  process.once('SIGINT', () => {
    shutdown().then(() => process.exit(130));
  });
  process.once('SIGTERM', () => {
    shutdown().then(() => process.exit(143));
  });

  for (let i = 0; i < options.count; i += 1) {
    const botRng = createRng(`${seed}:${i}`);
    const bot = new SpectatorBot(i, sessionId, options, sharedState, metrics, botRng);
    bots.push(bot);

    const rampDelay = options.count === 1 ? 0 : Math.round((options.rampMs * i) / (options.count - 1));
    setTimeout(() => {
      if (!shuttingDown) bot.start();
    }, rampDelay);
  }
}

run().catch((error) => {
  console.error(`Spectator simulator failed: ${error.message}`);
  process.exit(1);
});
