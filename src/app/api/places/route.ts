import { NextRequest, NextResponse } from "next/server";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

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

  if (!GOOGLE_PLACES_API_KEY) {
    return NextResponse.json(
      { error: "API key가 설정되지 않았습니다" },
      { status: 500 }
    );
  }

  const body = {
    includedTypes: ["restaurant", "cafe", "meal_takeaway"],
    locationRestriction: {
      circle: {
        center: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
        radius: parseFloat(radius),
      },
    },
    maxResultCount: 20,
    languageCode: "ko",
  };

  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.primaryType,places.shortFormattedAddress,places.location,places.rating,places.photos",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Google Places API error:", errorText);
    return NextResponse.json(
      { error: "음식점 검색에 실패했습니다" },
      { status: 502 }
    );
  }

  const data = await res.json();
  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);

  const restaurants = (data.places || []).map(
    (place: {
      id: string;
      displayName?: { text: string };
      primaryType?: string;
      shortFormattedAddress?: string;
      location?: { latitude: number; longitude: number };
      rating?: number;
      photos?: { name: string }[];
    }) => ({
      placeId: place.id,
      name: place.displayName?.text || "이름 없음",
      category: mapCategory(place.primaryType),
      distance: calculateDistance(
        userLat,
        userLng,
        place.location?.latitude || 0,
        place.location?.longitude || 0
      ),
      rating: place.rating,
      address: place.shortFormattedAddress || "",
      location: {
        lat: place.location?.latitude || 0,
        lng: place.location?.longitude || 0,
      },
      photoUrl: place.photos?.[0]
        ? `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxHeightPx=200&key=${GOOGLE_PLACES_API_KEY}`
        : undefined,
    })
  );

  return NextResponse.json({ restaurants, total: restaurants.length });
}

function mapCategory(type?: string): string {
  const map: Record<string, string> = {
    restaurant: "음식점",
    cafe: "카페",
    meal_takeaway: "포장",
    korean_restaurant: "한식",
    japanese_restaurant: "일식",
    chinese_restaurant: "중식",
    italian_restaurant: "양식",
  };
  return map[type || ""] || "음식점";
}

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
