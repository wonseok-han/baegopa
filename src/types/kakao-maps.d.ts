declare namespace kakao.maps {
  class LatLng {
    constructor(lat: number, lng: number);
    getLat(): number;
    getLng(): number;
  }

  class Map {
    constructor(container: HTMLElement, options: MapOptions);
    setCenter(latlng: LatLng): void;
    setLevel(level: number): void;
    getLevel(): number;
  }

  interface MapOptions {
    center: LatLng;
    level?: number;
  }

  class Marker {
    constructor(options: MarkerOptions);
    setMap(map: Map | null): void;
  }

  interface MarkerOptions {
    map?: Map;
    position: LatLng;
    title?: string;
  }

  class Circle {
    constructor(options: CircleOptions);
    setMap(map: Map | null): void;
  }

  interface CircleOptions {
    center: LatLng;
    radius: number;
    strokeWeight?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    fillColor?: string;
    fillOpacity?: number;
  }

  function load(callback: () => void): void;
}

interface Window {
  kakao: {
    maps: typeof kakao.maps & {
      load: (callback: () => void) => void;
    };
  };
}
