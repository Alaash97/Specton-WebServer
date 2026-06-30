import dotenv from 'dotenv';
import { createServer } from './server';

dotenv.config();

const port = parseInt(process.env.PORT || '8080', 10);
const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '300', 10);
const heartbeatIntervalMs = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '30000', 10);

createServer(port, rateLimitWindowMs, heartbeatIntervalMs);
