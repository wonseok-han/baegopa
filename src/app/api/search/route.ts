import { NextRequest, NextResponse } from "next/server";
import {
  consumeRateLimit,
  getClientIdentifier,
  parseSearchParams,
} from "@/lib/api-guard";

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const RATE_LIMIT = 45;
const RATE_WINDOW_MS = 60_000;
const UPSTREAM_TIMEOUT_MS = 7_000;

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

  const parsed = parseSearchParams(request.nextUrl.searchParams);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error },
      { status: 400 }
    );
  }

  const clientId = getClientIdentifier(request.headers);
  const rateLimit = consumeRateLimit(
    `search:${clientId}`,
    RATE_LIMIT,
    RATE_WINDOW_MS
  );
  const rateHeaders = {
    "X-RateLimit-Limit": String(RATE_LIMIT),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
  };

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "검색 요청이 너무 많습니다. 잠시 후 다시 시도해주세요" },
      {
        status: 429,
        headers: {
          ...rateHeaders,
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      }
    );
  }

  const { query, page } = parsed.value;

  const params = new URLSearchParams({
    query,
    size: "15",
    page: String(page),
  });

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?${params}`,
      {
        headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "검색에 실패했습니다" },
        { status: 502, headers: rateHeaders }
      );
    }

    const data = await res.json();
    const results = (data.documents as KakaoKeywordResult[]).map((d) => ({
      name: d.place_name,
      address: d.road_address_name || d.address_name,
      lat: Number(d.y),
      lng: Number(d.x),
    }));
    const hasMore = !data.meta.is_end;

    return NextResponse.json(
      { results, hasMore },
      {
        headers: {
          ...rateHeaders,
          "Cache-Control": "private, max-age=30",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: "검색 서비스 응답이 지연되고 있습니다" },
      { status: 504, headers: rateHeaders }
    );
  }
}
