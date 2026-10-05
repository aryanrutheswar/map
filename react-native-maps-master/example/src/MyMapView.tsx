import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';
import MapView, {
  Marker,
  Circle,
  Polyline,
  Callout,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
  type Region,
  type Camera,
} from 'react-native-maps';

const { width, height } = Dimensions.get('window');

// High-Contrast Cyberpunk / Midnight Dark Map Style for Google Maps
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#4b6878' }],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64779e' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#334e87' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#023e58' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#283d6a' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6f9ba5' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#304a7d' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#98a5be' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#1d2c4d' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#2c6675' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#2f3948' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0e1626' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4e6d70' }],
  },
];

const INITIAL_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const WAYPOINTS = [
  { latitude: 37.7749, longitude: -122.4194 },
  { latitude: 37.7833, longitude: -122.4167 },
  { latitude: 37.7900, longitude: -122.4014 },
  { latitude: 37.8024, longitude: -122.4058 },
];

export default function MyMapView() {
  const mapRef = useRef<MapView>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [markerCoord, setMarkerCoord] = useState({
    latitude: 37.7749,
    longitude: -122.4194,
  });
  const [currentCity, setCurrentCity] = useState('San Francisco');

  // Animated Camera Fly-To function
  const flyTo = (latitude: number, longitude: number, city: string) => {
    setCurrentCity(city);
    setMarkerCoord({ latitude, longitude });

    const newCamera: Camera = {
      center: { latitude, longitude },
      pitch: 45, // 3D tilt perspective
      heading: 90, // compass bearing
      altitude: 1200,
      zoom: 15,
    };

    mapRef.current?.animateCamera(newCamera, { duration: 2000 });
  };

  // Reset to default region with 0 tilt
  const resetCamera = () => {
    mapRef.current?.animateToRegion(INITIAL_REGION, 1000);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Map Surface */}
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        customMapStyle={isDarkMode ? darkMapStyle : []}
        showsUserLocation={true}
        followsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        onUserLocationChange={(e) => {
          if (e.nativeEvent?.coordinate) {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            setMarkerCoord({ latitude, longitude });
          }
        }}
      >
        {/* Draggable Interactive Marker with Custom Callout */}
        <Marker
          draggable
          coordinate={markerCoord}
          onDragEnd={(e) => setMarkerCoord(e.nativeEvent.coordinate)}
          title="Interactive Pin"
          description="Drag me anywhere!"
        >
          <View style={styles.customPin}>
            <Text style={styles.pinIcon}>📍</Text>
          </View>
          <Callout tooltip>
            <View style={styles.calloutCard}>
              <Text style={styles.calloutTitle}>📍 {currentCity}</Text>
              <Text style={styles.calloutSub}>
                Lat: {markerCoord.latitude.toFixed(4)}
              </Text>
              <Text style={styles.calloutSub}>
                Lng: {markerCoord.longitude.toFixed(4)}
              </Text>
              <Text style={styles.calloutHint}>✓ Long-press & drag pin</Text>
            </View>
          </Callout>
        </Marker>

        {/* Geofence Perimeter Circle */}
        <Circle
          center={markerCoord}
          radius={800}
          strokeColor={isDarkMode ? '#06b6d4' : '#6366f1'}
          fillColor={
            isDarkMode ? 'rgba(6, 182, 212, 0.15)' : 'rgba(99, 102, 241, 0.15)'
          }
          strokeWidth={2}
        />

        {/* Navigation Route Polyline */}
        <Polyline
          coordinates={WAYPOINTS}
          strokeColor="#10b981"
          strokeWidth={4}
          lineDashPattern={[8, 4]}
        />
      </MapView>

      {/* Top Floating Telemetry Header */}
      <SafeAreaView style={styles.topOverlay}>
        <View style={styles.telemetryCard}>
          <View style={styles.telemetryInfo}>
            <Text style={styles.telemetryLabel}>ACTIVE LOCATION</Text>
            <Text style={styles.telemetryValue}>{currentCity}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.themeToggleBtn,
              { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' },
            ]}
            onPress={() => setIsDarkMode(!isDarkMode)}
          >
            <Text style={styles.themeToggleText}>
              {isDarkMode ? '🌙 Dark' : '☀️ Light'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Bottom Floating Action Bar */}
      <SafeAreaView style={styles.bottomOverlay}>
        <View style={styles.actionsBar}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => flyTo(37.7749, -122.4194, 'San Francisco')}
          >
            <Text style={styles.actionBtnText}>🌉 SF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => flyTo(40.7128, -74.006, 'New York')}
          >
            <Text style={styles.actionBtnText}>🗽 NYC</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => flyTo(35.6762, 139.6503, 'Tokyo')}
          >
            <Text style={styles.actionBtnText}>🗼 Tokyo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnAccent]}
            onPress={resetCamera}
          >
            <Text style={[styles.actionBtnText, styles.actionBtnAccentText]}>
              🎯 Reset
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  customPin: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  pinIcon: {
    fontSize: 20,
  },
  calloutCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    minWidth: 160,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  calloutSub: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  calloutHint: {
    fontSize: 10,
    color: '#10b981',
    marginTop: 6,
    fontWeight: '600',
  },
  topOverlay: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
  },
  telemetryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  telemetryInfo: {
    flexDirection: 'column',
  },
  telemetryLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#64748b',
  },
  telemetryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
  },
  themeToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  themeToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f8fafc',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f8fafc',
  },
  actionBtnAccent: {
    backgroundColor: '#6366f1',
  },
  actionBtnAccentText: {
    color: '#ffffff',
  },
});
