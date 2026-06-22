// visionDemEstimator.tsx
import MapLibreGL from "@maplibre/maplibre-react-native";
import { StyleSheet, Text, View } from "react-native";

/**
 * Types
 */
export type LatLonAlt = { lat: number; lon: number; alt: number }; // alt = meters above sea level
export type Orientation = { yaw: number; pitch: number; roll: number }; // degrees
export type VisionFrameMeta = {
  // Typical fields available from react-native-vision-camera frame/exif or device sensors
  gps?: { latitude: number; longitude: number; altitude?: number }; // altitude ASL (meters)
  orientation?: Orientation; // yaw/pitch/roll degrees
  focalLengthMm?: number; // mm, optional
  focalLengthPx?: number; // px, preferred - if missing we compute from mm & sensor
  sensorWidthMm?: number; // mm, physical sensor size (optional)
  sensorHeightMm?: number;
  imageWidthPx: number;
  imageHeightPx: number;
  principalPoint?: { cx: number; cy: number }; // pixels
  distortion?: { k1?: number; k2?: number; k3?: number; p1?: number; p2?: number }; // Brown-Conrady
  // optionally provide device altitude separately
};

export type DemTile = {
  width: number;
  height: number;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  elevations: Float32Array; // row-major, north->south (row0 = maxLat)
};

export type EstimateOptions = {
  pixel: { u: number; v: number }; // pixels in image (top-left origin)
  demMosaic: DemMosaic; // DEM provider
  cameraAltIsAgl?: boolean; // if true, convert camera altitude to ASL using DEM at camera location
  maxDistanceMeters?: number;
  toleranceMeters?: number;
  maxIterations?: number;
};

export type EstimateResult = {
  lat: number;
  lon: number;
  elevation: number;
  eastMeters: number;
  northMeters: number;
  slantDistanceMeters: number;
  iterations: number;
  diagnostics?: any;
};

/* ----------------------------
   Small numeric helpers
   ---------------------------- */
const degToRad = (d: number) => (d * Math.PI) / 180;
const radToDeg = (r: number) => (r * 180) / Math.PI;

function metersPerDeg(latDeg: number) {
  const lat = (Math.PI / 180) * latDeg;
  const mPerDegLat =
    111132.92 -
    559.82 * Math.cos(2 * lat) +
    1.175 * Math.cos(4 * lat) -
    0.0023 * Math.cos(6 * lat);
  const mPerDegLon = (Math.PI / 180) * 6378137 * Math.cos(lat);
  return { mPerDegLat, mPerDegLon };
}

function metersToLatLon(lat0: number, lon0: number, east: number, north: number) {
  const { mPerDegLat, mPerDegLon } = metersPerDeg(lat0);
  const dLat = north / mPerDegLat;
  const dLon = east / mPerDegLon;
  return { lat: lat0 + dLat, lon: lon0 + dLon };
}

/* ----------------------------
   DEM mosaic helper
   ---------------------------- */

/**
 * DemMosaic provides:
 *  - getTileFor(lat, lon): returns a DemTile or null
 *  - getElevation(lat, lon): returns elevation (meters ASL) or null
 *
 * You must provide an implementation for `loadTileFor(lat, lon)` which returns a DemTile.
 *
 * Example wire-ups:
 *  - local MBTiles: use react-native-sqlite to open mbtiles and query tile matrix, decode to float array (GTiff/encoded tiles)
 *  - remote tile server: fetch GeoTIFF or raw binary tile, decode on device (or use an API that returns elevations as JSON)
 *
 * This helper provides a simple in-memory cache and a web-tile example for DEM tiles encoded as simple JSON
 * (only for demonstration — replace with your production loader).
 */
export class DemMosaic {
  private tileCache: Map<string, DemTile> = new Map();
  // call this to provide your concrete loader
  public async loadTileFor(lat: number, lon: number): Promise<DemTile | null> {
    // TODO: Replace with MBTiles or remote tile fetching code.
    // Example: if you host your DEM tile provider as `https://example.com/dem/{z}/{x}/{y}.json`
    // you would compute tile indices from lat/lon and fetch the tile, parse into Float32Array.
    //
    // For now return null so the caller knows there's no DEM coverage.
    return null;
  }

