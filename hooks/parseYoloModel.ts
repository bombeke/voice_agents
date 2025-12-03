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


export function parseYOLO(output: Float32Array) {
  // Output is [1, 8400, 84] → flatten → length = 8400 * 84
  const stride = 84;
  const numBoxes = output.length / stride;

  const results = [];

  for (let i = 0; i < numBoxes; i++) {
    const off = i * stride;

    const x = output[off + 0];
    const y = output[off + 1];
    const w = output[off + 2];
    const h = output[off + 3];

    const objectness = output[off + 4];

    // Find best class
    let bestClass = 0;
    let bestScore = 0;

    for (let c = 0; c < 80; c++) {
      const score = output[off + 5 + c];
      if (score > bestScore) {
        bestScore = score;
        bestClass = c;
      }
    }

    const confidence = objectness * bestScore;

    // CLASS 0 = PERSON
    if (bestClass === 0 && confidence > 0.30) {
      results.push({
        class: "person",
        confidence,
        x,
        y,
        w,
        h,
      });
    }
  }

  return results;
}