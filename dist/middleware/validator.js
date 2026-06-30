"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeInvalidMessage = describeInvalidMessage;
exports.validateMessage = validateMessage;
const VALID_TYPES = ['create_session', 'join_session', 'leave_session', 'rename_spectator', 'list_sessions', 'action', 'game_state', 'map_image', 'map_tile', 'map_tiles', 'map_objects', 'ability_manifest', 'weapon_manifest', 'route_layout', 'session_status', 'projectile_spawn', 'projectile_destroy', 'drop_spawn', 'drop_destroy', 'damage_dealt', 'finish_game'];
const VALID_SESSION_PHASES = [
    'booting',
    'generating',
    'capturing',
    'publishing',
    'baking_navmesh',
    'ready',
    'failed',
    'error',
];
function describeInvalidMessage(raw) {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return 'Message is not valid JSON.';
    }
    const type = parsed?.type;
    if (!parsed || typeof parsed !== 'object')
        return 'Message root is not an object.';
    if (!VALID_TYPES.includes(type))
        return `Unknown message type '${String(type)}'.`;
    switch (type) {
        case 'session_status':
            if (typeof parsed.phase !== 'string')
                return 'session_status.phase must be a string.';
            if (!VALID_SESSION_PHASES.includes(parsed.phase))
                return `Unsupported session_status phase '${parsed.phase}'.`;
            return 'Invalid session_status payload.';
        case 'map_image':
            if (typeof parsed.data !== 'string' || parsed.data.length === 0)
                return 'map_image.data is missing or empty.';
            if (parsed.data.length > 10000000)
                return `map_image.data is too large (${parsed.data.length} chars).`;
            return 'Invalid map_image payload.';
        case 'map_tile':
            if (typeof parsed.path !== 'string' || parsed.path.length === 0)
                return 'map_tile.path is missing.';
            if (typeof parsed.data !== 'string' || parsed.data.length === 0)
                return 'map_tile.data is missing or empty.';
            if (parsed.data.length > 25000000)
                return `map_tile.data is too large (${parsed.data.length} chars).`;
            return 'Invalid map_tile payload.';
        case 'game_state':
            return `Invalid game_state payload. playerX=${typeof parsed.playerX}, playerZ=${typeof parsed.playerZ}.`;
        case 'ability_manifest':
            return `ability_manifest.abilities must be an array.`;
        case 'weapon_manifest':
            return `weapon_manifest.weapons must be an array.`;
        case 'route_layout':
            return 'route_layout.modules and route_layout.connections must be arrays.';
        case 'map_objects':
            return 'map_objects.objects must be an array.';
        case 'rename_spectator':
            if (typeof parsed.sessionId !== 'string' || !parsed.sessionId.trim()) {
                return 'rename_spectator.sessionId is missing.';
            }
            if (typeof parsed.requestId !== 'string' || !parsed.requestId.trim()) {
                return 'rename_spectator.requestId is missing.';
            }
            if (parsed.requestId.length > 96) {
                return 'rename_spectator.requestId is too long.';
            }
            if (typeof parsed.spectatorName !== 'string' || !parsed.spectatorName.trim()) {
                return 'Spectator name cannot be empty.';
            }
            if (parsed.spectatorName.length > 24) {
                return 'Spectator name must be 24 characters or fewer.';
            }
            return 'Invalid rename request.';
        default:
            return `Invalid ${type} payload.`;
    }
}
function validateMessage(raw) {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object' || !VALID_TYPES.includes(parsed.type)) {
        return null;
    }
    switch (parsed.type) {
        case 'create_session':
            if (typeof parsed.playerName !== 'string' || !parsed.playerName.trim())
                return null;
            if (typeof parsed.level !== 'string' || !parsed.level.trim())
                return null;
            if (parsed.playerName.length > 32 || parsed.level.length > 32)
                return null;
            return {
                type: 'create_session',
                playerName: parsed.playerName.trim(),
                level: parsed.level.trim(),
            };
        case 'join_session':
            if (typeof parsed.sessionId !== 'string' || !parsed.sessionId.trim())
                return null;
            if (typeof parsed.spectatorName !== 'string' || !parsed.spectatorName.trim())
                return null;
            if (parsed.spectatorName.length > 24)
                return null;
            if (parsed.spectatorToken !== undefined &&
                (typeof parsed.spectatorToken !== 'string' ||
                    !parsed.spectatorToken.trim() ||
                    parsed.spectatorToken.length > 128))
                return null;
            return {
                type: 'join_session',
                sessionId: parsed.sessionId.trim(),
                spectatorName: parsed.spectatorName.trim(),
                ...(typeof parsed.spectatorToken === 'string'
                    ? { spectatorToken: parsed.spectatorToken.trim() }
                    : {}),
            };
        case 'leave_session':
            if (typeof parsed.sessionId !== 'string' || !parsed.sessionId.trim())
                return null;
            return { type: 'leave_session', sessionId: parsed.sessionId.trim() };
        case 'rename_spectator':
            if (typeof parsed.sessionId !== 'string' || !parsed.sessionId.trim())
                return null;
            if (typeof parsed.requestId !== 'string' || !parsed.requestId.trim() || parsed.requestId.length > 96)
                return null;
            if (typeof parsed.spectatorName !== 'string' || !parsed.spectatorName.trim() || parsed.spectatorName.length > 24)
                return null;
            return {
                type: 'rename_spectator',
                sessionId: parsed.sessionId.trim(),
                requestId: parsed.requestId.trim(),
                spectatorName: parsed.spectatorName.trim(),
            };
        case 'list_sessions':
            return { type: 'list_sessions' };
        case 'action':
            if (typeof parsed.sessionId !== 'string' || !parsed.sessionId.trim())
                return null;
            if (typeof parsed.requestId !== 'string' || !parsed.requestId.trim() || parsed.requestId.length > 96)
                return null;
            if (typeof parsed.action !== 'string' || !parsed.action.trim() || parsed.action.length > 64)
                return null;
            return {
                type: 'action',
                sessionId: parsed.sessionId.trim(),
                requestId: parsed.requestId.trim(),
                action: parsed.action.trim(),
                ...(typeof parsed.worldX === 'number' && typeof parsed.worldZ === 'number'
                    ? { worldX: parsed.worldX, worldZ: parsed.worldZ }
                    : {}),
            };
        case 'game_state':
            if (typeof parsed.playerX !== 'number' || typeof parsed.playerZ !== 'number')
                return null;
            return parsed;
        case 'finish_game':
            if (typeof parsed.playerDeaths !== 'number' || !Number.isFinite(parsed.playerDeaths))
                return null;
            return {
                type: 'finish_game',
                playerDeaths: Math.max(0, Math.floor(parsed.playerDeaths)),
            };
        case 'map_image':
            if (typeof parsed.data !== 'string' || parsed.data.length === 0)
                return null;
            if (parsed.data.length > 10000000)
                return null; // max ~7.5MB image
            return parsed;
        case 'map_tile':
            if (typeof parsed.path !== 'string' || !parsed.path.trim())
                return null;
            if (!/^[a-zA-Z0-9_./-]+$/.test(parsed.path) || parsed.path.includes('..'))
                return null;
            if (typeof parsed.data !== 'string' || parsed.data.length === 0)
                return null;
            if (parsed.data.length > 25000000)
                return null;
            return {
                type: 'map_tile',
                path: parsed.path.trim().replace(/^\/+/, ''),
                mimeType: typeof parsed.mimeType === 'string' ? parsed.mimeType : 'image/jpeg',
                data: parsed.data,
            };
        case 'map_tiles':
            if (!Array.isArray(parsed.lods))
                return null;
            return parsed;
        case 'map_objects':
            if (!Array.isArray(parsed.objects))
                return null;
            return parsed;
        case 'ability_manifest':
            if (!Array.isArray(parsed.abilities))
                return null;
            return parsed;
        case 'weapon_manifest':
            if (!Array.isArray(parsed.weapons))
                return null;
            return parsed;
        case 'route_layout':
            if (!Array.isArray(parsed.modules) || !Array.isArray(parsed.connections))
                return null;
            return parsed;
        case 'session_status':
            if (typeof parsed.phase !== 'string')
                return null;
            if (!VALID_SESSION_PHASES.includes(parsed.phase))
                return null;
            return {
                type: 'session_status',
                phase: parsed.phase,
                message: typeof parsed.message === 'string' ? parsed.message : undefined,
                routeReady: Boolean(parsed.routeReady),
            };
        case 'projectile_spawn':
            if (typeof parsed.id !== 'string' || !parsed.id)
                return null;
            return parsed;
        case 'projectile_destroy':
            if (typeof parsed.id !== 'string' || !parsed.id)
                return null;
            return parsed;
        case 'drop_spawn':
            if (typeof parsed.id !== 'string' || !parsed.id)
                return null;
            if (typeof parsed.dropType !== 'string')
                return null;
            return parsed;
        case 'drop_destroy':
            if (typeof parsed.id !== 'string' || !parsed.id)
                return null;
            return parsed;
        case 'damage_dealt':
            if (typeof parsed.spectatorName !== 'string' || !parsed.spectatorName)
                return null;
            if (typeof parsed.damage !== 'number' || parsed.damage < 0)
                return null;
            return parsed;
        default:
            return null;
    }
}
//# sourceMappingURL=validator.js.map