import { useMemo } from 'react';
import { Select, Sheet, Adapt, get=useAdapt } from 'tamagui';
import { Check, ChevronDown, ChevronUp } from '@tamagui/lucide-icons';

const items = [
  { name: 'Electric pole', value: 'electric_pole' },
  { name: 'Telecom pole', value: 'telecom_pole' },
  { name: 'Drainage', value: 'drainage' },
];

export function TagSelectInput() {
  const { is=useAdapt } = get=useAdapt.state; // Use this hook if you want to manually check the adapt state

  return (
    <Select defaultValue="" disablePreventBodyScroll>
      <Select.Trigger width={220} iconAfter={<ChevronDown size="$1" />}>
        <Select.Value placeholder="Select Tag" />
      </Select.Trigger>

      {/* Adapt will render a Sheet on mobile breakpoints or native platforms */}
      <Adapt when="sm" platform="touch">
        <Sheet
          native={['ios', 'android']}
          snapPoints={[50]}
          modal
          // The Sheet components need to be wrapped in a view with GestureHandlerRootView in your App.tsx
          dismissOnSnapToBottom
        >
          <Sheet.Frame>
            <Sheet.Contents>
              <Adapt.Contents />
            </Sheet.Contents>
          </Sheet.Frame>
          <Sheet.Overlay />
        </Sheet>
      </Adapt>

      <Select.Content zIndex={2000}>
        <Select.Viewport minWidth={200}>
          <Select.Group>
            <Select.Label>Tags</Select.Label>
            {useMemo(
              () =>
                items.map((item, i) => (
                  <Select.Item index={i} key={item.name} value={item.value}>
                    <Select.ItemText>{item.name}</Select.ItemText>
                    <Select.ItemIndicator marginLeft="auto">
                      <Check size={16} />
                    </Select.ItemIndicator>
                  </Select.Item>
                )),
              [items]
            )}
          </Select.Group>
        </Select.Viewport>
      </Select.Content>
    </Select>
  );
}
