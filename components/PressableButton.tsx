import { ReactNode, useCallback } from 'react';
import { Pressable, PressableProps, PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';

export type StyleType = (state: PressableStateCallbackType) => StyleProp<ViewStyle>;

export interface IPressableButton extends PressableProps{
    /**
	 * The opacity to use when `disabled={true}`
	 *
	 * @default 0.3
	 */
	disabledOpacity?: number;
	/**
	 * The opacity to animate to when the user presses the button
	 *
	 * @default 0.2
	 */
	activeOpacity?: number;
    children: ReactNode;
}

export const PressableButton =({
	style,
	disabled = false,
	disabledOpacity = 0.3,
	activeOpacity = 0.2,
    ...passThroughProps
}: IPressableButton)=>{
	const getOpacity = useCallback((pressed: boolean) => {
        if (disabled) {
            return disabledOpacity;
        } 
        else {
            if (pressed) return activeOpacity;
            else return 1;
        }
    },
    [activeOpacity, disabled, disabledOpacity],
	);
	const _style = useCallback<StyleType>(({ pressed }) => [style as ViewStyle, { opacity: getOpacity(pressed) }], [getOpacity, style]);

    return (
        <Pressable
            style={_style} 
            disabled={disabled}
            {...passThroughProps}
        />
    )
}