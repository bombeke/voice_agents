// Convert DMS EXIF to decimal degrees
export function toDecimal(dms: any, ref: any) {
  if (!dms) return null;
  const parts = dms.map(parseFloat);
  const dec = parts[0] + parts[1] / 60 + parts[2] / 3600;
  return ref === 'S' || ref === 'W' ? -dec : dec;
}
