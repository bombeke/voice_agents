export interface IPoint {
    lat:number,
    lng:number
}

export const distance = (a: IPoint, b: IPoint) => {
  const R = 6371e3;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;

  const x =
    Math.sin(dLat/2)**2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2)**2;

  return R * (2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x)));
};

export const snapToNearestPole = (point: IPoint, poles: any[], radius = 10) => {
  let closest = null;
  let min = Infinity;
  for (const p of poles) {
    const d = distance(point, {lat:p.lat,lng:p.lng});
    if (d < min && d < radius) {
      min = d;
      closest = p;
    }
  }
  return closest;
};
