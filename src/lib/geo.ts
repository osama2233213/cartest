/**
 * Rough distances for the "Distance" filter. Listings only carry a city and state, so a car is placed at its city
 * when we know it and at the middle of its state when we don't. Good enough to sort cars into 25 / 50 / 100 mile bands.
 */
export type Point = { lat: number; lon: number };

const CITY_TABLE: Record<string, [number, number]> = {
  "Phoenix, AZ": [33.4484, -112.074],
  "Scottsdale, AZ": [33.4942, -111.9261],
  "Tempe, AZ": [33.4255, -111.94],
  "Mesa, AZ": [33.4152, -111.8315],
  "Tucson, AZ": [32.2226, -110.9747],
  "Flagstaff, AZ": [35.1983, -111.6513],
  "Austin, TX": [30.2672, -97.7431],
  "Houston, TX": [29.7604, -95.3698],
  "Dallas, TX": [32.7767, -96.797],
  "San Antonio, TX": [29.4241, -98.4936],
  "Miami, FL": [25.7617, -80.1918],
  "Orlando, FL": [28.5383, -81.3792],
  "Tampa, FL": [27.9506, -82.4572],
  "Jacksonville, FL": [30.3322, -81.6557],
  "San Diego, CA": [32.7157, -117.1611],
  "Los Angeles, CA": [34.0522, -118.2437],
  "San Francisco, CA": [37.7749, -122.4194],
  "Sacramento, CA": [38.5816, -121.4944],
  "Las Vegas, NV": [36.1699, -115.1398],
  "Denver, CO": [39.7392, -104.9903],
  "Albuquerque, NM": [35.0844, -106.6504],
  "Salt Lake City, UT": [40.7608, -111.891],
  "Seattle, WA": [47.6062, -122.3321],
  "Portland, OR": [45.5152, -122.6784],
  "Chicago, IL": [41.8781, -87.6298],
  "Detroit, MI": [42.3314, -83.0458],
  "Minneapolis, MN": [44.9778, -93.265],
  "Atlanta, GA": [33.749, -84.388],
  "Charlotte, NC": [35.2271, -80.8431],
  "Nashville, TN": [36.1627, -86.7816],
  "New York, NY": [40.7128, -74.006],
  "Buffalo, NY": [42.8864, -78.8784],
  "Albany, NY": [42.6526, -73.7562],
  "Boston, MA": [42.3601, -71.0589],
  "Philadelphia, PA": [39.9526, -75.1652],
  "Washington, DC": [38.9072, -77.0369],
};

const STATE_CENTRE: Record<string, [number, number]> = {
  AL: [32.8, -86.8], AK: [64.2, -149.5], AZ: [34.2, -111.7], AR: [34.9, -92.4], CA: [37.2, -119.7], CO: [39.0, -105.5],
  CT: [41.6, -72.7], DE: [39.0, -75.5], DC: [38.9, -77.0], FL: [28.6, -82.4], GA: [32.7, -83.4], HI: [20.8, -156.3],
  ID: [44.4, -114.6], IL: [40.0, -89.2], IN: [39.9, -86.3], IA: [42.1, -93.5], KS: [38.5, -98.4], KY: [37.5, -85.3],
  LA: [31.1, -92.0], ME: [45.3, -69.2], MD: [39.0, -76.8], MA: [42.3, -71.8], MI: [44.3, -85.4], MN: [46.3, -94.3],
  MS: [32.7, -89.7], MO: [38.4, -92.5], MT: [47.0, -109.6], NE: [41.5, -99.8], NV: [39.3, -116.6], NH: [43.7, -71.6],
  NJ: [40.2, -74.7], NM: [34.4, -106.1], NY: [42.9, -75.5], NC: [35.6, -79.4], ND: [47.5, -100.5], OH: [40.3, -82.8],
  OK: [35.6, -97.5], OR: [43.9, -120.6], PA: [40.9, -77.8], RI: [41.7, -71.5], SC: [33.9, -80.9], SD: [44.4, -100.2],
  TN: [35.9, -86.4], TX: [31.5, -99.3], UT: [39.3, -111.7], VT: [44.1, -72.7], VA: [37.5, -78.8], WA: [47.4, -120.6],
  WV: [38.6, -80.6], WI: [44.6, -89.9], WY: [43.0, -107.5],
};

/** Cities a buyer can pick as "where I am". */
export const CITY_OPTIONS = Object.keys(CITY_TABLE).sort();

const pt = ([lat, lon]: [number, number]): Point => ({ lat, lon });

/** Where a city is: the city itself when known, otherwise the middle of its state. Null when we can't tell. */
export function locate(city: string | null | undefined, state: string | null | undefined): Point | null {
  const c = city && state ? CITY_TABLE[`${city.trim()}, ${state.trim().toUpperCase()}`] : undefined;
  if (c) return pt(c);
  const s = state ? STATE_CENTRE[state.trim().toUpperCase()] : undefined;
  return s ? pt(s) : null;
}

/** Same as `locate`, for a "City, ST" label from the picker. */
export function locateLabel(label: string): Point | null {
  const [city, state] = label.split(",").map((x) => x.trim());
  return locate(city, state);
}

/** The picker city closest to a state, so a signed-in buyer starts near home. */
export function defaultCityForState(state: string | null | undefined): string {
  const s = (state ?? "").toUpperCase();
  return CITY_OPTIONS.find((c) => c.endsWith(`, ${s}`)) ?? "Phoenix, AZ";
}

/** Straight-line miles between two points (haversine). */
export function distanceMiles(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}
