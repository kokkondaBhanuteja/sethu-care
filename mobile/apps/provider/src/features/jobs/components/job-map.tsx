import { View } from "react-native";
import MapView, { Marker, UrlTile } from "react-native-maps";

import { Text } from "@sethu/ui";

// A small map preview of the job location, rendered with OpenStreetMap tiles (a UrlTile overlay on
// the platform base map). Switching to Google later is a one-line change: set
// provider={PROVIDER_GOOGLE} and drop the UrlTile (plus a Google Maps API key). Non-interactive on
// purpose so it doesn't fight the surrounding ScrollView — the "Navigate" button opens full maps.
export function JobMap({ lat, lng, label }: { lat?: number; lng?: number; label?: string }) {
  if (lat == null || lng == null || (lat === 0 && lng === 0)) return null;

  return (
    <View className="overflow-hidden rounded-md" style={{ height: 180 }}>
      <MapView
        style={{ flex: 1 }}
        pointerEvents="none"
        initialRegion={{
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        }}
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
