'worklet';

export function parseYolo11(buffer: any) {
  const NUM_CLASSES = 80;
  const STRIDE = 4 + 1 + NUM_CLASSES;

  const out = [];

  for (let i = 0; i < buffer.length; i += STRIDE) {
    const cx = buffer[i];
    const cy = buffer[i + 1];
    const w  = buffer[i + 2];
    const h  = buffer[i + 3];
    const objConf = buffer[i + 4];

    // Find class with highest score
    let bestClass = -1;
    let bestConf = 0;
    for (let c = 0; c < NUM_CLASSES; c++) {
      const score = buffer[i + 5 + c];
      if (score > bestConf) {
        bestConf = score;
        bestClass = c;
      }
    }

    const confidence = objConf * bestConf;
    if (confidence < 0.30) continue;

    out.push({
      x: cx,
      y: cy,
      w,
      h,
      classId: bestClass,
      conf: confidence,
    });
  }

  return out;
}
