import { NextRequest, NextResponse } from "next/server";
import {
  consumeRateLimit,
  getClientIdentifier,
  parsePlacesParams,
} from "@/lib/api-guard";

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const RATE_LIMIT = 12;
const RATE_WINDOW_MS = 60_000;
const UPSTREAM_TIMEOUT_MS = 7_000;

interface KakaoPlace {
  id: string;
  place_name: string;
  category_name: string;
  road_address_name: string;
  address_name: string;
  distance: string;
  x: string;
  y: string;
  place_url: string;
}

async function fetchPages(centerLng: string, centerLat: string, radius: string) {
  const documents: KakaoPlace[] = [];

  for (let page = 1; page <= 3; page++) {
    const params = new URLSearchParams({
      category_group_code: "FD6",
      x: centerLng,
      y: centerLat,
      radius,
      size: "15",
      sort: "distance",
      page: String(page),
    });

    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/category.json?${params}`,
      {
        headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      }
    );

    if (!res.ok) {
      throw new Error(`Kakao category API returned ${res.status}`);
    }

    const data = await res.json();
    documents.push(...(data.documents || []));
    if (data.meta?.is_end) break;
  }

  return documents;
}

function getGridPoints(lat: number, lng: number, radiusM: number) {
  const offset = radiusM * 0.5;
  const latOffset = offset / 111320;
  const lngOffset = offset / (111320 * Math.cos((lat * Math.PI) / 180));

  const points = [
    { lat, lng },
    { lat: lat + latOffset, lng },
    { lat: lat - latOffset, lng },
    { lat, lng: lng + lngOffset },
    { lat, lng: lng - lngOffset },
    { lat: lat + latOffset, lng: lng + lngOffset },
    { lat: lat + latOffset, lng: lng - lngOffset },
    { lat: lat - latOffset, lng: lng + lngOffset },
    { lat: lat - latOffset, lng: lng - lngOffset },
  ];

  if (radiusM <= 300) return points.slice(0, 1);
  if (radiusM <= 500) return points.slice(0, 5);
  return points;
}

export async function GET(request: NextRequest) {
  const parsed = parsePlacesParams(request.nextUrl.searchParams);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error },
      { status: 400 }
    );
  }

  if (!KAKAO_REST_API_KEY) {
    return NextResponse.json(
      { error: "API key가 설정되지 않았습니다" },
      { status: 500 }
    );
  }

  const clientId = getClientIdentifier(request.headers);
  const rateLimit = consumeRateLimit(
    `places:${clientId}`,
    RATE_LIMIT,
    RATE_WINDOW_MS
  );
  const rateHeaders = {
    "X-RateLimit-Limit": String(RATE_LIMIT),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
  };

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요" },
      {
        status: 429,
        headers: {
          ...rateHeaders,
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      }
    );
  }

  const { lat: centerLat, lng: centerLng, radius: radiusM } = parsed.value;

  const gridPoints = getGridPoints(centerLat, centerLng, radiusM);
  const subRadius = String(
    radiusM <= 300 ? radiusM : Math.ceil(radiusM * 0.6)
  );

  const settled = await Promise.allSettled(
    gridPoints.map((point) =>
      fetchPages(String(point.lng), String(point.lat), subRadius)
    )
  );
  const results = settled
    .filter(
      (result): result is PromiseFulfilledResult<KakaoPlace[]> =>
        result.status === "fulfilled"
    )
    .map((result) => result.value);

  if (results.length === 0) {
    return NextResponse.json(
      { error: "음식점 검색 서비스에 일시적인 문제가 발생했습니다" },
      { status: 502, headers: rateHeaders }
    );
  }

  const seen = new Set<string>();
  const allDocuments: KakaoPlace[] = [];

  for (const docs of results) {
    for (const doc of docs) {
      if (!seen.has(doc.id)) {
        seen.add(doc.id);
        allDocuments.push(doc);
      }
    }
  }

  const restaurants = allDocuments
    .map((place) => {
      const placeLat = parseFloat(place.y);
      const placeLng = parseFloat(place.x);
      const dist = haversine(centerLat, centerLng, placeLat, placeLng);
      return {
        placeId: place.id,
        name: place.place_name,
        category: extractCategory(place.category_name),
        categoryPath: place.category_name,
        distance: Math.round(dist),
        address: place.road_address_name || place.address_name,
        location: { lat: placeLat, lng: placeLng },
        placeUrl: place.place_url,
      };
    })
    .filter((r) => r.distance <= radiusM)
    .sort((a, b) => a.distance - b.distance);

  return NextResponse.json(
    { restaurants, total: restaurants.length },
    {
      headers: {
        ...rateHeaders,
        "Cache-Control": "private, max-age=60, stale-while-revalidate=60",
      },
    }
  );
}

function extractCategory(categoryName: string): string {
  const parts = categoryName.split(" > ");
  return parts[parts.length - 1] || "음식점";
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
