import { Dimensions } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

export const CONTENT_SPACING = 15;

const insets = initialWindowMetrics?.insets ?? {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
};

export const SAFE_AREA_PADDING = {
  paddingLeft: insets.left + CONTENT_SPACING,
  paddingTop: insets.top + CONTENT_SPACING,
  paddingRight: insets.right + CONTENT_SPACING,
  paddingBottom: insets.bottom + CONTENT_SPACING,
};

// The maximum zoom _factor_ you should be able to zoom in
export const MAX_ZOOM_FACTOR = 10;

export const SCREEN_WIDTH = Dimensions.get('window').width;
export const SCREEN_HEIGHT = Dimensions.get('window').height;

// Capture Button
export const CAPTURE_BUTTON_SIZE = 78;

// Control Button like Flash
export const CONTROL_BUTTON_SIZE = 40;
