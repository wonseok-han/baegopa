export const ALLOWED_RADII = [100, 300, 500, 1000] as const;

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface PlacesParams {
  lat: number;
  lng: number;
  radius: (typeof ALLOWED_RADII)[number];
}

export interface SearchParams {
  query: string;
  page: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const globalRateLimit = globalThis as typeof globalThis & {
  __baegopaRateLimits?: Map<string, RateLimitEntry>;
};

const rateLimits =
  globalRateLimit.__baegopaRateLimits ??
  (globalRateLimit.__baegopaRateLimits = new Map<string, RateLimitEntry>());

export function parsePlacesParams(
  searchParams: URLSearchParams
): ValidationResult<PlacesParams> {
  const rawLat = searchParams.get("lat");
  const rawLng = searchParams.get("lng");
  const lat = rawLat === null || rawLat.trim() === "" ? NaN : Number(rawLat);
  const lng = rawLng === null || rawLng.trim() === "" ? NaN : Number(rawLng);
  const radius = Number(searchParams.get("radius") ?? "1000");

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { ok: false, error: "올바른 위도를 입력해주세요" };
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { ok: false, error: "올바른 경도를 입력해주세요" };
  }
  if (
    !Number.isInteger(radius) ||
    !ALLOWED_RADII.includes(radius as PlacesParams["radius"])
  ) {
    return {
      ok: false,
      error: `반경은 ${ALLOWED_RADII.join(", ")}m 중 하나여야 합니다`,
    };
  }

  return {
    ok: true,
    value: { lat, lng, radius: radius as PlacesParams["radius"] },
  };
}

export function parseSearchParams(
  searchParams: URLSearchParams
): ValidationResult<SearchParams> {
  const query = (searchParams.get("query") ?? "").trim();
  const rawPage = searchParams.get("page") ?? "1";

  if (query.length < 2 || query.length > 80) {
    return {
      ok: false,
      error: "검색어는 2자 이상 80자 이하로 입력해주세요",
    };
  }
  if (!/^\d+$/.test(rawPage)) {
    return { ok: false, error: "올바른 페이지를 입력해주세요" };
  }

  const page = Number(rawPage);
  if (!Number.isInteger(page) || page < 1 || page > 45) {
    return { ok: false, error: "검색 페이지는 1부터 45까지 가능합니다" };
  }

  return { ok: true, value: { query, page } };
}

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): RateLimitResult {
  const current = rateLimits.get(key);
  const entry =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;

  entry.count += 1;
  rateLimits.set(key, entry);

  if (rateLimits.size > 2000) {
    for (const [storedKey, storedEntry] of rateLimits) {
      if (storedEntry.resetAt <= now) rateLimits.delete(storedKey);
    }
  }

  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

export function getClientIdentifier(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
