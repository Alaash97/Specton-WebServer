export declare const SPECTATOR_ACTIONS: readonly ["missile", "enemy", "meteor_shower", "low_gravity", "invert_controls", "shield"];
export type SpectatorAction = string;
export type SessionBootPhase = 'booting' | 'generating' | 'capturing' | 'publishing' | 'baking_navmesh' | 'ready' | 'failed' | 'error';
export interface CreateSessionMessage {
    type: 'create_session';
    playerName: string;
    level: string;
}
export interface JoinSessionMessage {
    type: 'join_session';
    sessionId: string;
    spectatorName: string;
    spectatorToken?: string;
}
export interface LeaveSessionMessage {
    type: 'leave_session';
    sessionId: string;
}
export interface RenameSpectatorMessage {
    type: 'rename_spectator';
    sessionId: string;
    requestId: string;
    spectatorName: string;
}
export interface ListSessionsMessage {
    type: 'list_sessions';
}
export interface ActionMessage {
    type: 'action';
    sessionId: string;
    requestId: string;
    action: SpectatorAction;
    worldX?: number;
    worldZ?: number;
}
export type ActionRejectReason = 'group_limited' | 'personal_cooldown' | 'manifest_not_ready' | 'unknown_action' | 'missing_profile' | 'invalid_target' | 'rate_limited' | 'game_finished';
export interface ActionResultMessage {
    type: 'action_result';
    requestId: string;
    action: SpectatorAction;
    accepted: boolean;
    reason?: ActionRejectReason;
    retryAfterMs?: number;
    personalCooldownMs?: number;
}
export interface AbilityLimitGroupState {
    groupId: string;
    label: string;
    category: string;
    capacity: number;
    availableTokens: number;
    refillMs: number;
    updatedAt: number;
}
export interface AbilityLimitStateMessage {
    type: 'ability_limit_state';
    groups: AbilityLimitGroupState[];
    personalCooldowns?: Record<string, number>;
}
export interface GameStateMessage {
    type: 'game_state';
    playerSpriteId: string;
    playerX: number;
    playerY: number;
    playerZ: number;
    playerRotY: number;
    playerHP: number;
    playerMaxHP: number;
    playerDeaths?: number;
    enemies: Array<{
        id: string;
        spriteId: string;
        x: number;
        y: number;
        z: number;
        rotY: number;
        hp: number;
        maxHp: number;
    }>;
    mapMinX: number;
    mapMaxX: number;
    mapMinZ: number;
    mapMaxZ: number;
}
export interface MapImageMessage {
    type: 'map_image';
    data: string;
    mimeType?: string;
    mapMinX: number;
    mapMaxX: number;
    mapMinZ: number;
    mapMaxZ: number;
}
export interface MapTilesMessage {
    type: 'map_tiles';
    baseUrl: string;
    tileSize: number;
    mapMinX: number;
    mapMaxX: number;
    mapMinZ: number;
    mapMaxZ: number;
    lods: Array<{
        level: number;
        width: number;
        height: number;
        tilesX: number;
        tilesY: number;
        path: string;
    }>;
}
export interface MapTileMessage {
    type: 'map_tile';
    path: string;
    mimeType?: string;
    data: string;
}
export interface MapObjectData {
    id: string;
    x: number;
    y?: number;
    z: number;
    spriteId: string;
    spectatorMotionEnabled?: boolean;
    motionType?: 'None' | 'Rotate' | string;
    initialRotationDeg?: number;
    angularSpeedDegPerSecond?: number;
    clockwise?: boolean;
    allowFlatSpriteRotationFallback?: boolean;
}
export interface MapSpriteData {
    spriteId: string;
    orthoSize: number;
    pivotToCenterX: number;
    pivotToCenterY: number;
    pivotToCenterZ: number;
}
export interface MapObjectsMessage {
    type: 'map_objects';
    objects: MapObjectData[];
    sprites: MapSpriteData[];
}
export interface AbilityManifestMessage {
    type: 'ability_manifest';
    abilities: object[];
}
export interface WeaponManifestMessage {
    type: 'weapon_manifest';
    weapons: object[];
}
export interface RouteLayoutModuleData {
    id: string;
    moduleId: string;
    x: number;
    z: number;
    width: number;
    depth: number;
    rotationQuarterTurns: number;
}
export interface RouteLayoutConnectionData {
    fromX: number;
    fromZ: number;
    toX: number;
    toZ: number;
}
export interface RouteLayoutMessage {
    type: 'route_layout';
    seed: number;
    cellSize: number;
    mapMinX: number;
    mapMaxX: number;
    mapMinZ: number;
    mapMaxZ: number;
    modules: RouteLayoutModuleData[];
    connections: RouteLayoutConnectionData[];
}
export interface PlayerSessionStatusMessage {
    type: 'session_status';
    phase: SessionBootPhase;
    message?: string;
    routeReady: boolean;
}
export interface ProjectileSpawnMessage {
    type: 'projectile_spawn';
    id: string;
    x: number;
    y: number;
    z: number;
    velX: number;
    velY: number;
    velZ: number;
    color: string;
    radius: number;
}
export interface ProjectileDestroyMessage {
    type: 'projectile_destroy';
    id: string;
    x?: number;
    y?: number;
    z?: number;
}
export interface DropSpawnMessage {
    type: 'drop_spawn';
    id: string;
    dropType: string;
    spriteId?: string;
    x: number;
    y: number;
    z: number;
}
export interface DropDestroyMessage {
    type: 'drop_destroy';
    id: string;
}
export interface DamageDealtMessage {
    type: 'damage_dealt';
    spectatorName: string;
    damage: number;
}
export interface FinishGameMessage {
    type: 'finish_game';
    playerDeaths: number;
}
export type ClientMessage = CreateSessionMessage | JoinSessionMessage | LeaveSessionMessage | RenameSpectatorMessage | ListSessionsMessage | ActionMessage | GameStateMessage | MapImageMessage | MapTileMessage | MapTilesMessage | MapObjectsMessage | AbilityManifestMessage | WeaponManifestMessage | RouteLayoutMessage | PlayerSessionStatusMessage | ProjectileSpawnMessage | ProjectileDestroyMessage | DropSpawnMessage | DropDestroyMessage | DamageDealtMessage | FinishGameMessage;
export interface SessionCreatedMessage {
    type: 'session_created';
    sessionId: string;
}
export interface SessionJoinedMessage {
    type: 'session_joined';
    sessionId: string;
    spectatorCount: number;
    bootPhase: SessionBootPhase;
    bootMessage: string;
    routeReady: boolean;
}
export interface SessionListEntry {
    sessionId: string;
    playerName: string;
    level: string;
    spectatorCount: number;
    bootPhase: SessionBootPhase;
    bootMessage: string;
    routeReady: boolean;
}
export interface SessionListMessage {
    type: 'session_list';
    sessions: SessionListEntry[];
}
export interface GameEventMessage {
    type: 'event';
    action: SpectatorAction;
    worldX: number;
    worldZ: number;
    targeted: boolean;
    spectatorName?: string;
}
export interface SpectatorCountMessage {
    type: 'spectator_count';
    count: number;
}
export interface SpectatorEntry {
    spectatorId: string;
    spectatorName: string;
}
export interface SpectatorListMessage {
    type: 'spectator_list';
    spectators: SpectatorEntry[];
}
export interface ErrorMessage {
    type: 'error';
    message: string;
}
export interface SpectatorRenameResultMessage {
    type: 'spectator_rename_result';
    requestId: string;
    accepted: boolean;
    spectatorName?: string;
    error?: string;
}
export interface SessionEndedMessage {
    type: 'session_ended';
    sessionId: string;
}
export interface GameFinishedLeaderboardEntry {
    rank: number;
    spectatorName: string;
    damage: number;
}
export interface GameFinishedMessage {
    type: 'game_finished';
    sessionId: string;
    winnerName: string;
    level: string;
    finishedAt: number;
    durationMs: number;
    playerDeaths: number;
    totalSpectatorDamage: number;
    leaderboard: GameFinishedLeaderboardEntry[];
}
export interface SessionStatusMessage {
    type: 'session_status';
    sessionId: string;
    bootPhase: SessionBootPhase;
    bootMessage: string;
    routeReady: boolean;
}
export type ServerMessage = SessionCreatedMessage | SessionJoinedMessage | SessionListMessage | SessionStatusMessage | GameEventMessage | SpectatorCountMessage | SpectatorListMessage | SpectatorRenameResultMessage | ErrorMessage | SessionEndedMessage | GameFinishedMessage | GameStateMessage | RouteLayoutMessage | ProjectileSpawnMessage | ProjectileDestroyMessage | MapObjectsMessage;
//# sourceMappingURL=messages.d.ts.map