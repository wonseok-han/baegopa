import { NextRequest, NextResponse } from "next/server";

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;

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
      }
    );

    if (!res.ok) break;

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

  return [
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
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const radius = searchParams.get("radius") || "1000";

  if (!lat || !lng) {
    return NextResponse.json(
      { error: "lat, lng 파라미터가 필요합니다" },
      { status: 400 }
    );
  }

  if (!KAKAO_REST_API_KEY) {
    return NextResponse.json(
      { error: "API key가 설정되지 않았습니다" },
      { status: 500 }
    );
  }

  const centerLat = parseFloat(lat);
  const centerLng = parseFloat(lng);
  const radiusM = parseInt(radius);

  const gridPoints = getGridPoints(centerLat, centerLng, radiusM);
  const subRadius = String(Math.ceil(radiusM * 0.6));

  const results = await Promise.all(
    gridPoints.map((point) =>
      fetchPages(String(point.lng), String(point.lat), subRadius)
    )
  );

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
        distance: Math.round(dist),
        address: place.road_address_name || place.address_name,
        location: { lat: placeLat, lng: placeLng },
        placeUrl: place.place_url,
      };
    })
    .filter((r) => r.distance <= radiusM)
    .sort((a, b) => a.distance - b.distance);

  return NextResponse.json({ restaurants, total: restaurants.length });
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
