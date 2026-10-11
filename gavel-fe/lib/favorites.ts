import { ApiError, api } from "@/lib/api";

const STORAGE_KEY = 'gavel_favorites';
const OWNER_KEY = 'gavel_favorites_user';

export function getFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((id): id is string | number => typeof id === 'string' || typeof id === 'number').map(String))]
      : [];
  } catch {
    return [];
  }
}

function storeFavorites(favorites: string[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(favorites)]));
  }
}

function getCachedUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    const user = JSON.parse(stored) as { id?: string | number };
    return user.id === undefined ? null : String(user.id);
  } catch {
    return null;
  }
}

export async function syncFavorites(): Promise<string[]> {
  let userId = getCachedUserId();
  if (!userId) {
    try {
      const { user } = await api.me();
      userId = String(user.id);
      localStorage.setItem('user', JSON.stringify(user));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return getFavorites();
      throw error;
    }
  }

  const previousOwner = localStorage.getItem(OWNER_KEY);
  let localFavorites = getFavorites();
  if (previousOwner && previousOwner !== userId) {
    localFavorites = [];
    storeFavorites(localFavorites);
  }

  const { auctionIds } = await api.syncWatchlist(localFavorites);
  const favorites = auctionIds.map(String);
  storeFavorites(favorites);
  localStorage.setItem(OWNER_KEY, userId);
  return favorites;
}

export async function updateFavorite(id: string | number, isFavorite: boolean): Promise<void> {
  const favoriteId = String(id);
  const favorites = getFavorites().filter((item) => item !== favoriteId);
  if (isFavorite) favorites.push(favoriteId);
  storeFavorites(favorites);

  const userId = getCachedUserId();
  if (!userId) return;
  localStorage.setItem(OWNER_KEY, userId);
  if (isFavorite) {
    await api.addWatchlistItem(favoriteId);
  } else {
    await api.removeWatchlistItem(favoriteId);
  }
}

export function isFavorite(id: string | number): boolean {
  return getFavorites().includes(String(id));
}
