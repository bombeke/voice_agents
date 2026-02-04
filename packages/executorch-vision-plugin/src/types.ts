export type YoloModelConfig = {
  name: string;
  url: string;
  inputWidth: number;
  inputHeight: number;
  numClasses: number;
};

export type Detection = {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
  classId: number;
};
