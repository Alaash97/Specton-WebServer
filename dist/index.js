"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const server_1 = require("./server");
dotenv_1.default.config();
const port = parseInt(process.env.PORT || '8080', 10);
const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '300', 10);
const heartbeatIntervalMs = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '30000', 10);
(0, server_1.createServer)(port, rateLimitWindowMs, heartbeatIntervalMs);
//# sourceMappingURL=index.js.map