  private tileKey(minLat: number, minLon: number, maxLat: number, maxLon: number) {
    return `${minLat}:${minLon}:${maxLat}:${maxLon}`;
  }

  public async getTileFor(lat: number, lon: number): Promise<DemTile | null> {
    // first try to find a cached tile containing the point
    for (const [, t] of this.tileCache) {
      if (lat >= t.minLat && lat <= t.maxLat && lon >= t.minLon && lon <= t.maxLon) {
        return t;
      }
    }
    // else load
    const tile = await this.loadTileFor(lat, lon);
    if (!tile) return null;
    const key = this.tileKey(tile.minLat, tile.minLon, tile.maxLat, tile.maxLon);
    this.tileCache.set(key, tile);
    return tile;
  }

  // convenience: bilinear sample elevation from mosaic (searches cached tile or loads tile)
  public async getElevation(lat: number, lon: number): Promise<number | null> {
    const tile = await this.getTileFor(lat, lon);
    if (!tile) return null;
    return demGetElevation(tile, lat, lon);
  }
}

/* ----------------------------
   DEM bilinear sampler (same as earlier)
   ---------------------------- */
function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
function demGetElevation(tile: DemTile, lat: number, lon: number): number | null {
  const { width, height, minLat, maxLat, minLon, maxLon, elevations } = tile;
  if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) return null;
  const latFrac = (maxLat - lat) / (maxLat - minLat);
  const lonFrac = (lon - minLon) / (maxLon - minLon);
  const x = lonFrac * (width - 1);
  const y = latFrac * (height - 1);
  const x0 = Math.floor(x);
  const x1 = clamp(x0 + 1, 0, width - 1);
  const y0 = Math.floor(y);
  const y1 = clamp(y0 + 1, 0, height - 1);
  const sx = x - x0;
  const sy = y - y0;
  const i00 = y0 * width + x0;
  const i10 = y0 * width + x1;
  const i01 = y1 * width + x0;
  const i11 = y1 * width + x1;
  const v00 = elevations[i00];
  const v10 = elevations[i10];
  const v01 = elevations[i01];
  const v11 = elevations[i11];
  const v0 = v00 * (1 - sx) + v10 * sx;
  const v1 = v01 * (1 - sx) + v11 * sx;
  const v = v0 * (1 - sy) + v1 * sy;
  return v;
}

/* ----------------------------
   Camera intrinsics / undistortion
   ---------------------------- */

/**
 * Undistort pixel using Brown-Conrady radial+tangential model.
 * Inputs:
 *  - u,v pixel coords
 *  - intrinsics fPx, cx, cy (focal in pixels)
 *  - distortion coeffs k1,k2,k3,p1,p2
 *
 * Returns undistorted pixel coords in same units (pixels).
 *
 * NOTE: This function performs one-step approximate undistortion via Newton iterations.
 */
function undistortPixel(
  u: number,
  v: number,
  intrinsics: { fPx: number; cx: number; cy: number },
  dist?: { k1?: number; k2?: number; k3?: number; p1?: number; p2?: number }
): { x: number; y: number } {
  if (!dist) {
    return { x: u, y: v };
  }
  const { fPx, cx, cy } = intrinsics;
  // normalize to camera coords (x = (u-cx)/f, y = (v-cy)/f) where f is focal in pixels
  let x = (u - cx) / fPx;
  let y = (v - cy) / fPx;

  // Iteratively solve for undistorted (x_d,y_d) that when distorted produce (x,y).
  // Start with initial guess equal to observed normalized coords.
  let x0 = x;
  let y0 = y;
  const k1 = dist.k1 ?? 0;
  const k2 = dist.k2 ?? 0;
  const k3 = dist.k3 ?? 0;
  const p1 = dist.p1 ?? 0;
  const p2 = dist.p2 ?? 0;

  for (let i = 0; i < 5; i++) {
    const r2 = x0 * x0 + y0 * y0;
    const radial = 1 + k1 * r2 + k2 * r2 * r2 + k3 * r2 * r2 * r2;
    const xDist = x0 * radial + 2 * p1 * x0 * y0 + p2 * (r2 + 2 * x0 * x0);
    const yDist = y0 * radial + p1 * (r2 + 2 * y0 * y0) + 2 * p2 * x0 * y0;

    // error between distorted guess and observed
    const ex = xDist - x;
    const ey = yDist - y;

    // simple Newton-ish correction (Jacobian approx)
    x0 = x0 - 0.5 * ex;
    y0 = y0 - 0.5 * ey;
  }

  // convert back to pixel coordinates
  return { x: x0 * fPx + cx, y: y0 * fPx + cy };
}

