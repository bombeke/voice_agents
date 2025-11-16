import type { BlurViewProps } from 'expo-blur';
import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

//const FALLBACK_COLOR = 'rgba(140, 140, 140, 0.3)'

const StatusBarBlurBackgroundImpl = ({ style, ...props }: BlurViewProps): React.ReactElement | null => {
  const insets = useSafeAreaInsets();

  if (Platform.OS !== 'ios') return null

  return (
    <BlurView
      style={[styles(insets.top).statusBarBackground, style]}
      intensity={25} 
      tint="light"  
      {...props}
    />
  )
}

export const StatusBarBlurBackground = React.memo(StatusBarBlurBackgroundImpl)

const styles =(top: any) => StyleSheet.create({
  statusBarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: top,
  },
})