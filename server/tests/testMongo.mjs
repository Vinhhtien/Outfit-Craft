import { mkdir, mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Keep disposable databases on the project drive instead of a potentially full system drive.
export async function createTestMongo() {
  const root = fileURLToPath(new URL('../node_modules/.cache/outfitcraft-tests/', import.meta.url));
  await mkdir(root, { recursive: true });
  const dbPath = await mkdtemp(join(root, 'mongo-'));
  return MongoMemoryServer.create({ instance: { dbPath } });
}
export async function stopTestMongo(mongo) {
  // dbPath was created by this helper inside the project's ignored dependency cache.
  if (mongo) await mongo.stop({ doCleanup: true, force: true });
}