/* ----------------------------
   Rotation helper & ray math (same convention as earlier)
   ---------------------------- */
function matMul3(A: number[][], B: number[][]): number[][] {
  const C = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += A[i][k] * B[k][j];
      C[i][j] = s;
    }
  }
  return C;
}
function Rz(t: number) {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}
function Ry(t: number) {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ];
}
function Rx(t: number) {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ];
}
function matVecMul(M: number[][], v: [number, number, number]): [number, number, number] {
  return [
    M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
    M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
    M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
  ];
}
function normalize(v: [number, number, number]) {
  const s = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (s === 0) return v;
  return [v[0] / s, v[1] / s, v[2] / s] as [number, number, number];
}
function buildCamToWorldMatrix(orientation: Orientation) {
  const psi = degToRad(orientation.yaw);
  const theta = degToRad(-orientation.pitch);
  const phi = degToRad(orientation.roll);
  return matMul3(Rz(psi), matMul3(Ry(theta), Rx(phi)));
}

/* ----------------------------
   Core: estimatePointFromFrame
   ---------------------------- */

/**
 * estimatePointFromFrame:
 *  - takes VisionFrame metadata and pixel
 *  - undistorts pixel if distortion supplied
 *  - builds camera ray using focalPx (or computes from focalMm + sensor size)
 *  - solves for intersection with DEM mosaic via robust bisection
 */
