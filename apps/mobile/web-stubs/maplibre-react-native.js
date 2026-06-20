import React from 'react';
import { View } from 'react-native';

const stub = (name) => React.forwardRef((props, ref) => React.createElement(View, { ...props, ref }));

export const MapView = stub('MapView');
export const Camera = stub('Camera');
export const UserLocation = stub('UserLocation');
export const ShapeSource = stub('ShapeSource');
export const LineLayer = stub('LineLayer');
export const FillLayer = stub('FillLayer');
export const CircleLayer = stub('CircleLayer');
export const SymbolLayer = stub('SymbolLayer');
export const Images = stub('Images');
export const MarkerView = stub('MarkerView');
export const PointAnnotation = stub('PointAnnotation');
export const Callout = stub('Callout');
export function setAccessToken() {}
export const StyleURL = { Street: 'street', Satellite: 'satellite' };
export default { MapView, Camera, UserLocation, ShapeSource, LineLayer, FillLayer, CircleLayer, SymbolLayer, Images, MarkerView, PointAnnotation, Callout, setAccessToken, StyleURL };
