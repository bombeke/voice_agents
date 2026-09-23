import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";

export default function AgentForm({
  onSave = (v: any) => {},
}: {
  onSave?: (v: any) => void;
}) {
  const { control, handleSubmit } = useForm({
    defaultValues: { name: "", description: "" },
  });
  return (
    <View className="gap-3">
      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, value } }) => (
          <Input placeholder="Name" value={value} onChangeText={onChange} />
        )}
      />

      <Controller
        control={control}
        name="description"
        render={({ field: { onChange, value } }) => (
          <Input
            placeholder="Description"
            value={value}
            onChangeText={onChange}
          />
        )}
      />

      <Button onPress={handleSubmit(onSave)}>Save Agent</Button>
    </View>
  );
}
