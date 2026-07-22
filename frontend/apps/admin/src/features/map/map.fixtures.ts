// The artifacts' marker positions, lifted percentage for percentage from BOX 24 (desktop) and then
// projected onto a Hyderabad-area bounding box, so a running screen still matches its design
// tile's layout while every position is a real coordinate the OSM tile layer can carry.

import {
  ATTENTION_REASONS,
  JOB_MAP_STATES,
  PROVIDER_MAP_STATUSES,
  type MapCluster,
  type MapJob,
  type MapPoint,
  type MapProvider,
  type MapZone,
} from "./map.types";

/** The box BOX 24's 0–100 layout maps onto: greater Hyderabad, Kompally at the top edge. */
export const FIXTURE_GEO_BOUNDS = {
  north: 17.62,
  south: 17.26,
  west: 78.28,
  east: 78.62,
} as const;

/** Artifact percentages → WGS84. yPercent grows downward, latitude grows upward — hence north-. */
function geoPoint(xPercent: number, yPercent: number): MapPoint {
  return {
    latitude:
      FIXTURE_GEO_BOUNDS.north -
      (yPercent / 100) * (FIXTURE_GEO_BOUNDS.north - FIXTURE_GEO_BOUNDS.south),
    longitude:
      FIXTURE_GEO_BOUNDS.west +
      (xPercent / 100) * (FIXTURE_GEO_BOUNDS.east - FIXTURE_GEO_BOUNDS.west),
  };
}

export const ZONES = {
  kompally: "kompally",
  miyapur: "miyapur",
  gachibowli: "gachibowli",
  madhapur: "madhapur",
} as const;

export const MAP_ZONES: readonly MapZone[] = [
  { id: ZONES.kompally, name: "Kompally", labelAt: geoPoint(34, 9) },
  { id: ZONES.miyapur, name: "Miyapur", labelAt: geoPoint(16, 74) },
  { id: ZONES.gachibowli, name: "Gachibowli", labelAt: geoPoint(68, 39) },
  { id: ZONES.madhapur, name: "Madhapur", labelAt: geoPoint(78, 78) },
];

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/** The three Kompally providers BOX 25 removes, kept separate so both fixtures stay honest. */
export const KOMPALLY_PROVIDER_IDS = ["P-2041", "P-2042", "P-2103"] as const;

export const MAP_PROVIDERS: readonly MapProvider[] = [
  provider("P-2041", "Suresh Malla", "online", ZONES.kompally, 14, 30),
  provider("P-2042", "Anil Beeram", "online", ZONES.kompally, 32, 12),
  provider("P-2103", "Kiran Yadav", "busy", ZONES.kompally, 30, 33, "B-8811"),
  provider("P-2044", "Ramesh Naik", "online", ZONES.miyapur, 34, 46),
  provider("P-2045", "Venkat Rao", "online", ZONES.miyapur, 18, 58),
  provider("P-2046", "Farhan Ali", "online", ZONES.gachibowli, 47, 26),
  provider("P-2047", "Deepak Reddy", "online", ZONES.gachibowli, 58, 63),
  provider("P-2048", "Naveen Kumar", "online", ZONES.madhapur, 73, 34),
  provider("P-2049", "Sai Charan", "online", ZONES.madhapur, 66, 86),
  provider("P-2104", "Imran Shaikh", "busy", ZONES.miyapur, 52, 45, "B-8817"),
  provider("P-2105", "Prakash Rao", "busy", ZONES.gachibowli, 63, 21, "B-8802"),
  provider("P-2106", "Mahesh Goud", "busy", ZONES.miyapur, 43, 73, "B-8829"),
  provider("P-2107", "Ajay Varma", "busy", ZONES.madhapur, 80, 59, "B-8834"),
  // Offline pins sit at last-known position; their age is in the accessible name, never colour.
  offline("P-2205", "Rajesh Pillai", ZONES.kompally, 22, 40, 26),
  offline("P-2206", "Santosh Jha", ZONES.gachibowli, 62, 44, 51),
  offline("P-2207", "Bhaskar Rao", ZONES.madhapur, 88, 68, 14),
];

export const MAP_JOBS: readonly MapJob[] = [
  job("J-8823", "B-8823", "escalated", ZONES.kompally, 26, 23, "AC Repair"),
  job("J-8815", "B-8815", "enRoute", ZONES.kompally, 41, 18, "Plumbing"),
  job("J-8802", "B-8802", "enRoute", ZONES.gachibowli, 69, 51, "Electrical"),
  job("J-8829", "B-8829", "onSite", ZONES.miyapur, 25, 67, "Deep Cleaning"),
  job("J-8834", "B-8834", "onSite", ZONES.madhapur, 56, 85, "Carpentry"),
  job("J-8817", "B-8817", "delayed", ZONES.miyapur, 37, 57, "Plumbing"),
  job("J-8840", "B-8840", "delayed", ZONES.madhapur, 76, 71, "Appliance Repair"),
];

export const MAP_CLUSTERS: readonly MapCluster[] = [
  { id: "C-1", zoneId: ZONES.madhapur, position: geoPoint(86, 26), markerCount: 12 },
];

export const MAP_ATTENTION = [
  {
    id: "A-8823",
    bookingRef: "B-8823",
    reason: ATTENTION_REASONS.escalated,
    zoneId: ZONES.kompally,
    waitingSince: minutesAgo(12),
  },
  {
    id: "A-8830",
    bookingRef: "B-8830",
    reason: ATTENTION_REASONS.noProvider,
    zoneId: ZONES.miyapur,
    waitingSince: minutesAgo(5),
  },
] as const;

function provider(
  id: string,
  name: string,
  status: "online" | "busy",
  zoneId: string,
  xPercent: number,
  yPercent: number,
  onBookingRef?: string,
): MapProvider {
  return {
    id,
    name,
    status: PROVIDER_MAP_STATUSES[status],
    zoneId,
    position: geoPoint(xPercent, yPercent),
    locatedAt: minutesAgo(0),
    ...(onBookingRef ? { onBookingRef } : {}),
  };
}

function offline(
  id: string,
  name: string,
  zoneId: string,
  xPercent: number,
  yPercent: number,
  lastSeenMinutes: number,
): MapProvider {
  return {
    id,
    name,
    status: PROVIDER_MAP_STATUSES.offline,
    zoneId,
    position: geoPoint(xPercent, yPercent),
    locatedAt: minutesAgo(lastSeenMinutes),
  };
}

function job(
  id: string,
  bookingRef: string,
  state: keyof typeof JOB_MAP_STATES,
  zoneId: string,
  xPercent: number,
  yPercent: number,
  serviceName: string,
): MapJob {
  return {
    id,
    bookingRef,
    state: JOB_MAP_STATES[state],
    zoneId,
    position: geoPoint(xPercent, yPercent),
    serviceName,
  };
}
