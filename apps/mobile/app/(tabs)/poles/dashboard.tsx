// PoleVisionMockup.tsx
import { Picker } from "@react-native-picker/picker"; // RN replacement for <select>
import { useState } from "react";
import {
  FlatList,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

// ---------------------------
// KPI Card
// ---------------------------
const KPI = ({ title, value, delta, children }: any) => (
  <View className="bg-white shadow-md rounded-2xl p-4 flex flex-col">
    <View className="flex flex-row justify-between items-start">
      <View>
        <Text className="text-sm text-slate-500">{title}</Text>
        <Text className="text-2xl font-semibold mt-1">{value}</Text>
      </View>
      <Text className="text-sm text-slate-400">{delta}</Text>
    </View>
    <Text className="mt-3 text-xs text-slate-500">{children}</Text>
  </View>
);

// ---------------------------
// Map Placeholder
// ---------------------------
const MapPlaceholder = () => (
  <View className="bg-slate-50 border border-slate-100 rounded-2xl h-96 items-center justify-center">
    <Text className="text-slate-400">Interactive Map Canvas (placeholder)</Text>
  </View>
);

// ---------------------------
// Table Row Component
// ---------------------------
const Row = ({ item, onSelect }: any) => (
  <Pressable
    onPress={() => onSelect(item)}
    className="flex flex-row justify-between px-4 py-3 border-b border-slate-100 bg-white"
  >
    <Text className="w-16 text-sm text-slate-600">{item.id}</Text>
    <Text className="w-20 text-sm text-slate-600">{item.type}</Text>
    <Text className="w-24 text-sm text-slate-600">{item.owner}</Text>
    <Text className="w-20 text-sm text-slate-600">{item.condition}</Text>
    <Text
      className={`w-14 text-sm font-semibold ${
        item.risk === "High"
          ? "text-rose-600"
          : item.risk === "Med"
          ? "text-amber-600"
          : "text-emerald-600"
      }`}
    >
      {item.risk}
    </Text>
    <Text className="flex-1 text-sm text-slate-600">{item.location}</Text>

    <Pressable className="px-3 py-1 rounded-lg bg-slate-100">
      <Text className="text-slate-700 text-sm">View</Text>
    </Pressable>
  </Pressable>
);

// ---------------------------
// Table Component (FlatList)
// ---------------------------
const DataTable = ({ rows, onSelect }: any) => (
  <View className="bg-white shadow rounded-2xl overflow-hidden">
    <View className="bg-slate-50 px-4 py-3 flex-row">
      <Text className="w-16 text-xs font-medium text-slate-500">ID</Text>
      <Text className="w-20 text-xs font-medium text-slate-500">Type</Text>
      <Text className="w-24 text-xs font-medium text-slate-500">Owner</Text>
      <Text className="w-20 text-xs font-medium text-slate-500">Condition</Text>
      <Text className="w-14 text-xs font-medium text-slate-500">Risk</Text>
      <Text className="flex-1 text-xs font-medium text-slate-500">Location</Text>
    </View>

    <FlatList
      data={rows}
      renderItem={({ item }) => <Row item={item} onSelect={onSelect} />}
      keyExtractor={(item) => item.id}
    />
  </View>
);

// ---------------------------
// Modal
// ---------------------------
const PoleDetailModal = ({ pole, onClose }: any) => {
  if (!pole) return null;

  return (
    <Modal transparent animationType="fade">
      <View className="flex-1 bg-black/40 items-center justify-center p-4">
        <View className="bg-white rounded-2xl w-full max-w-xl shadow-2xl p-6">
          <View className="flex-row justify-between items-start">
            <View>
              <Text className="text-sm text-slate-500">Pole Detail</Text>
              <Text className="text-xl font-semibold">
                {pole.id} — {pole.type}
              </Text>
              <Text className="text-sm text-slate-400">
                {pole.location} • Owner: {pole.owner}
              </Text>
            </View>
            <Pressable onPress={onClose}>
              <Text className="text-slate-400 text-lg">✕</Text>
            </Pressable>
          </View>

          <View className="mt-4">
            <View className="bg-slate-50 rounded-lg p-3 mb-4">
              <ImageBackground
                source={{
                  uri: "https://images.unsplash.com/photo-1563306408-0e5b96a4f9fb?auto=format&fit=crop&w=800&q=60",
                }}
                className="h-48 rounded-lg"
                imageStyle={{ borderRadius: 12 }}
              />

              <Text className="mt-3 text-sm text-slate-500">AI Annotations</Text>
              <Text className="text-sm text-slate-600 mt-2">
                • Lean Angle: {pole.analysis.lean}°
              </Text>
              <Text className="text-sm text-slate-600">
                • Wood Rot: {pole.analysis.woodRot ? "Detected" : "None"}
              </Text>
              <Text className="text-sm text-slate-600">
                • Vegetation Proximity: {pole.analysis.veg}m
              </Text>
              <Text className="text-sm text-slate-600">
                • Wildlife Flag: {pole.analysis.wildlife ? "Yes" : "No"}
              </Text>
            </View>

            <View>
              <Text className="text-sm text-slate-500">Recommended Actions</Text>

              <View className="mt-3 space-y-2">
                <Text className="p-3 bg-amber-50 rounded-lg">
                  Schedule Inspection — Priority: <Text className="font-bold">{pole.risk}</Text>
                </Text>

                <Text className="p-3 bg-rose-50 rounded-lg">
                  Flag for Replacement if lean &gt; 12°
                </Text>

                <Text className="p-3 bg-sky-50 rounded-lg">
                  Environmental Notice: Avoid maintenance during nesting season
                </Text>
              </View>

              <View className="mt-4 flex-row gap-2">
                <Pressable className="px-4 py-2 rounded-lg bg-emerald-600">
                  <Text className="text-white">Schedule Team</Text>
                </Pressable>

                <Pressable className="px-4 py-2 rounded-lg bg-slate-100">
                  <Text>Export Report</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ---------------------------
// Main Dashboard
// ---------------------------
export default function PoleVisionMockup() {
  const [selected, setSelected] = useState<any>(null);
  const [city, setCity] = useState("Kampala");

  const rows = [
    {
      id: "P-00933",
      type: "Power",
      owner: "UMEME",
      condition: "Leaning",
      risk: "High",
      location: "Kampala - KLA-24A",
      analysis: { lean: 11, woodRot: true, veg: 1.2, wildlife: true },
    },
    {
      id: "T-22188",
      type: "Telecom",
      owner: "ISP A",
      condition: "OK",
      risk: "Med",
      location: "Kampala - KLA-55C",
      analysis: { lean: 2, woodRot: false, veg: 3.4, wildlife: false },
    },
    {
      id: "T-22190",
      type: "Telecom",
      owner: "ISP B",
      condition: "Clutter",
      risk: "High",
      location: "Kampala - KLA-55D",
      analysis: { lean: 4, woodRot: false, veg: 0.6, wildlife: false },
    },
    {
      id: "S-99423",
      type: "StreetLight",
      owner: "KCCA",
      condition: "OK",
      risk: "Low",
      location: "Kampala - KLA-11Z",
      analysis: { lean: 0, woodRot: false, veg: 4.0, wildlife: false },
    },
  ];

  const kpis = [
    { title: "Total Poles", value: "2,435,991", delta: "+2.1% MoM", note: "All registered infrastructure" },
    { title: "High-Risk Poles", value: "139,442", delta: "-1.3% MoM", note: "Flagged for immediate action" },
    { title: "Telecom Clutter Zones", value: "1,933", delta: "+7% MoM", note: "High redundancy areas" },
    { title: "Wildlife-sensitive Zones", value: "388", delta: "—", note: "Environmental overlays" },
  ];

  return (
    <ScrollView className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="text-2xl font-bold">PoleVision™ Dashboard</Text>
          <Text className="text-sm text-slate-500">
            Unified pole monitoring for power, telecom & environment
          </Text>
        </View>

        <View className="flex-row items-center gap-3">
          <Pressable className="px-3 py-2 rounded-lg bg-white shadow">
            <Text className="text-sm">New Scan</Text>
          </Pressable>

          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=64&q=60",
            }}
            className="w-10 h-10 rounded-full"
          />
        </View>
      </View>

      {/* KPIs */}
      <View className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <KPI key={k.title} title={k.title} value={k.value} delta={k.delta}>
            {k.note}
          </KPI>
        ))}
      </View>

      {/* Map Section */}
      <View className="bg-white p-4 rounded-2xl shadow mt-6">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-semibold">City Overview</Text>

          <View className="flex-row gap-2 items-center">
            <Picker
              selectedValue={city}
              onValueChange={setCity}
              style={{ width: 140, height: 38 }}
            >
              <Picker.Item label="Kampala" value="Kampala" />
              <Picker.Item label="Nairobi" value="Nairobi" />
              <Picker.Item label="Lagos" value="Lagos" />
            </Picker>

            <Pressable className="px-3 py-2 rounded-lg bg-slate-100">
              <Text>Filters</Text>
            </Pressable>
          </View>
        </View>

        <MapPlaceholder />

        <View className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Text className="p-3 bg-sky-50 rounded-lg">
            Hotspots: Jinja Rd, Ntinda, Bukoto
          </Text>
          <Text className="p-3 bg-rose-50 rounded-lg">
            Critical: 112 poles need urgent inspection
          </Text>
          <Text className="p-3 bg-emerald-50 rounded-lg">
            Environmental: 38 nesting zones nearby
          </Text>
        </View>
      </View>

      {/* Table */}
      <View className="bg-white p-4 rounded-2xl shadow mt-6">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-lg font-semibold">Pole Registry</Text>
          <Text className="text-sm text-slate-500">Tap a row to open detail</Text>
        </View>

        <DataTable rows={rows} onSelect={setSelected} />
      </View>

      {/* Modal */}
      <PoleDetailModal pole={selected} onClose={() => setSelected(null)} />

      {/* Footer */}
      <View className="mt-10 items-center">
        <Text className="text-xs text-slate-400">
          PoleVision™
        </Text>
      </View>
    </ScrollView>
  );
}