export async function estimatePointFromFrame(
  frameMeta: VisionFrameMeta,
  options: EstimateOptions
): Promise<EstimateResult | null> {
  const {
    pixel,
    demMosaic,
    cameraAltIsAgl = false,
    maxDistanceMeters = 5000,
    toleranceMeters = 0.05,
    maxIterations = 60,
  } = options;

  // 1) get camera geo position
  if (!frameMeta.gps) throw new Error("frame metadata missing gps");
  let camLat = frameMeta.gps.latitude;
  let camLon = frameMeta.gps.longitude;
  let camAlt = frameMeta.gps.altitude ?? 0;

  // if camera reported altitude is AGL and caller says so, convert to ASL by sampling DEM at camera lat/lon
  if (cameraAltIsAgl) {
    const demElevAtCam = await demMosaic.getElevation(camLat, camLon);
    if (demElevAtCam !== null) {
      camAlt = camAlt + demElevAtCam;
    }
  }

  // 2) intrinsics: compute focal in pixels if missing
  let focalPx = frameMeta.focalLengthPx ?? null;
  if (!focalPx) {
    // compute from mm if we have sensor size and focalLengthMm
    if (frameMeta.focalLengthMm && frameMeta.sensorWidthMm && frameMeta.imageWidthPx) {
      focalPx = (frameMeta.focalLengthMm / frameMeta.sensorWidthMm) * frameMeta.imageWidthPx;
    } else {
      throw new Error("no focal length available in px or mm+sensorWidth");
    }
  }

  const cx = frameMeta.principalPoint?.cx ?? frameMeta.imageWidthPx / 2.0;
  const cy = frameMeta.principalPoint?.cy ?? frameMeta.imageHeightPx / 2.0;

  // 3) undistort pixel if distortion provided
  const intr = { fPx: focalPx, cx, cy };
  const und = undistortPixel(pixel.u, pixel.v, intr, frameMeta.distortion);

  // 4) build camera ray in camera coords
  // camera frame: x right, y down, z forward, vector in pixel-units normalized by focal
  const x = und.x - cx;
  const y = und.y - cy;
  const rCam = normalize([x, y, focalPx] as [number, number, number]);

  // 5) rotate to world ENU coords
  if (!frameMeta.orientation) throw new Error("frame metadata missing orientation");
  const R = buildCamToWorldMatrix(frameMeta.orientation);
  const rWorldRaw = matVecMul(R, rCam);
  const rWorld = normalize(rWorldRaw);

  // don't handle ray pointing up
  if (rWorld[2] >= -1e-9) return null;

  // helper: evaluate t -> lat/lon/elev
  function evalAtT(t: number) {
    const east = t * rWorld[0];
    const north = t * rWorld[1];
    const { lat: latT, lon: lonT } = metersToLatLon(camLat, camLon, east, north);
    return { east, north, lat: latT, lon: lonT, zRay: camAlt + t * rWorld[2] };
  }

  // we will perform a bracketed bisection like earlier, but now we use the mosaic getElevation
  let tLo = 0.1;
  let tHi = maxDistanceMeters;

  // find a sampled t that hits the DEM
  let foundSample = false;
  const nSamples = 12;
  for (let i = 1; i <= nSamples; i++) {
    const ts = (i / nSamples) * tHi;
    const p = evalAtT(ts);
    const elev = await demMosaic.getElevation(p.lat, p.lon);
    if (elev !== null) {
      foundSample = true;
      break;
    }
  }
  if (!foundSample) return null;

  // compute f(t) = zRay - demLatLonElev
  async function fAt(t: number): Promise<number | null> {
    const p = evalAtT(t);
    const elev = await demMosaic.getElevation(p.lat, p.lon);
    if (elev === null) return null;
    return p.zRay - elev;
  }

  // ensure fLo finite
  let fLo = await fAt(tLo);
  if (fLo === null) {
    // move outward until we find DEM coverage
    let moved = false;
    for (let i = 1; i <= 20; i++) {
      const t = tLo + i * 0.5;
      const fv = await fAt(t);
      if (fv !== null) {
        tLo = t;
        fLo = fv;
        moved = true;
        break;
      }
    }
    if (!moved) return null;
  }

  let fHi = await fAt(tHi);
  if (fHi === null) {
    // shrink until find coverage
    let moved = false;
    for (let i = 1; i <= 40; i++) {
      const t = tHi * (1 - i * 0.02);
      if (t <= tLo + 0.1) break;
      const fv = await fAt(t);
      if (fv !== null) {
        tHi = t;
        fHi = fv;
        moved = true;
        break;
      }
    }
    if (!moved) return null;
  }

  // if same sign, try to expand tHi to find sign change
  if (fLo !== null && fHi !== null && fLo * fHi > 0) {
    let found = false;
    for (let i = 1; i <= 60; i++) {
      const t = tHi * (1 + i * 0.05);
      if (t > maxDistanceMeters) break;
      const fv = await fAt(t);
      if (fv === null) continue;
      if (fv * fLo <= 0) {
        tHi = t;
        fHi = fv;
        found = true;
        break;
      }
    }
    if (!found) return null;
  }

  // bisection
  let iter = 0;
  let tMid = tLo;
  while (iter < maxIterations) {
    tMid = 0.5 * (tLo + tHi);
    const fMid = await fAt(tMid);
    if (fMid === null) {
      tHi = tMid;
      iter++;
      continue;
    }
    if (Math.abs(fMid) <= toleranceMeters) {
      const p = evalAtT(tMid);
      const elev = (await demMosaic.getElevation(p.lat, p.lon)) as number;
      const slant = Math.sqrt(p.east * p.east + p.north * p.north + Math.pow(p.zRay - camAlt, 2));
      return {
        lat: p.lat,
        lon: p.lon,
        elevation: elev,
        eastMeters: p.east,
        northMeters: p.north,
        slantDistanceMeters: slant,
        iterations: iter,
        diagnostics: {
          rWorld,
          camLat,
          camLon,
          camAlt,
          focalPx,
          undistortedPixel: und,
        },
      };
    }

    // evaluate fLo for sign
    const fLoNow = await fAt(tLo);
    if (fLoNow === null) {
      tLo = tMid;
      iter++;
      continue;
    }

    if (fLoNow * fMid <= 0) {
      tHi = tMid;
    } else {
      tLo = tMid;
    }
    iter++;
  }

  // return best effort
  const pf = evalAtT(tMid);
  const elevF = await demMosaic.getElevation(pf.lat, pf.lon);
  if (elevF === null) return null;
  const slantF = Math.sqrt(pf.east * pf.east + pf.north * pf.north + Math.pow(pf.zRay - camAlt, 2));
  return {
    lat: pf.lat,
    lon: pf.lon,
    elevation: elevF,
    eastMeters: pf.east,
    northMeters: pf.north,
    slantDistanceMeters: slantF,
    iterations: maxIterations,
    diagnostics: {
      camLat,
      camLon,
      camAlt,
      rWorld,
    },
  };
}

