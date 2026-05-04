export interface Restaurant {
  placeId: string;
  name: string;
  category: string;
  distance: number;
  rating?: number;
  address: string;
  location: { lat: number; lng: number };
  photoUrl?: string;
}

export interface GameProps {
  candidates: Restaurant[];
  onResult: (selected: Restaurant) => void;
}

export interface GameMeta {
  id: string;
  name: string;
  description: string;
  icon: string;
  component: React.ComponentType<GameProps>;
}
