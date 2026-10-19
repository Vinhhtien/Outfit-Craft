import { User } from '../models/User.js';
import { env } from '../config/env.js';

export const DEMO_ADMIN_EMAIL = 'admin@outfitcraft.local';
export const DEMO_ADMIN_PASSWORD = 'OutfitCraft@123';

/** Development demo only. Existing accounts, passwords and locks are never overwritten. */
export async function seedDemoAdmin(options = { nodeEnv: env.nodeEnv, enabled: env.seedDemoAdmin }) {
  if (options.nodeEnv !== 'development' || !options.enabled) return { status: 'disabled' as const };
  const existing = await User.findOne({ email: DEMO_ADMIN_EMAIL });
  if (existing) return { status: 'exists' as const, usable: existing.role === 'admin' && existing.isActive && existing.isVerified };
  try {
    await User.create({
      email: DEMO_ADMIN_EMAIL, password: DEMO_ADMIN_PASSWORD, displayName: 'Admin OutfitCraft',
      role: 'admin', isActive: true, isVerified: true, defaultCity: 'Hanoi',
    });
    return { status: 'created' as const };
  } catch (error) {
    // Multiple development servers may start together; the unique email index is authoritative.
    if ((error as { code?: number }).code === 11000) return { status: 'exists' as const };
    throw error;
  }
}
