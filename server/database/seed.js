import './sqlite.js';
import { sqlite } from './sqlite.js';

console.log(`SQLite initialized at server/database/kaamconnect.sqlite (${sqlite.prepare('SELECT COUNT(*) AS count FROM services').get().count} services).`);
