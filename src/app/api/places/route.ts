import { NextRequest, NextResponse } from "next/server";

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;

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

  const params = new URLSearchParams({
    category_group_code: "FD6",
    x: lng,
    y: lat,
    radius,
    size: "15",
    sort: "distance",
  });

  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/category.json?${params}`,
    {
      headers: {
        Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
      },
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Kakao API error:", errorText);
    return NextResponse.json(
      { error: "음식점 검색에 실패했습니다" },
      { status: 502 }
    );
  }

  const data = await res.json();

  const restaurants = (data.documents || []).map(
    (place: {
      id: string;
      place_name: string;
      category_name: string;
      road_address_name: string;
      address_name: string;
      distance: string;
      x: string;
      y: string;
      place_url: string;
    }) => ({
      placeId: place.id,
      name: place.place_name,
      category: extractCategory(place.category_name),
      distance: parseInt(place.distance) || 0,
      address: place.road_address_name || place.address_name,
      location: {
        lat: parseFloat(place.y),
        lng: parseFloat(place.x),
      },
      placeUrl: place.place_url,
    })
  );

  return NextResponse.json({ restaurants, total: restaurants.length });
}

function extractCategory(categoryName: string): string {
  const parts = categoryName.split(" > ");
  return parts[parts.length - 1] || "음식점";
}
