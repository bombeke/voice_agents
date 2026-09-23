import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Controller, useForm } from "react-hook-form";
import { Text, View } from "react-native";

export default function SanitationIndex() {
  const { control, handleSubmit } = useForm({
    defaultValues: { location: "", notes: "" },
  });
  const onSubmit = (v: any) => alert(JSON.stringify(v));

  return (
    <View className="flex-1 gap-4 p-4 bg-background">
      <Text className="type-h1 text-text">AI Sanitation</Text>

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
