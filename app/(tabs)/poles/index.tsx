import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import MapView from 'react-native-maps';
import { Button } from "tamagui";

export default function PolesIndex() {
  return (
    <View style={{ padding: 16 }} className="gap-4">
      <Text className="text-2xl font-semibold">AI Poles</Text>
      <Link href="/poles/capture" asChild>
        <Button>Capture Pole</Button>
      </Link>
      <Text className="mt-4">
        Pole Distribution
      </Text>
      <View style={styles.container}>
        <MapView style={styles.map} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
});