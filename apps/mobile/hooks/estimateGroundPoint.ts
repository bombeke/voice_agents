// estimateGroundPoint.tsx

/**
 * Types
 */
export type LatLonAlt = { lat: number; lon: number; alt: number }; // alt = meters above sea level
export type Orientation = { yaw: number; pitch: number; roll: number }; // degrees: yaw clockwise from north, pitch positive down (nose-down), roll right-wing down
export type Intrinsics = { focalPx: number; cx: number; cy: number }; // focal length in pixels and principal point
export type ImageSize = { width: number; height: number };

/**
 * DEM tile: regular grid covering bounding box, row-major: data[row * width + col]
 */
export type DemTile = {
  width: number;
  height: number;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  elevations: Float32Array; // meters above sea level (same datum as camera alt)
};

/**
 * Result
 */
export type EstimateResult = {
  lat: number;
  lon: number;
  elevation: number; // DEM elevation at that point
  eastMeters: number; // E relative to camera
  northMeters: number; // N relative to camera
  slantDistanceMeters: number; // distance from camera to intersection point along ray
  iterations: number;
};

/* ---------------------------
   Utility: geographic helpers
   --------------------------- */

/** approximate meters per degree at a given latitude */
function metersPerDeg(latDeg: number) {
  // WGS84 approximations
  const lat = (Math.PI / 180) * latDeg;
  // length of a degree latitude (m)
  const mPerDegLat = 111132.92 - 559.82 * Math.cos(2 * lat) + 1.175 * Math.cos(4 * lat) - 0.0023 * Math.cos(6 * lat);
  // length of a degree longitude (m)
  const mPerDegLon = (Math.PI / 180) * 6378137 * Math.cos(lat); // simpler estimate
  return { mPerDegLat, mPerDegLon };
}

/** convert ENU meters (east, north) -> lat/lon */
function metersToLatLon(lat0: number, lon0: number, east: number, north: number) {
  const { mPerDegLat, mPerDegLon } = metersPerDeg(lat0);
  const dLat = north / mPerDegLat;
  const dLon = east / mPerDegLon;
  return { lat: lat0 + dLat, lon: lon0 + dLon };
}

/** convert lat/lon -> ENU meters relative to origin (lat0, lon0) */
function latLonToMeters(lat0: number, lon0: number, lat: number, lon: number) {
  const { mPerDegLat, mPerDegLon } = metersPerDeg(lat0);
  const north = (lat - lat0) * mPerDegLat;
  const east = (lon - lon0) * mPerDegLon;
  return { east, north };
}

/* ---------------------------
   DEM helpers
   --------------------------- */

/** clamp helper */
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Bilinear interpolate DEM: returns elevation in meters above sea level */
function demGetElevation(tile: DemTile, lat: number, lon: number): number | null {
  const { width, height, minLat, maxLat, minLon, maxLon, elevations } = tile;

  if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) return null;

  // Map lat→row (0..height-1), lon→col (0..width-1)
  // row 0 -> maxLat (top) if tile stored north-to-south; we'll assume row 0 is maxLat (typical)
  const latFrac = (maxLat - lat) / (maxLat - minLat); // 0 at maxLat? for top-down
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

  // bilinear
  const v0 = v00 * (1 - sx) + v10 * sx;
  const v1 = v01 * (1 - sx) + v11 * sx;
  const v = v0 * (1 - sy) + v1 * sy;
  return v;
}

/* ---------------------------
   Math: rotation and rays
   --------------------------- */

/**
 * rotation matrices using same convention as the Python example:
 * R = R_z(yaw) * R_y(theta) * R_x(phi)
 * where:
 *  - yaw (psi) is rotation about Z (up), clockwise from north (degrees). We convert to radians and use standard rotation.
 *  - pitch provided (degrees positive = camera pitched DOWN). We use theta = -pitch in the rotation chain to get the expected mapping.
 *  - roll (phi) is rotation about X.
 *
 * Camera coordinates: x = right, y = down, z = forward (pinhole image plane at z = +f)
 * World coordinates: ENU where x -> east, y -> north, z -> up. (This mapping matches the earlier derivation.)
 */
function degToRad(d: number) {
  return (d * Math.PI) / 180;
}

