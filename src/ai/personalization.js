import { getRedis } from '../lib/redis-factory.js';

const redis = getRedis();

export async function setFavoriteTeams(userId, teams = []) {
  try {
    if (!userId) return false;
    const key = `user:${userId}:prefs`;
    await redis.hSet(key, { favoriteTeams: JSON.stringify(teams) });
    return true;
  } catch (e) {
    console.warn('personalization.setFavoriteTeams failed', e?.message || e);
    return false;
  }
}

export async function getFavoriteTeams(userId) {
  try {
    if (!userId) return [];
    const key = `user:${userId}:prefs`;
    const raw = await redis.hGet(key, 'favoriteTeams');
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.warn('personalization.getFavoriteTeams failed', e?.message || e);
    return [];
  }
}

export default { setFavoriteTeams, getFavoriteTeams };
