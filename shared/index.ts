// Shared exports - Types et DB partagés entre worker et web
export * from './types.js';
export { getDb, closeDb, getDbPath } from './db.js';
