import { useRxDB } from "@/providers/RxDBContext";
import { randomUUID } from "expo-crypto";
import { useEffect, useState } from "react";
import { Button, Text, View } from "react-native";

export default function PoleVisionHomeScreen() {
  const db = useRxDB();
  const [poles, setPoles] = useState([]);

  useEffect(() => {
    if (!db) return;
    const sub = db.poles.find().$.subscribe((docs: any) => {
      setPoles(docs.map((d: any) => d.toJSON()));
    });
    return () => sub.unsubscribe();
  }, [db]);

  const addPole = async () => {
    await db.poles.insert({
      id: randomUUID(),
      latitude: 0.332,
      longitude: 32.556,
      timestamp: Date.now(),
      imageUri: "",
      detectionConfidence: 80,
      createdAt: Date.now(),
    });
  };

  return (
    <View>
      <Button title="Add Utility Pole" onPress={addPole} />

      {poles.map((p: any) => (
        <Text key={p.id}>
          {p.id} — {p.latitude}, {p.longitude}
        </Text>
      ))}
    </View>
  );
}