function matMul3(A: number[][], B: number[][]): number[][] {
  const C: number[][] = [
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

/** build rotation matrix camera->world (ENU) */
function buildCamToWorldMatrix(orientation: Orientation) {
  const psi = degToRad(orientation.yaw); // yaw
  const theta = degToRad(-orientation.pitch); // negative because pitch positive means nose-down
  const phi = degToRad(orientation.roll);

  // R = Rz(psi) * Ry(theta) * Rx(phi)
  const R = matMul3(Rz(psi), matMul3(Ry(theta), Rx(phi)));
  return R; // 3x3
}

/** multiply 3x3 matrix by 3x1 vector */
function matVecMul(M: number[][], v: [number, number, number]): [number, number, number] {
  return [
    M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
    M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
    M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
  ];
}

/** normalize 3-vector */
function normalize(v: [number, number, number]) {
  const s = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (s === 0) return v;
  return [v[0] / s, v[1] / s, v[2] / s] as [number, number, number];
}

/* ---------------------------
   Core: estimate intersection with DEM
   --------------------------- */

/**
 * estimateGroundPoint
 *
 * @param camGeo camera geolocation and altitude (lat, lon, alt in m ASL)
 * @param intrinsics focalPx, cx, cy (pixels)
 * @param img image size
 * @param orientation yaw/pitch/roll (degrees)
 * @param pixel pixel {u, v} (px from top-left)
 * @param dem DEM tile covering area with elevations in meters ASL
 * @param options optional configuration: maxDistanceMeters, toleranceMeters, maxIterations
 *
 * Returns EstimateResult or null if no intersection found within search range or DEM outside tile.
 */
export function estimateGroundPoint(
  camGeo: LatLonAlt,
  intrinsics: Intrinsics,
  img: ImageSize,
  orientation: Orientation,
  pixel: { u: number; v: number },
  dem: DemTile,
  options?: { maxDistanceMeters?: number; toleranceMeters?: number; maxIterations?: number }
): EstimateResult | null {
  const maxDistance = options?.maxDistanceMeters ?? 5000; // search out to 5 km by default
  const tol = options?.toleranceMeters ?? 0.05; // 5 cm
  const maxIter = options?.maxIterations ?? 60;

  // 1) pixel -> camera ray (camera frame)
  // camera frame convention: x right, y down, z forward; origin at camera optical center
  const x = pixel.u - intrinsics.cx;
  const y = pixel.v - intrinsics.cy;
  const f = intrinsics.focalPx;

  // Direction vector in camera coords (not yet normalized)
  const rCamRaw: [number, number, number] = [x, y, f];
  // normalize so we work with unit vector in camera units
  const rCam = normalize(rCamRaw);

  // 2) rotate to world (ENU)
  const R = buildCamToWorldMatrix(orientation);
  const rWorldRaw = matVecMul(R, rCam); // direction in ENU but units correspond to camera-normalized units
  const rWorld = normalize(rWorldRaw); // unit direction vector in ENU (meters per meter)

  // 3) ray equation: P(t) = C + t * rWorld, C = camera position in ENU origin (0,0,camAlt) relative to camera lat/lon
  // We'll treat camera location as origin (0,0,camGeo.alt), and convert candidate ENU east/north -> lat/lon for DEM lookup.
  const camAlt = camGeo.alt;

  // Quick test: if ray points upward (rWorld[2] >= 0) then it won't intersect ground below camera
  if (rWorld[2] >= -1e-9) {
    // Ray not pointing downward sufficiently
    return null;
  }

  // 4) We want t such that the z (altitude) of P(t) equals the DEM elevation at that lat/lon:
  //    camAlt + t * rWorld_z = demElevation(lat(t), lon(t))
  //
  // This is an implicit equation because demElevation depends on lat/lon which depend on t.
  // We'll solve for f(t) = camAlt + t*rWorld_z - dem(lat(t), lon(t)) = 0 via bisection / root-find on [tNear, tFar]

  // helper: compute lat/lon and dem elevation at distance t
  function evalAtT(t: number): { zRay: number; demElev: number | null; east: number; north: number } {
    const east = t * rWorld[0];
    const north = t * rWorld[1];
    // convert east/north (meters) to lat/lon relative to camera lat/lon
    const { lat: latT, lon: lonT } = metersToLatLon(camGeo.lat, camGeo.lon, east, north);
    const elev = demGetElevation(dem, latT, lonT);
    const zRay = camAlt + t * rWorld[2];
    return { zRay, demElev: elev, east, north };
  }

  // tNear: small positive value to avoid self-intersection
  let tLo = 0.1; // 10 cm
  let tHi = maxDistance;

  // Ensure that DEM covers some part of ray path: sample a few points along ray, if none hit DEM tile return null
  const nSamples = 10;
  let foundSample = false;
  for (let i = 1; i <= nSamples; i++) {
    const ts = (i / nSamples) * tHi;
    const e = evalAtT(ts);
    if (e.demElev !== null) {
      foundSample = true;
      break;
    }
  }
  if (!foundSample) {
    // DEM tile doesn't intersect ray path within maxDistance
    return null;
  }

  // Bisection: we need sign change for f(t) = zRay - demElev
  // find bracket with opposite sign
  let fLo = (() => {
    const r = evalAtT(tLo);
    return r.demElev !== null ? r.zRay - r.demElev : Number.NaN;
  })();
  let fHi = (() => {
    const r = evalAtT(tHi);
    return r.demElev !== null ? r.zRay - r.demElev : Number.NaN;
  })();

  // If fLo is NaN (DEM missing at tLo) try to move tLo outward until we find DEM coverage
  if (!isFinite(fLo)) {
    let moved = false;
    for (let i = 1; i <= 10; i++) {
      const t = tLo + i * 0.5; // step 0.5m
      const r = evalAtT(t);
      if (r.demElev !== null) {
        tLo = t;
        fLo = r.zRay - r.demElev;
        moved = true;
        break;
      }
    }
    if (!moved) return null;
  }

  if (!isFinite(fHi)) {
    // try reduce tHi
    let moved = false;
    for (let i = 1; i <= 20; i++) {
      const t = tHi * (1 - i * 0.05);
      if (t <= tLo + 0.1) break;
      const r = evalAtT(t);
      if (r.demElev !== null) {
        tHi = t;
        fHi = r.zRay - r.demElev;
        moved = true;
        break;
      }
    }
    if (!moved) return null;
  }

  // If signs are same, try to expand tHi a bit (rare)
  if (fLo * fHi > 0) {
    // try scanning outward to find a sign change
    const scans = 60;
    let found = false;
    for (let i = 1; i <= scans; i++) {
      const t = tHi * (1 + i * 0.05);
      if (t > maxDistance) break;
      const r = evalAtT(t);
      if (r.demElev === null) continue;
      const fv = r.zRay - r.demElev;
      if (fv * fLo <= 0) {
        tHi = t;
        fHi = fv;
        found = true;
        break;
      }
    }
    if (!found) {
      // Could not bracket root
      return null;
    }
  }

  // now we have fLo and fHi with opposite sign (hopefully)
  let iter = 0;
  let tMid = tLo;
  while (iter < maxIter) {
    tMid = 0.5 * (tLo + tHi);
    const rMid = evalAtT(tMid);
    if (rMid.demElev === null) {
      // if mid point outside DEM, move bracket endpoints inward slightly
      tHi = tMid;
      iter++;
      continue;
    }
    const fMid = rMid.zRay - rMid.demElev;
    if (Math.abs(fMid) <= tol) {
      // found
      const { lat, lon } = metersToLatLon(camGeo.lat, camGeo.lon, rMid.east, rMid.north);
      return {
        lat,
        lon,
        elevation: rMid.demElev,
        eastMeters: rMid.east,
        northMeters: rMid.north,
        slantDistanceMeters: Math.sqrt(rMid.east * rMid.east + rMid.north * rMid.north + (rMid.zRay - camAlt) * (rMid.zRay - camAlt)),
        iterations: iter,
      };
    }

    // choose subinterval that contains root
    const rLo = evalAtT(tLo);
    const fLo2 = rLo.demElev === null ? Number.NaN : rLo.zRay - rLo.demElev;

    // if sign(fLo) != sign(fMid) shrink to [tLo, tMid] else [tMid, tHi]
    if (fLo2 * fMid <= 0) {
      tHi = tMid;
      fHi = fMid;
    } else {
      tLo = tMid;
      fLo = fMid;
    }
    iter++;
  }

  // If we exit loop, return best estimate (tMid)
  const rFinal = evalAtT(tMid);
  if (rFinal.demElev === null) return null;
  const { lat: latF, lon: lonF } = metersToLatLon(camGeo.lat, camGeo.lon, rFinal.east, rFinal.north);
  return {
    lat: latF,
    lon: lonF,
    elevation: rFinal.demElev,
    eastMeters: rFinal.east,
    northMeters: rFinal.north,
    slantDistanceMeters: Math.sqrt(rFinal.east * rFinal.east + rFinal.north * rFinal.north + (rFinal.zRay - camAlt) * (rFinal.zRay - camAlt)),
    iterations: iter,
  };
}

/* ---------------------------
   React hook wrapper (optional)
   Example usage inside RN component:
   const result = useEstimateGroundPoint({ ... })
   --------------------------- */

export function useEstimateGroundPoint() {
  // hook simply returns the function in this module; kept for possible future caching / state
  return estimateGroundPoint;
}
