import React from 'react';
import { View, Text, Image, ScrollView, Animated } from 'react-native';

export function useSharedValue(init) {
  return { value: init };
}
export function useAnimatedStyle(fn) {
  try { return fn(); } catch { return {}; }
}
export function useAnimatedGestureHandler(handlers) { return handlers; }
export function useDerivedValue(fn) { return { value: fn() }; }
export function useAnimatedScrollHandler(handler) { return handler; }
export function useAnimatedRef() { return { current: null }; }
export function useAnimatedReaction() {}
export function useAnimatedProps(fn) {
  try { return fn(); } catch { return {}; }
}
export function withTiming(value) { return value; }
export function withSpring(value) { return value; }
export function withDelay(_, animation) { return animation; }
export function withRepeat(animation) { return animation; }
export function withSequence(...animations) { return animations[animations.length - 1]; }
export function interpolate(value, input, output) { return output[0]; }
export function interpolateColor(value, input, output) { return output[0]; }
export function runOnJS(fn) { return fn; }
export function runOnUI(fn) { return fn; }
export function cancelAnimation() {}
export function measure() { return null; }
export function scrollTo() {}
export function Easing(t) { return t; }
Easing.linear = t => t;
Easing.ease = t => t;
Easing.quad = t => t * t;
Easing.bezier = () => t => t;
Easing.in = fn => fn;
Easing.out = fn => fn;
Easing.inOut = fn => fn;

export const FlatList = View;
export const AnimatedView = View;

const ReanimatedView = React.forwardRef((props, ref) => React.createElement(View, { ...props, ref }));
const ReanimatedText = React.forwardRef((props, ref) => React.createElement(Text, { ...props, ref }));
const ReanimatedImage = React.forwardRef((props, ref) => React.createElement(Image, { ...props, ref }));
const ReanimatedScrollView = React.forwardRef((props, ref) => React.createElement(ScrollView, { ...props, ref }));

const Reanimated = {
  View: ReanimatedView,
  Text: ReanimatedText,
  Image: ReanimatedImage,
  ScrollView: ReanimatedScrollView,
  FlatList: View,
  createAnimatedComponent: (Component) => Component,
};
export default Reanimated;
