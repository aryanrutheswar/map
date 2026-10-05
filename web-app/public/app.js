// Map Studio Controller
document.addEventListener('DOMContentLoaded', () => {
  // Single World Bounds (Prevents horizontal world duplication / multiplication)
  const worldBounds = L.latLngBounds(
    L.latLng(-85.05112878, -180),
    L.latLng(85.05112878, 180)
  );

  // Tile Layers (Live 2026 Google Maps Engine with noWrap enabled)
  const tileProviders = {
    googleDark: L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      attribution: '&copy; 2026 Google Maps',
      className: 'google-dark-tiles',
      maxNativeZoom: 21,
      maxZoom: 22,
      noWrap: true,
      bounds: worldBounds
    }),
    googleRoads: L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      attribution: '&copy; 2026 Google Maps',
      maxNativeZoom: 21,
      maxZoom: 22,
      noWrap: true,
      bounds: worldBounds
    }),
    googleSat: L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      attribution: '&copy; 2026 Google Imagery',
      maxNativeZoom: 21,
      maxZoom: 22,
      noWrap: true,
      bounds: worldBounds
    }),
    googleTerrain: L.tileLayer('https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      attribution: '&copy; 2026 Google Terrain',
      maxNativeZoom: 21,
      maxZoom: 22,
      noWrap: true,
      bounds: worldBounds
    })
  };

  // Initial State: Whole World Map
  const initialCenter = [20, 0];
  const initialZoom = 3;

  // Initialize Map strictly constrained to a single world view
  const map = L.map('map', {
    center: initialCenter,
    zoom: initialZoom,
    minZoom: 3,
    maxZoom: 22,
    maxBounds: worldBounds,
    maxBoundsViscosity: 1.0,
    zoomControl: false,
    layers: [tileProviders.googleRoads]
  });

  // App State
  let currentLayer = 'dark';
  let activeTool = 'pan';
  let markers = [];
  let routePolyline = null;
  let simulatedVehicle = null;
  let simulationTimer = null;
  let geofenceCircle = null;

  // Elements
  const hudCoords = document.getElementById('hudCoords');
  const hudZoom = document.getElementById('hudZoom');
  const hudMarkersCount = document.getElementById('hudMarkersCount');
  const jsxCodeElem = document.getElementById('jsxCode');
  const codeDrawer = document.getElementById('codeDrawer');
  const toggleCodeBtn = document.getElementById('toggleCodeBtn');
  const closeDrawerBtn = document.getElementById('closeDrawerBtn');
  const copyCodeBtn = document.getElementById('copyCodeBtn');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  const locateBtn = document.getElementById('locateBtn');
  const toast = document.getElementById('toast');

  // Custom Icon
  const createPinIcon = (color = '#6366f1') => {
    return L.divIcon({
      className: 'custom-pin',
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background: ${color};
          border: 3px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 14px rgba(0,0,0,0.5), 0 0 16px ${color};
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="width: 8px; height: 8px; background: #ffffff; border-radius: 50%; transform: rotate(45deg);"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });
  };

  function removeMarker(marker) {
    if (!marker) return;
    map.removeLayer(marker);
    markers = markers.filter((m) => m !== marker);
    updateHUD();
    updateJSX();
    showToast('Pin removed');
  }

  function addMarkerAt(lat, lng, title = `Marker #${markers.length + 1}`) {
    const marker = L.marker([lat, lng], {
      icon: createPinIcon('#6366f1'),
      draggable: true
    }).addTo(map);

    const popupContent = document.createElement('div');
    popupContent.innerHTML = `
      <div style="min-width: 160px;">
        <div class="custom-popup-title">${title}</div>
        <div class="custom-popup-coords">${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
        <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 10px; color: #94a3b8;">Right-click to delete</span>
          <button class="popup-delete-btn" style="
            background: rgba(244, 63, 94, 0.15);
            color: #f43f5e;
            border: 1px solid rgba(244, 63, 94, 0.35);
            border-radius: 6px;
            padding: 3px 8px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
          ">🗑️ Delete</button>
        </div>
      </div>
    `;

    const delBtn = popupContent.querySelector('.popup-delete-btn');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeMarker(marker);
      });
    }

    marker.bindPopup(popupContent);

    // Right-click or long-press on pin directly removes it
    marker.on('contextmenu', (e) => {
      L.DomEvent.stopPropagation(e);
      removeMarker(marker);
    });

    marker.on('dragend', () => {
      updateHUD();
      updateJSX();
    });

    markers.push(marker);
    updateHUD();
    updateJSX();
    return marker;
  }

  // Update HUD
  function updateHUD() {
    const center = map.getCenter();
    hudCoords.textContent = `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`;
    hudZoom.textContent = map.getZoom();
    hudMarkersCount.textContent = markers.length;
  }

  map.on('move', updateHUD);
  map.on('zoomend', updateHUD);

  // Map Click Handler
  map.on('click', (e) => {
    if (activeTool === 'marker') {
      addMarkerAt(e.latlng.lat, e.latlng.lng);
    } else if (activeTool === 'geofence') {
      drawGeofence(e.latlng.lat, e.latlng.lng);
    }
  });

  // Layer Switching
  document.querySelectorAll('.layer-pill').forEach((pill) => {
    pill.addEventListener('click', (e) => {
      document.querySelectorAll('.layer-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      const target = pill.getAttribute('data-layer');
      
      // Remove all
      Object.values(tileProviders).forEach((layer) => map.removeLayer(layer));
      
      if (target === 'googleRoads') tileProviders.googleRoads.addTo(map);
      if (target === 'googleSat') tileProviders.googleSat.addTo(map);
      if (target === 'googleTerrain') tileProviders.googleTerrain.addTo(map);
    });
  });

  // Tools Selection (Guarded)
  const addMarkerBtn = document.getElementById('addMarkerBtn');
  const drawGeofenceBtn = document.getElementById('drawGeofenceBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');

  function setActiveTool(tool, element) {
    activeTool = tool;
    document.querySelectorAll('.tool-btn').forEach((btn) => btn.classList.remove('active'));
    if (element) element.classList.add('active');
  }

  if (addMarkerBtn) {
    addMarkerBtn.addEventListener('click', () => setActiveTool('marker', addMarkerBtn));
  }
  
  if (drawGeofenceBtn) {
    drawGeofenceBtn.addEventListener('click', () => {
      setActiveTool('geofence', drawGeofenceBtn);
      if (!geofenceCircle) {
        const c = map.getCenter();
        drawGeofence(c.lat, c.lng);
      }
    });
  }

  function drawGeofence(lat, lng) {
    if (geofenceCircle) map.removeLayer(geofenceCircle);
    geofenceCircle = L.circle([lat, lng], {
      radius: 1200,
      color: '#06b6d4',
      fillColor: '#06b6d4',
      fillOpacity: 0.2,
      weight: 2
    }).addTo(map);
    updateJSX();
  }

  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      markers.forEach((m) => map.removeLayer(m));
      markers = [];
      if (geofenceCircle) map.removeLayer(geofenceCircle);
      geofenceCircle = null;
      updateHUD();
      updateJSX();
    });
  }

  // Live GPS Tracking System
  let userBeaconMarker = null;
  let userAccuracyCircle = null;
  let watchId = null;
  let isTrackingLive = false;
  let hasCenteredInitial = false;

  const userBeaconIcon = L.divIcon({
    className: 'user-live-beacon-container',
    html: `
      <div class="user-live-beacon">
        <div class="pulse-ring"></div>
        <div class="core-dot"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14]
  });

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  async function reverseGeocode(lat, lng) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      if (data && data.address) {
        const city = data.address.city || data.address.town || data.address.village || data.address.suburb || data.address.county || 'Your Area';
        const country = data.address.country || '';
        return `${city}, ${country}`;
      }
    } catch (e) {
      console.warn('Reverse geocode error:', e);
    }
    return 'Your Current Location';
  }

  function handleLocationUpdate(pos, shouldFlyTo = false) {
    const { latitude, longitude, accuracy } = pos.coords;

    // Create or update animated GPS beacon
    if (!userBeaconMarker) {
      userBeaconMarker = L.marker([latitude, longitude], {
        icon: userBeaconIcon,
        zIndexOffset: 1000
      }).addTo(map);

      userBeaconMarker.bindPopup(`
        <div>
          <div class="custom-popup-title">🎯 Detecting Area...</div>
          <div class="custom-popup-coords">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Live GPS (±${Math.round(accuracy)}m)</div>
        </div>
      `);
    } else {
      userBeaconMarker.setLatLng([latitude, longitude]);
    }

    // Create or update accuracy radius circle
    if (!userAccuracyCircle) {
      userAccuracyCircle = L.circle([latitude, longitude], {
        radius: Math.max(accuracy, 30),
        color: '#06b6d4',
        fillColor: '#06b6d4',
        fillOpacity: 0.12,
        weight: 1.5,
        dashArray: '4, 4'
      }).addTo(map);
    } else {
      userAccuracyCircle.setLatLng([latitude, longitude]);
      userAccuracyCircle.setRadius(Math.max(accuracy, 30));
    }

    if (shouldFlyTo) {
      map.flyTo([latitude, longitude], 16, { duration: 1.6 });

      reverseGeocode(latitude, longitude).then((addr) => {
        if (userBeaconMarker) {
          userBeaconMarker.setPopupContent(`
            <div>
              <div class="custom-popup-title">🎯 ${addr}</div>
              <div class="custom-popup-coords">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Live GPS (±${Math.round(accuracy)}m)</div>
            </div>
          `);
        }
        showToast(`📍 Located: ${addr}`);
      });
    } else {
      reverseGeocode(latitude, longitude).then((addr) => {
        if (userBeaconMarker) {
          userBeaconMarker.setPopupContent(`
            <div>
              <div class="custom-popup-title">🎯 ${addr}</div>
              <div class="custom-popup-coords">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Live GPS (±${Math.round(accuracy)}m)</div>
            </div>
          `);
        }
      });
    }

    updateHUD();
    updateJSX();
  }

  function startLiveLocationTracking(shouldFly = false) {
    if (!navigator.geolocation) {
      return;
    }

    locateBtn.classList.add('tracking-active');
    locateBtn.innerHTML = `
      <span class="pulse-dot" style="background: #10b981;"></span>
      <span>Live GPS Active</span>
    `;
    isTrackingLive = true;

    navigator.geolocation.getCurrentPosition(
      (pos) => handleLocationUpdate(pos, shouldFly),
      (err) => {
        console.warn('Geolocation error:', err.message);
        locateBtn.classList.remove('tracking-active');
        locateBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span>Locate Me</span>
        `;
        isTrackingLive = false;
        showToast('Please allow location permission in your browser');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = navigator.geolocation.watchPosition(
      (pos) => handleLocationUpdate(pos, false),
      (err) => console.warn('Live watch error:', err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
    );
  }

  // Toggle or re-center on click
  locateBtn.addEventListener('click', () => {
    if (userBeaconMarker) {
      map.flyTo(userBeaconMarker.getLatLng(), 16, { duration: 1.2 });
      showToast('Re-centered on your location');
    } else {
      startLiveLocationTracking(true);
    }
  });

  // Automatically detect live location on load!
  startLiveLocationTracking();

  // Google Maps Style Navigation Controls (Locate + Zoom In/Out)
  const navLocateBtn = document.getElementById('navLocateBtn');
  const navZoomInBtn = document.getElementById('navZoomInBtn');
  const navZoomOutBtn = document.getElementById('navZoomOutBtn');

  if (navZoomInBtn) {
    navZoomInBtn.addEventListener('click', () => {
      map.zoomIn();
    });
  }

  if (navZoomOutBtn) {
    navZoomOutBtn.addEventListener('click', () => {
      map.zoomOut();
    });
  }

  if (navLocateBtn) {
    navLocateBtn.addEventListener('click', () => {
      if (userBeaconMarker) {
        map.flyTo(userBeaconMarker.getLatLng(), 17, { duration: 1.2 });
        showToast('Centered on your live location');
      } else {
        startLiveLocationTracking(true);
      }
    });
  }

  // Location Search (Nominatim API)
  let debounceTimeout = null;
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(debounceTimeout);
    if (query.length < 3) {
      searchResults.classList.remove('show');
      searchResults.innerHTML = '';
      return;
    }

    debounceTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        searchResults.innerHTML = '';
        if (data && data.length > 0) {
          data.slice(0, 5).forEach((item) => {
            const div = document.createElement('div');
            div.className = 'search-item';
            div.textContent = item.display_name;
            div.addEventListener('click', () => {
              const lat = parseFloat(item.lat);
              const lon = parseFloat(item.lon);
              map.flyTo([lat, lon], 14, { duration: 1.5 });
              addMarkerAt(lat, lon, item.display_name.split(',')[0]);
              searchResults.classList.remove('show');
              searchInput.value = item.display_name.split(',')[0];
            });
            searchResults.appendChild(div);
          });
          searchResults.classList.add('show');
        } else {
          searchResults.classList.remove('show');
        }
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 350);
  });

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.classList.remove('show');
    }
  });

  // Synchronized React Native Maps JSX Generator
  function updateJSX() {
    const center = map.getCenter();
    const zoom = map.getZoom();
    const latDelta = (360 / Math.pow(2, zoom)) * (window.innerHeight / 256);
    const lngDelta = (360 / Math.pow(2, zoom)) * (window.innerWidth / 256);

    let markersJSX = markers
      .map((m, idx) => {
        const pos = m.getLatLng();
        return `    <Marker
      key="${idx}"
      coordinate={{ latitude: ${pos.lat.toFixed(5)}, longitude: ${pos.lng.toFixed(5)} }}
      title="Marker #${idx + 1}"
      pinColor="#6366f1"
    />`;
      })
      .join('\n');

    let circleJSX = '';
    if (geofenceCircle) {
      const pos = geofenceCircle.getLatLng();
      circleJSX = `\n    <Circle
      center={{ latitude: ${pos.lat.toFixed(5)}, longitude: ${pos.lng.toFixed(5)} }}
      radius={1200}
      fillColor="rgba(6, 182, 212, 0.2)"
      strokeColor="#06b6d4"
      strokeWidth={2}
    />`;
    }

    let polylineJSX = '';
    if (routePolyline) {
      const latlngs = routePolyline.getLatLngs();
      const coordsStr = latlngs.map((ll) => `{ latitude: ${ll.lat.toFixed(5)}, longitude: ${ll.lng.toFixed(5)} }`).join(', ');
      polylineJSX = `\n    <Polyline
      coordinates={[${coordsStr}]}
      strokeColor="#6366f1"
      strokeWidth={4}
      lineDashPattern={[10, 5]}
    />`;
    }

    const code = `import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

export default function MyMapView() {
  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: ${center.lat.toFixed(5)},
          longitude: ${center.lng.toFixed(5)},
          latitudeDelta: ${latDelta.toFixed(4)},
          longitudeDelta: ${lngDelta.toFixed(4)},
        }}
      >
${markersJSX}${circleJSX}${polylineJSX}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});`;

    if (jsxCodeElem) {
      jsxCodeElem.textContent = code;
    }
  }

  // Drawer Toggle (Guarded)
  if (toggleCodeBtn && codeDrawer) {
    toggleCodeBtn.addEventListener('click', () => codeDrawer.classList.toggle('open'));
  }
  if (closeDrawerBtn && codeDrawer) {
    closeDrawerBtn.addEventListener('click', () => codeDrawer.classList.remove('open'));
  }

  // Copy JSX Code (Guarded)
  if (copyCodeBtn && jsxCodeElem) {
    copyCodeBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(jsxCodeElem.textContent).then(() => {
        showToast('React Native code copied to clipboard!');
      });
    });
  }

  // Initial JSX build
  updateJSX();
});
