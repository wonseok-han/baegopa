import { NextRequest, NextResponse } from "next/server";

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;

interface KakaoKeywordResult {
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
}

export async function GET(request: NextRequest) {
  if (!KAKAO_REST_API_KEY) {
    return NextResponse.json(
      { error: "API key not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: "검색어는 2글자 이상 입력해주세요" },
      { status: 400 }
    );
  }

  const page = searchParams.get("page") || "1";

  const params = new URLSearchParams({
    query: query.trim(),
    size: "15",
    page,
  });

  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?${params}`,
    {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
    }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "검색에 실패했습니다" },
      { status: res.status }
    );
  }

  const data = await res.json();
  const results = (data.documents as KakaoKeywordResult[]).map((d) => ({
    name: d.place_name,
    address: d.road_address_name || d.address_name,
    lat: parseFloat(d.y),
    lng: parseFloat(d.x),
  }));
  const hasMore = !data.meta.is_end;

  return NextResponse.json({ results, hasMore });
}
