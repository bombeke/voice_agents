import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import { Button, Input } from "tamagui";

export default function CreateAgent() {
  const router = useRouter();
  const { control, handleSubmit } = useForm({
    defaultValues: { name: "", description: "", phonenumber: ""},
  });

  const onSubmit = async (data: any) => {
    const id = Date.now().toString();
    const raw = await AsyncStorage.getItem("agents");
    const list = raw ? JSON.parse(raw) : [];
    list.push({ id, ...data });
    await AsyncStorage.setItem("agents", JSON.stringify(list));
    router.push("/agents");
  };

  return (
    <View style={{ padding: 16 }} className="gap-4">
      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, value } }) => (
          <Input
            placeholder="Agent name"
            value={value}
            onChangeText={onChange}
          />
        )}
      />

      <Controller
        control={control}
        name="description"
        render={({ field: { onChange, value } }) => (
          <Input
            placeholder="Short description"
            value={value}
            onChangeText={onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="phonenumber"
        render={({ field: { onChange, value } }) => (
          <Input
            placeholder="Agent Telephone"
            value={value}
            onChangeText={onChange}
          />
        )}
      />

      <Button onPress={handleSubmit(onSubmit)}>Save Agent</Button>
    </View>
  );
}