/* ----------------------------
   Debug visualizer: MapLibre React component
   ---------------------------- */

/**
 * DemEstimateVisualizer props:
 *  - camera: {lat,lon,alt}
 *  - estimate?: EstimateResult (if available)
 *  - markers?: extra markers
 *  - styleWidth/Height optional (container size)
 */
export function DemEstimateVisualizer({
  camera,
  estimate,
  markers,
}: {
  camera: LatLonAlt;
  estimate?: EstimateResult | null;
  markers?: Array<{ id: string; lat: number; lon: number }>;
}) {
  // MapLibre requires a style; user should set MAPBOX_STYLE or a local style.
  // For demo you might use a simple open-style URL or a local style asset.
  const center = estimate ? [estimate.lon, estimate.lat] : [camera.lon, camera.lat];

  return (
    <View style={{ flex: 1 }}>
      <MapLibreGL.MapView style={{ flex: 1 }}>
        <MapLibreGL.Camera centerCoordinate={center} zoomLevel={15} />

        {/* Camera marker */}
        <MapLibreGL.PointAnnotation id="camera" coordinate={[camera.lon, camera.lat]}>
          <View style={styles.camMarker} />
          <MapLibreGL.Callout title={"Camera"} />
        </MapLibreGL.PointAnnotation>

        {/* Estimated point */}
        {estimate && (
          <MapLibreGL.PointAnnotation id="est" coordinate={[estimate.lon, estimate.lat]}>
            <View style={styles.estMarker} />
            <MapLibreGL.Callout title={`Est: ${estimate.lat.toFixed(6)}, ${estimate.lon.toFixed(6)}`} />
          </MapLibreGL.PointAnnotation>
        )}

        {/* extra markers */}
        {markers?.map((m) => (
          <MapLibreGL.PointAnnotation id={m.id} key={m.id} coordinate={[m.lon, m.lat]}>
            <View style={styles.markerSmall} />
          </MapLibreGL.PointAnnotation>
        ))}
      </MapLibreGL.MapView>

      {/* small info overlay */}
      <View style={styles.infoBox}>
        <Text style={{ fontWeight: "600" }}>Camera</Text>
        <Text>{`${camera.lat.toFixed(6)}, ${camera.lon.toFixed(6)} @ ${camera.alt?.toFixed?.(1) ?? "n/a"} m`}</Text>
        {estimate ? (
          <>
            <Text style={{ marginTop: 6, fontWeight: "600" }}>Estimate</Text>
            <Text>{`${estimate.lat.toFixed(6)}, ${estimate.lon.toFixed(6)} (${estimate.elevation.toFixed(2)} m)`}</Text>
            <Text>{`E:${estimate.eastMeters.toFixed(2)} m N:${estimate.northMeters.toFixed(2)} m`}</Text>
            <Text>{`Slant: ${estimate.slantDistanceMeters.toFixed(2)} m`}</Text>
          </>
        ) : (
          <Text style={{ marginTop: 6 }}>No estimate yet</Text>
        )}
      </View>
    </View>
  );
}

/* ----------------------------
   Styles
   ---------------------------- */
const styles = StyleSheet.create({
  camMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#007AFF",
    borderColor: "white",
    borderWidth: 2,
  },
  estMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#ff3b30",
    borderColor: "white",
    borderWidth: 2,
  },
  markerSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#333",
    borderColor: "white",
    borderWidth: 1,
  },
  infoBox: {
    position: "absolute",
    left: 12,
    top: 12,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 8,
    minWidth: 200,
  },
});
