import { View } from "react-native";
import MapView, { Marker, UrlTile } from "react-native-maps";

import { Text } from "@sethu/ui";

// The live map the customer watches their technician on. Uses a controlled `region`, so as the
// polled location updates the map re-centres and the marker moves — the "approaching" effect.
// OpenStreetMap tiles now; switching to Google later is provider={PROVIDER_GOOGLE} + drop the tile.
export function TechnicianMap({ lat, lng, label }: { lat?: number; lng?: number; label?: string }) {
  if (lat == null || lng == null) return null;

  return (
    <View className="overflow-hidden rounded-card" style={{ height: 220 }}>
      <MapView
        style={{ flex: 1 }}
        region={{ latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />
        <Marker coordinate={{ latitude: lat, longitude: lng }} title={label} />
      </MapView>
      <View className="absolute bottom-0 right-0 bg-surface/70 px-1">
        <Text variant="caption" tone="muted">
          © OpenStreetMap
        </Text>
      </View>
    </View>
  );
}
