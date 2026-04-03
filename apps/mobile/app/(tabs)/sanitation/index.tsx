import { Controller, useForm } from "react-hook-form";
import { Text, View } from "react-native";
import { Button, Input } from "tamagui";

export default function SanitationIndex() {
  const { control, handleSubmit } = useForm({
    defaultValues: { location: "", notes: "" },
  });
  const onSubmit = (v: any) => alert(JSON.stringify(v));

  return (
    <View style={{ padding: 16 }} className="gap-4">
      <Text className="text-2xl">AI Sanitation</Text>

      <Controller
        control={control}
        name="location"
        render={({ field: { onChange, value } }) => (
          <Input placeholder="Location" value={value} onChangeText={onChange} />
        )}
      />

      <Controller
        control={control}
        name="notes"
        render={({ field: { onChange, value } }) => (
          <Input placeholder="Notes" value={value} onChangeText={onChange} />
        )}
      />

      <Button onPress={handleSubmit(onSubmit)}>Submit Report</Button>
    </View>
  );
}
