/** Result query parameters are untrusted, even when the API originally supplied them. */
export function getSafeKakaoPlaceUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      !["place.map.kakao.com", "map.kakao.com"].includes(url.hostname) ||
      url.username || url.password || url.port
    ) return null;
    return url.href;
  } catch {
    return null;
  }
}
