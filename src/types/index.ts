export interface Restaurant {
  placeId: string;
  name: string;
  category: string;
  distance: number;
  address: string;
  location: { lat: number; lng: number };
  placeUrl?: string;
}

export interface GameProps {
  candidates: Restaurant[];
  onResult: (selected: Restaurant) => void;
}
