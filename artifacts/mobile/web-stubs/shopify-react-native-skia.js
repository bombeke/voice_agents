import React from 'react';
import { View } from 'react-native';
const stub = React.forwardRef((props, ref) => React.createElement(View, { ...props, ref }));
export const Canvas = stub;
export const Rect = stub;
export const Circle = stub;
export const Path = stub;
export const Text = stub;
export const Image = stub;
export const Group = stub;
export const Paint = stub;
export const Line = stub;
export const Skia = {
  Paint: () => ({}),
  Path: () => ({ moveTo: () => {}, lineTo: () => {}, close: () => {} }),
  Image: { MakeImageFromEncoded: () => null },
};
export function useImage() { return null; }
export function usePaint() { return {}; }
export function useSharedValue(v) { return { value: v }; }
export default { Canvas, Rect, Circle, Path, Text, Image, Group, Paint, Line, Skia };
