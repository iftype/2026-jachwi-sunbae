import type { NearbyPlace } from '../model/Map';
import type { MapMarker } from '../model/Map';
import { getMapCategoryLabel } from './mapPresentation';

type PlaceCluster = {
  latitude: number;
  longitude: number;
  places: NearbyPlace[];
};

const EARTH_METERS_PER_DEGREE = 111_320;

const clusterDistanceForLevel = (level: number): number => {
  if (level <= 3) return 0;
  if (level === 4) return 55;
  if (level === 5) return 110;
  if (level === 6) return 220;
  return 400 * 2 ** Math.max(0, level - 7);
};

const distanceMeters = (
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
): number => {
  const averageLatitude = ((left.latitude + right.latitude) * Math.PI) / 360;
  const latitudeMeters = (left.latitude - right.latitude) * EARTH_METERS_PER_DEGREE;
  const longitudeMeters = (left.longitude - right.longitude) * EARTH_METERS_PER_DEGREE * Math.cos(averageLatitude);
  return Math.hypot(latitudeMeters, longitudeMeters);
};

const addPlace = (cluster: PlaceCluster, place: NearbyPlace) => {
  const count = cluster.places.length;
  cluster.latitude = (cluster.latitude * count + place.latitude) / (count + 1);
  cluster.longitude = (cluster.longitude * count + place.longitude) / (count + 1);
  cluster.places.push(place);
};

const markerFromCluster = (cluster: PlaceCluster): MapMarker => {
  if (cluster.places.length === 1) {
    const [place] = cluster.places;
    return {
      id: `place-${place.providerPlaceId}`,
      latitude: place.latitude,
      longitude: place.longitude,
      label: place.name,
      tone: 'place',
      category: place.category,
      placeId: place.providerPlaceId,
      actionable: true,
    };
  }

  const categories = new Set(cluster.places.map((place) => place.category));
  const category = categories.size === 1 ? cluster.places[0].category : undefined;
  const label =
    category === undefined
      ? `${cluster.places.length}개 시설`
      : `${getMapCategoryLabel(category)} ${cluster.places.length}개`;
  return {
    id: `cluster-${cluster.places
      .map((place) => place.providerPlaceId)
      .sort()
      .join('-')}`,
    latitude: cluster.latitude,
    longitude: cluster.longitude,
    label,
    tone: 'cluster',
    category,
    count: cluster.places.length,
    actionable: true,
  };
};

export type PropertyPin = {
  propertyId: number;
  name: string;
  latitude: number;
  longitude: number;
  caption: string;
  photoUrl?: string;
};

type PropertyCluster = {
  latitude: number;
  longitude: number;
  pins: PropertyPin[];
};

const markerFromPropertyCluster = (cluster: PropertyCluster): MapMarker => {
  if (cluster.pins.length === 1) {
    const [pin] = cluster.pins;
    return {
      id: `property-${pin.propertyId}`,
      latitude: pin.latitude,
      longitude: pin.longitude,
      label: pin.name,
      caption: pin.caption,
      tone: 'property',
      photoUrl: pin.photoUrl,
      actionable: true,
    };
  }

  return {
    id: `property-cluster-${cluster.pins
      .map((pin) => pin.propertyId)
      .sort((left, right) => left - right)
      .join('-')}`,
    latitude: cluster.latitude,
    longitude: cluster.longitude,
    label: `매물 ${cluster.pins.length}개`,
    tone: 'propertyCluster',
    count: cluster.pins.length,
    photoUrl: cluster.pins.find((pin) => pin.photoUrl !== undefined)?.photoUrl,
    actionable: true,
  };
};

/** 겹쳐 보이는 매물 핀을 확대 단계별 반경으로 묶고, 묶이면 묶음 숫자를 보여 준다. */
export const clusterProperties = (pins: PropertyPin[], level: number): MapMarker[] => {
  const threshold = clusterDistanceForLevel(level);
  const clusters: PropertyCluster[] = [];

  [...pins]
    .sort((left, right) => left.propertyId - right.propertyId)
    .forEach((pin) => {
      const nearest =
        threshold === 0
          ? undefined
          : clusters
              .map((cluster) => ({ cluster, distance: distanceMeters(cluster, pin) }))
              .filter(({ distance }) => distance <= threshold)
              .sort((left, right) => left.distance - right.distance)[0]?.cluster;
      if (nearest === undefined) {
        clusters.push({ latitude: pin.latitude, longitude: pin.longitude, pins: [pin] });
        return;
      }
      const count = nearest.pins.length;
      nearest.latitude = (nearest.latitude * count + pin.latitude) / (count + 1);
      nearest.longitude = (nearest.longitude * count + pin.longitude) / (count + 1);
      nearest.pins.push(pin);
    });

  return clusters.map(markerFromPropertyCluster);
};

export const clusterNearbyPlaces = (places: NearbyPlace[], level: number): MapMarker[] => {
  const threshold = clusterDistanceForLevel(level);
  if (threshold === 0) {
    return places.map((place) =>
      markerFromCluster({ latitude: place.latitude, longitude: place.longitude, places: [place] }),
    );
  }
  const clusters: PlaceCluster[] = [];

  [...places]
    .sort(
      (left, right) =>
        left.distanceMeters - right.distanceMeters || left.providerPlaceId.localeCompare(right.providerPlaceId),
    )
    .forEach((place) => {
      const nearest = clusters
        .map((cluster) => ({ cluster, distance: distanceMeters(cluster, place) }))
        .filter(({ cluster, distance }) => cluster.places[0]?.category === place.category && distance <= threshold)
        .sort((left, right) => left.distance - right.distance)[0]?.cluster;
      if (nearest === undefined) {
        clusters.push({ latitude: place.latitude, longitude: place.longitude, places: [place] });
        return;
      }
      addPlace(nearest, place);
    });

  return clusters.map(markerFromCluster);
};
