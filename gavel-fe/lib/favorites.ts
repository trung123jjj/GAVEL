import { ApiError, api } from "@/lib/api";

const STORAGE_KEY = 'gavel_favorites';
const OWNER_KEY = 'gavel_favorites_user';

export class LoginRequiredError extends Error {
  constructor() {
    super("Vui lòng đăng nhập để sử dụng danh sách theo dõi.");
    this.name = "LoginRequiredError";
  }
}

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

export async function syncFavorites(options: { promptOnUnauthorized?: boolean } = {}): Promise<string[]> {
  const userId = getCachedUserId();
  const previousOwner = localStorage.getItem(OWNER_KEY);
  let localFavorites = getFavorites();
  if (previousOwner && userId && previousOwner !== userId) {
    localFavorites = [];
    storeFavorites(localFavorites);
  }

  let auctionIds: number[];
  try {
    ({ auctionIds } = await api.syncWatchlist(localFavorites, options.promptOnUnauthorized));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw new LoginRequiredError();
    throw error;
  }
  const favorites = auctionIds.map(String);
  storeFavorites(favorites);
  if (userId) localStorage.setItem(OWNER_KEY, userId);
  return favorites;
}

export async function updateFavorite(id: string | number, isFavorite: boolean): Promise<void> {
  const favoriteId = String(id);
  try {
    if (isFavorite) {
      await api.addWatchlistItem(favoriteId);
    } else {
      await api.removeWatchlistItem(favoriteId);
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw new LoginRequiredError();
    throw error;
  }

  const favorites = getFavorites().filter((item) => item !== favoriteId);
  if (isFavorite) favorites.push(favoriteId);
  storeFavorites(favorites);
  const userId = getCachedUserId();
  if (userId) localStorage.setItem(OWNER_KEY, userId);
}

export function isFavorite(id: string | number): boolean {
  return getFavorites().includes(String(id));
}
