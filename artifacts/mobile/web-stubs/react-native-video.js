import React from 'react';
import { View } from 'react-native';
const Video = React.forwardRef((props, ref) => React.createElement(View, { ...props, ref }));
Video.displayName = 'Video';
export default Video;
