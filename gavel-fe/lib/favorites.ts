const STORAGE_KEY = 'gavel_favorites';

export function getFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(id: string | number): boolean {
  const favId = String(id);
  const favorites = getFavorites();
  const idx = favorites.indexOf(favId);
  if (idx === -1) {
    favorites.push(favId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    return true;
  } else {
    favorites.splice(idx, 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    return false;
  }
}

export function isFavorite(id: string | number): boolean {
  return getFavorites().includes(String(id));
}
