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
    doubleClickZoom: false,
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
  // Toast helper
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  // ============================================================
  // POINTS OF INTEREST (POIs) ENGINE
  // Temples, Hotels, Cafes, Parks, Malls & Tourist Sights
  // ============================================================
  const POI_CATEGORIES = {
    temple: {
      id: 'temple',
      label: 'Temple',
      plural: 'Temples',
      emoji: '🛕',
      color: '#f59e0b',
      bg: 'linear-gradient(135deg, #f59e0b, #d97706)'
    },
    hotel: {
      id: 'hotel',
      label: 'Hotel',
      plural: 'Hotels',
      emoji: '🏨',
      color: '#8b5cf6',
      bg: 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
    },
    cafe: {
      id: 'cafe',
      label: 'Cafe',
      plural: 'Cafes',
      emoji: '☕',
      color: '#ec4899',
      bg: 'linear-gradient(135deg, #ec4899, #db2777)'
    },
    park: {
      id: 'park',
      label: 'Park',
      plural: 'Parks',
      emoji: '🌳',
      color: '#10b981',
      bg: 'linear-gradient(135deg, #10b981, #059669)'
    },
    mall: {
      id: 'mall',
      label: 'Mall',
      plural: 'Shopping Malls',
      emoji: '🛍️',
      color: '#3b82f6',
      bg: 'linear-gradient(135deg, #3b82f6, #2563eb)'
    },
    tourist: {
      id: 'tourist',
      label: 'Tourist Sight',
      plural: 'Tourist Sights',
      emoji: '🏛️',
      color: '#06b6d4',
      bg: 'linear-gradient(135deg, #06b6d4, #0891b2)'
    }
  };

  function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Curated Local Places in and around Chittoor, Andhra Pradesh
  const CHITTOOR_POIS = [
    // --- TEMPLES 🛕 in & around Chittoor ---
    { id: 'ch_t1', name: 'Sri Varasidhi Vinayaka Swamy Temple', category: 'temple', lat: 13.2770145, lng: 79.0335591, city: 'Kanipakam, Chittoor', country: 'India' },
    { id: 'ch_t2', name: 'Arthagiri Veeranjaneya Swamy Temple', category: 'temple', lat: 13.2948055, lng: 78.9511342, city: 'Aragonda, Chittoor', country: 'India' },
    { id: 'ch_t3', name: 'Manikandeshwar Temple', category: 'temple', lat: 13.2776452, lng: 79.0335196, city: 'Kanipakam, Chittoor', country: 'India' },
    { id: 'ch_t4', name: 'Subramanya Swamy Temple', category: 'temple', lat: 13.2054343, lng: 79.0961034, city: 'Chittoor Town', country: 'India' },
    { id: 'ch_t5', name: 'Mogili Mogileeswara Swamy Temple', category: 'temple', lat: 13.2350, lng: 79.0200, city: 'Mogili, Chittoor', country: 'India' },
    { id: 'ch_t6', name: 'Vajralapuram Gangamma Temple', category: 'temple', lat: 13.2244888, lng: 78.9170747, city: 'Chittoor Rural', country: 'India' },
    { id: 'ch_t7', name: 'Sri Seetharama Temple', category: 'temple', lat: 13.2548692, lng: 79.1241736, city: 'Chittoor', country: 'India' },
    { id: 'ch_t8', name: 'Gauramma Thalli Temple', category: 'temple', lat: 13.2213395, lng: 78.9330431, city: 'Chittoor', country: 'India' },
    { id: 'ch_t9', name: 'Palakanuru Gangamma Temple', category: 'temple', lat: 13.1790843, lng: 79.1476275, city: 'Chittoor Mandal', country: 'India' },
    { id: 'ch_t10', name: 'Sri Badhrakali Amma Temple', category: 'temple', lat: 13.0803981, lng: 79.1361819, city: 'Chittoor District', country: 'India' },
    { id: 'ch_t11', name: 'Krishna Temple Gollapalle', category: 'temple', lat: 13.175692, lng: 79.1488378, city: 'Chittoor', country: 'India' },

    // --- HOTELS 🏨 in & around Chittoor ---
    { id: 'ch_h1', name: 'Bans The Hotel', category: 'hotel', lat: 13.2185, lng: 79.1020, city: 'Chittoor Central', country: 'India' },
    { id: 'ch_h2', name: 'Hotel Bliss Grand', category: 'hotel', lat: 13.2140, lng: 79.0980, city: 'Bypass Road, Chittoor', country: 'India' },
    { id: 'ch_h3', name: 'Naga Residency', category: 'hotel', lat: 13.2195, lng: 79.1040, city: 'Chittoor', country: 'India' },
    { id: 'ch_h4', name: 'Hotel Sri Kanya', category: 'hotel', lat: 13.2160, lng: 79.1010, city: 'Chittoor', country: 'India' },
    { id: 'ch_h5', name: 'Kanipakam Devasthanam Cottages', category: 'hotel', lat: 13.2760, lng: 79.0320, city: 'Kanipakam, Chittoor', country: 'India' },

    // --- CAFES ☕ in & around Chittoor ---
    { id: 'ch_c1', name: 'Cafe Coffee Day', category: 'cafe', lat: 13.1971587, lng: 79.0642167, city: 'NH-69, Chittoor', country: 'India' },
    { id: 'ch_c2', name: 'Padmasri Cafe', category: 'cafe', lat: 13.0876466, lng: 79.0592971, city: 'Chittoor', country: 'India' },
    { id: 'ch_c3', name: 'Tea / Coffee Bakery', category: 'cafe', lat: 13.196889, lng: 78.9927895, city: 'Chittoor Highway', country: 'India' },
    { id: 'ch_c4', name: 'Sri Krishna Bakery & Cafe', category: 'cafe', lat: 13.2155, lng: 79.1035, city: 'Bazaar Street, Chittoor', country: 'India' },

    // --- PARKS 🌳 in & around Chittoor ---
    { id: 'ch_p1', name: 'Gandhi Park Chittoor', category: 'park', lat: 13.2165, lng: 79.1005, city: 'Chittoor', country: 'India' },
    { id: 'ch_p2', name: 'Kaigal Waterfalls Nature Park', category: 'park', lat: 13.0820, lng: 78.6830, city: 'Kaigal, Chittoor', country: 'India' },
    { id: 'ch_p3', name: 'Aragonda Botanical Park', category: 'park', lat: 13.3000, lng: 78.9600, city: 'Aragonda, Chittoor', country: 'India' },
    { id: 'ch_p4', name: 'Koundinya Wildlife Reserve', category: 'park', lat: 13.1500, lng: 78.8500, city: 'Chittoor District', country: 'India' },

    // --- SHOPPING MALLS 🛍️ in Chittoor ---
    { id: 'ch_m1', name: 'Reliance Mart Chittoor', category: 'mall', lat: 13.2047983, lng: 79.0971088, city: 'Chittoor', country: 'India' },
    { id: 'ch_m2', name: 'CMR Shopping Mall', category: 'mall', lat: 13.2175, lng: 79.1015, city: 'Gandhi Road, Chittoor', country: 'India' },
    { id: 'ch_m3', name: 'Kalanikethan Shopping Centre', category: 'mall', lat: 13.2180, lng: 79.1030, city: 'Chittoor', country: 'India' },
    { id: 'ch_m4', name: 'South India Shopping Mall', category: 'mall', lat: 13.2168, lng: 79.1022, city: 'High Road, Chittoor', country: 'India' },

    // --- TOURIST SIGHTS 🏛️ in & around Chittoor ---
    { id: 'ch_s1', name: 'Kaigal Falls (Dumukurallu Waterfalls)', category: 'tourist', lat: 13.0820, lng: 78.6830, city: 'Kaigal, Chittoor', country: 'India' },
    { id: 'ch_s2', name: 'Chittoor Historic Clock Tower', category: 'tourist', lat: 13.2170, lng: 79.1008, city: 'Chittoor Centre', country: 'India' },
    { id: 'ch_s3', name: 'Gurramkonda Historic Hill Fort', category: 'tourist', lat: 13.7800, lng: 78.5800, city: 'Gurramkonda, Chittoor', country: 'India' },
    { id: 'ch_s4', name: 'Horsley Hills Hill Station', category: 'tourist', lat: 13.6500, lng: 78.4000, city: 'Chittoor District', country: 'India' }
  ];

  // Geodetic Distance Calculation (Haversine formula in km)
  function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Active Focus Area State (strictly scopes spots to the chosen place)
  let currentFocusArea = {
    name: 'Chittoor',
    lat: 13.2172,
    lng: 79.1003,
    radiusKm: 30
  };

  // Populate initially with Chittoor spots with calculated distance from Chittoor town center
  let allPOIs = CHITTOOR_POIS.map(p => ({
    ...p,
    distanceKm: calculateDistanceKm(13.2172, 79.1003, p.lat, p.lng)
  }));
  allPOIs.sort((a, b) => a.distanceKm - b.distanceKm);

  let activeCategory = 'all';
  const poiLayerGroup = L.layerGroup().addTo(map);
  const activeMarkersMap = {};

  // Elements
  const poiCategoryChips = document.querySelectorAll('.poi-chip[data-category]');
  const searchAreaBtn = document.getElementById('searchAreaBtn');
  const searchAreaText = document.getElementById('searchAreaText');
  const chittoorShortcutBtn = document.getElementById('chittoorShortcutBtn');
  const focusAreaBadge = document.getElementById('focusAreaBadge');
  const focusAreaText = document.getElementById('focusAreaText');
  const toggleExploreBtn = document.getElementById('toggleExploreBtn');
  const closeExploreBtn = document.getElementById('closeExploreBtn');
  const exploreDrawer = document.getElementById('exploreDrawer');
  const explorePlacesList = document.getElementById('explorePlacesList');
  const exploreFilterInput = document.getElementById('exploreFilterInput');
  const exploreDrawerTitle = document.getElementById('exploreDrawerTitle');
  const explorePlacesBadge = document.getElementById('explorePlacesBadge');

  // Count Elements
  const countElems = {
    all: document.getElementById('count-all'),
    temple: document.getElementById('count-temple'),
    hotel: document.getElementById('count-hotel'),
    cafe: document.getElementById('count-cafe'),
    park: document.getElementById('count-park'),
    mall: document.getElementById('count-mall'),
    tourist: document.getElementById('count-tourist')
  };

  function createPOIMarkerIcon(category) {
    const meta = POI_CATEGORIES[category] || { emoji: '📍', color: '#6366f1', bg: 'linear-gradient(135deg, #6366f1, #4f46e5)' };
    return L.divIcon({
      className: 'custom-poi-pin',
      html: `
        <div class="poi-pin-bubble" style="background: ${meta.bg}; box-shadow: 0 4px 14px rgba(0,0,0,0.5), 0 0 16px ${meta.color}77;">
          <span class="poi-pin-emoji">${meta.emoji}</span>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -34]
    });
  }

  function createPOIPopupContent(poi) {
    const meta = POI_CATEGORIES[poi.category] || { label: 'Place', emoji: '📍', color: '#6366f1' };
    const distText = poi.distanceKm !== undefined ? (poi.distanceKm < 1 ? Math.round(poi.distanceKm * 1000) + ' m' : poi.distanceKm.toFixed(1) + ' km') : '';
    return `
      <div class="poi-popup-card">
        <div class="poi-popup-badge" style="background: ${meta.color}22; color: ${meta.color}; border: 1px solid ${meta.color}55;">
          <span>${meta.emoji}</span>
          <span>${meta.label}</span>
          ${distText ? `<span style="margin-left: 6px; color: #38bdf8; font-weight: 700;">• 📍 ${distText} away</span>` : ''}
        </div>
        <div class="poi-popup-title">${escapeHTML(poi.name)}</div>
        <div class="poi-popup-coords">${poi.lat.toFixed(5)}, ${poi.lng.toFixed(5)}</div>
        ${poi.city ? `<div style="font-size: 11.5px; color: #cbd5e1;">📍 ${escapeHTML(poi.city)}${poi.country ? ', ' + escapeHTML(poi.country) : ''}</div>` : ''}
        <div class="poi-popup-actions">
          <button class="poi-popup-btn poi-zoom-btn" data-lat="${poi.lat}" data-lng="${poi.lng}">📍 Zoom</button>
          <button class="poi-popup-btn poi-route-to-btn" data-lat="${poi.lat}" data-lng="${poi.lng}" data-name="${escapeHTML(poi.name)}">🚗 Route</button>
          <a class="poi-popup-btn" href="https://www.google.com/maps/search/?api=1&query=${poi.lat},${poi.lng}" target="_blank" rel="noopener">🗺️ Google</a>
        </div>
      </div>
    `;
  }

  function renderPOIs() {
    poiLayerGroup.clearLayers();
    Object.keys(activeMarkersMap).forEach(key => delete activeMarkersMap[key]);

    // Recalculate distances relative to currentFocusArea
    allPOIs.forEach(p => {
      p.distanceKm = calculateDistanceKm(currentFocusArea.lat, currentFocusArea.lng, p.lat, p.lng);
    });

    // Filter places strictly within focus area radius (e.g. 30km of Chittoor or selected city)
    const filterQuery = (exploreFilterInput?.value || '').toLowerCase().trim();
    const visiblePlaces = allPOIs.filter(p => {
      const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
      const matchesSearch = !filterQuery || p.name.toLowerCase().includes(filterQuery) || (p.city && p.city.toLowerCase().includes(filterQuery));
      const withinRadius = p.distanceKm <= currentFocusArea.radiusKm;
      return matchesCategory && matchesSearch && withinRadius;
    });

    // Sort by closest distance first!
    visiblePlaces.sort((a, b) => a.distanceKm - b.distanceKm);

    // Calculate category counts strictly for the current focus area
    const areaPOIs = allPOIs.filter(p => p.distanceKm <= currentFocusArea.radiusKm);
    const counts = { all: areaPOIs.length, temple: 0, hotel: 0, cafe: 0, park: 0, mall: 0, tourist: 0 };
    areaPOIs.forEach(p => {
      if (counts[p.category] !== undefined) counts[p.category]++;
    });

    Object.keys(counts).forEach(cat => {
      if (countElems[cat]) countElems[cat].textContent = counts[cat];
    });

    if (explorePlacesBadge) {
      explorePlacesBadge.textContent = activeCategory === 'all' ? counts.all : counts[activeCategory] || 0;
    }

    // Update Focus Area Badge
    if (focusAreaText) {
      focusAreaText.textContent = `Showing spots in ${currentFocusArea.name}`;
    }
    if (focusAreaBadge) {
      focusAreaBadge.style.display = 'inline-flex';
    }

    // Update Drawer Title
    if (exploreDrawerTitle) {
      const catMeta = POI_CATEGORIES[activeCategory];
      const catName = activeCategory === 'all' ? 'All Places' : (catMeta ? catMeta.emoji + ' ' + catMeta.plural : 'Places');
      exploreDrawerTitle.textContent = `${catName} in ${currentFocusArea.name} (${visiblePlaces.length})`;
    }

    // Add markers to map
    visiblePlaces.forEach(poi => {
      const marker = L.marker([poi.lat, poi.lng], {
        icon: createPOIMarkerIcon(poi.category),
        title: poi.name
      });
      marker.bindPopup(createPOIPopupContent(poi));
      marker.addTo(poiLayerGroup);
      activeMarkersMap[poi.id] = marker;
    });

    // Update Explore Drawer Cards
    if (explorePlacesList) {
      if (visiblePlaces.length === 0) {
        explorePlacesList.innerHTML = `
          <div class="poi-empty-state">
            <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
            <p>No ${activeCategory === 'all' ? 'places' : activeCategory} found within ${currentFocusArea.radiusKm} km of ${escapeHTML(currentFocusArea.name)}.</p>
            <button class="btn btn-sm btn-primary" id="drawerSearchAreaBtn" style="margin-top: 12px;">Search This Area</button>
          </div>
        `;
        const drawerBtn = document.getElementById('drawerSearchAreaBtn');
        if (drawerBtn) drawerBtn.addEventListener('click', searchAreaPOIs);
      } else {
        explorePlacesList.innerHTML = visiblePlaces.map(poi => {
          const meta = POI_CATEGORIES[poi.category] || { emoji: '📍', color: '#6366f1', label: 'Place', bg: '#6366f1' };
          const distStr = poi.distanceKm < 1 ? `${Math.round(poi.distanceKm * 1000)} m` : `${poi.distanceKm.toFixed(1)} km`;
          return `
            <div class="poi-card" data-id="${poi.id}" data-lat="${poi.lat}" data-lng="${poi.lng}">
              <div class="poi-card-icon" style="background: ${meta.bg};">
                ${meta.emoji}
              </div>
              <div class="poi-card-content">
                <div class="poi-card-name">${escapeHTML(poi.name)}</div>
                <div class="poi-card-meta">
                  <span class="poi-card-category" style="color: ${meta.color};">${meta.label}</span>
                  <span class="poi-card-dist">📍 ${distStr}</span>
                  ${poi.city ? `<span>• ${escapeHTML(poi.city)}</span>` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('');

        // Attach card click handlers
        explorePlacesList.querySelectorAll('.poi-card').forEach(card => {
          card.addEventListener('click', () => {
            const id = card.dataset.id;
            const lat = parseFloat(card.dataset.lat);
            const lng = parseFloat(card.dataset.lng);
            map.flyTo([lat, lng], 16, { duration: 1.4 });

            setTimeout(() => {
              const marker = activeMarkersMap[id];
              if (marker) marker.openPopup();
            }, 700);

            if (window.innerWidth < 768 && exploreDrawer) {
              exploreDrawer.classList.remove('open');
            }
          });
        });
      }
    }
  }

  // Focus exclusively on a specific location (Chittoor, searched city, GPS area)
  async function focusOnArea(name, lat, lng, zoom = 14, radiusKm = 25, isUserLocation = false) {
    currentFocusArea = {
      name: name,
      lat: lat,
      lng: lng,
      radiusKm: radiusKm
    };

    map.flyTo([lat, lng], zoom, { duration: 1.4 });

    const distToChittoor = calculateDistanceKm(lat, lng, 13.2172, 79.1003);
    const isChittoor = distToChittoor < 30 || name.toLowerCase().includes('chittoor');

    if (isChittoor) {
      // Use verified Chittoor spots dataset (28 landmarks)
      currentFocusArea.name = 'Chittoor';
      allPOIs = CHITTOOR_POIS.map(p => ({
        ...p,
        distanceKm: calculateDistanceKm(lat, lng, p.lat, p.lng)
      })).filter(p => p.distanceKm <= radiusKm);
      allPOIs.sort((a, b) => a.distanceKm - b.distanceKm);
      renderPOIs();
      showToast(`📍 Showing ${allPOIs.length} spots in Chittoor only`);
    } else {
      // Clear out unrelated spots, keep only spots in this radius if any, then fetch live
      allPOIs = allPOIs
        .map(p => ({ ...p, distanceKm: calculateDistanceKm(lat, lng, p.lat, p.lng) }))
        .filter(p => p.distanceKm <= radiusKm);
      renderPOIs();
      await fetchLocalSpotsForArea(lat, lng, name, radiusKm);
    }
  }

  // Live Overpass API Search for any selected place worldwide
  async function fetchLocalSpotsForArea(lat, lng, name, radiusKm = 25) {
    if (searchAreaBtn) searchAreaBtn.classList.add('loading');
    if (searchAreaText) searchAreaText.textContent = `Finding spots in ${name}...`;

    try {
      const radiusM = Math.min(Math.round(radiusKm * 1000), 30000);
      const query = `[out:json][timeout:15];
(
  node["amenity"="place_of_worship"](around:${radiusM},${lat},${lng});
  node["tourism"="hotel"](around:${radiusM},${lat},${lng});
  node["tourism"="resort"](around:${radiusM},${lat},${lng});
  node["tourism"="guest_house"](around:${radiusM},${lat},${lng});
  node["amenity"="cafe"](around:${radiusM},${lat},${lng});
  node["amenity"="restaurant"](around:${radiusM},${lat},${lng});
  node["leisure"="park"](around:${radiusM},${lat},${lng});
  node["leisure"="garden"](around:${radiusM},${lat},${lng});
  node["shop"="mall"](around:${radiusM},${lat},${lng});
  node["shop"="supermarket"](around:${radiusM},${lat},${lng});
  node["tourism"="attraction"](around:${radiusM},${lat},${lng});
  node["historic"](around:${radiusM},${lat},${lng});
);
out center 60;`;

      const res = await fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query));
      if (!res.ok) throw new Error(`Overpass returned HTTP ${res.status}`);
      const data = await res.json();

      let addedCount = 0;
      if (data && data.elements && data.elements.length > 0) {
        data.elements.forEach((el, idx) => {
          const tags = el.tags || {};
          const spotName = tags.name || tags['name:en'] || tags['name:te'] || tags['name:hi'];
          if (!spotName) return;

          let category = 'tourist';
          if (tags.amenity === 'place_of_worship') category = 'temple';
          else if (tags.tourism === 'hotel' || tags.tourism === 'resort' || tags.tourism === 'guest_house') category = 'hotel';
          else if (tags.amenity === 'cafe' || tags.amenity === 'restaurant') category = 'cafe';
          else if (tags.leisure === 'park' || tags.leisure === 'garden') category = 'park';
          else if (tags.shop === 'mall' || tags.shop === 'supermarket' || tags.shop === 'department_store') category = 'mall';
          else if (tags.tourism === 'attraction' || tags.historic) category = 'tourist';

          const pLat = el.lat || (el.center && el.center.lat);
          const pLng = el.lon || (el.center && el.center.lon);
          if (!pLat || !pLng) return;

          const dist = calculateDistanceKm(lat, lng, pLat, pLng);
          if (dist > radiusKm) return; // Strict local scoping!

          const isDuplicate = allPOIs.some(p => 
            (Math.abs(p.lat - pLat) < 0.0005 && Math.abs(p.lng - pLng) < 0.0005) ||
            p.name.toLowerCase() === spotName.toLowerCase()
          );

          if (!isDuplicate) {
            allPOIs.push({
              id: `spot_${el.id || idx}_${Date.now()}`,
              name: spotName,
              category: category,
              lat: pLat,
              lng: pLng,
              city: tags['addr:city'] || tags['addr:town'] || name,
              country: tags['addr:country'] || '',
              distanceKm: dist
            });
            addedCount++;
          }
        });
      }

      // Sort by closest distance
      allPOIs.sort((a, b) => a.distanceKm - b.distanceKm);
      renderPOIs();

      if (addedCount > 0) {
        showToast(`✨ Found ${addedCount} nearby spots in ${name}!`);
      } else if (allPOIs.length > 0) {
        showToast(`Showing ${allPOIs.length} spots in ${name}.`);
      } else {
        showToast(`No spots found in ${name}. Try zooming in or panning.`);
      }
    } catch (err) {
      console.warn('Overpass fetch error:', err);
      showToast(`Notice: Live search unavailable for ${name}. Try again shortly.`);
    } finally {
      if (searchAreaBtn) searchAreaBtn.classList.remove('loading');
      if (searchAreaText) searchAreaText.textContent = 'Search This Area';
    }
  }

  // Triggered when user clicks "Search This Area" button
  async function searchAreaPOIs() {
    const center = map.getCenter();
    const currentZoom = Math.max(map.getZoom(), 13);
    const areaName = await reverseGeocode(center.lat, center.lng);
    const cityName = areaName.split(',')[0].trim() || 'This Area';
    await focusOnArea(cityName, center.lat, center.lng, currentZoom, 25);
  }

  // Category Chip click handlers
  poiCategoryChips.forEach(chip => {
    chip.addEventListener('click', () => {
      poiCategoryChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeCategory = chip.dataset.category;
      renderPOIs();
    });
  });

  // Search Area button handler
  if (searchAreaBtn) {
    searchAreaBtn.addEventListener('click', searchAreaPOIs);
  }

  // Chittoor Shortcut button handler
  if (chittoorShortcutBtn) {
    chittoorShortcutBtn.addEventListener('click', () => {
      focusOnArea('Chittoor', 13.2172, 79.1003, 14, 30);
      if (exploreDrawer && !exploreDrawer.classList.contains('open')) {
        exploreDrawer.classList.add('open');
      }
    });
  }

  // Drawer Toggle Handlers
  if (toggleExploreBtn && exploreDrawer) {
    toggleExploreBtn.addEventListener('click', () => {
      exploreDrawer.classList.toggle('open');
    });
  }

  if (closeExploreBtn && exploreDrawer) {
    closeExploreBtn.addEventListener('click', () => {
      exploreDrawer.classList.remove('open');
    });
  }

  // Filter input handler
  if (exploreFilterInput) {
    exploreFilterInput.addEventListener('input', () => {
      renderPOIs();
    });
  }

  // Popup Zoom In delegate
  map.on('popupopen', (e) => {
    const popupEl = e.popup.getElement();
    if (!popupEl) return;
    const zoomBtn = popupEl.querySelector('.poi-zoom-btn');
    if (zoomBtn) {
      zoomBtn.addEventListener('click', () => {
        const lat = parseFloat(zoomBtn.dataset.lat);
        const lng = parseFloat(zoomBtn.dataset.lng);
        map.flyTo([lat, lng], 17, { duration: 1.2 });
      });
    }
    // Route Here delegate from POI popup
    const routeToBtn = popupEl.querySelector('.poi-route-to-btn');
    if (routeToBtn) {
      routeToBtn.addEventListener('click', () => {
        const targetLat = parseFloat(routeToBtn.dataset.lat);
        const targetLng = parseFloat(routeToBtn.dataset.lng);
        const destLatLng = L.latLng(targetLat, targetLng);

        if (userBeaconMarker) {
          clearTravelRoute(false);
          routeStartMarker = createRoutePointMarker(userBeaconMarker.getLatLng(), 'A');
          routeEndMarker = createRoutePointMarker(destLatLng, 'B');
          calculateAndDrawRoute(userBeaconMarker.getLatLng(), destLatLng);
        } else if (routeStartMarker) {
          if (routeEndMarker) map.removeLayer(routeEndMarker);
          routeEndMarker = createRoutePointMarker(destLatLng, 'B');
          calculateAndDrawRoute(routeStartMarker.getLatLng(), destLatLng);
        } else {
          routeEndMarker = createRoutePointMarker(destLatLng, 'B');
          if (routeTravelHud) {
            routeTravelHud.classList.add('show');
            if (routeHudTitle) routeHudTitle.textContent = 'Destination Set 🏁';
            if (routeHudDetails) routeHudDetails.textContent = 'Double-click anywhere on the map to set your Start location';
          }
          showToast('Destination set! Double-click on map to choose Start location.');
        }
      });
    }
  });

  // Initial POI Render
  renderPOIs();

  // ============================================================
  // INTERACTIVE 2-PRESS ROUTE & TRAVEL ENGINE
  // ============================================================
  let routeStartMarker = null;
  let routeEndMarker = null;
  let currentRouteGroup = null;
  let travelVehicleMarker = null;
  let travelAnimTimer = null;
  let routePathCoordinates = [];
  let travelStepIndex = 0;
  let travelSpeed = 1;
  let isTraveling = false;

  const routeTravelHud = document.getElementById('routeTravelHud');
  const routeHudTitle = document.getElementById('routeHudTitle');
  const routeHudDetails = document.getElementById('routeHudDetails');
  const routeProgressBar = document.getElementById('routeProgressBar');
  const startTravelBtn = document.getElementById('startTravelBtn');
  const travelBtnIcon = document.getElementById('travelBtnIcon');
  const travelBtnText = document.getElementById('travelBtnText');
  const travelSpeedBtn = document.getElementById('travelSpeedBtn');
  const clearRouteActionBtn = document.getElementById('clearRouteActionBtn');
  const closeRouteBtn = document.getElementById('closeRouteBtn');
  const routeModeChip = document.getElementById('routeModeChip');

  function createRoutePointMarker(latlng, type = 'A') {
    return L.marker(latlng, {
      icon: L.divIcon({
        className: 'route-point-marker-container',
        html: `
          <div class="route-point-marker ${type === 'A' ? 'route-point-start' : 'route-point-end'}">
            ${type === 'A' ? '🟢 A' : '🏁 B'}
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18]
      }),
      zIndexOffset: 1500
    }).addTo(map);
  }

  function createTravelVehicleMarker(latlng) {
    return L.marker(latlng, {
      icon: L.divIcon({
        className: 'travel-vehicle-marker-container',
        html: `
          <div id="activeCarMarker" class="travel-vehicle-marker">
            🚗
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      }),
      zIndexOffset: 2000
    }).addTo(map);
  }

  function clearTravelRoute(notify = true) {
    stopTravelAnimation();

    if (routeStartMarker) {
      map.removeLayer(routeStartMarker);
      routeStartMarker = null;
    }
    if (routeEndMarker) {
      map.removeLayer(routeEndMarker);
      routeEndMarker = null;
    }
    if (currentRouteGroup) {
      map.removeLayer(currentRouteGroup);
      currentRouteGroup = null;
    }
    if (travelVehicleMarker) {
      map.removeLayer(travelVehicleMarker);
      travelVehicleMarker = null;
    }

    routePathCoordinates = [];
    travelStepIndex = 0;
    isTraveling = false;

    if (routeProgressBar) routeProgressBar.style.width = '0%';
    if (routeTravelHud) routeTravelHud.classList.remove('show');
    if (routeModeChip) routeModeChip.classList.remove('active');

    if (notify) showToast('Route cleared');
  }


  function generateArcPoints(start, end, numPoints = 80) {
    const pts = [];
    for (let i = 0; i <= numPoints; i++) {
      const f = i / numPoints;
      const lat = start.lat + (end.lat - start.lat) * f;
      const lng = start.lng + (end.lng - start.lng) * f;
      pts.push([lat, lng]);
    }
    return pts;
  }

  async function calculateAndDrawRoute(startLatLng, endLatLng) {
    if (routeTravelHud) {
      routeTravelHud.classList.add('show');
      if (routeHudTitle) routeHudTitle.textContent = 'Calculating Travel Route...';
      if (routeHudDetails) routeHudDetails.textContent = 'Connecting roadways via live routing engine...';
    }

    let latlngs = [];
    let distanceKm = 0;
    let durationMins = 0;

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startLatLng.lng},${startLatLng.lat};${endLatLng.lng},${endLatLng.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();

      if (data && data.code === 'Ok' && data.routes && data.routes[0]) {
        const route = data.routes[0];
        latlngs = route.geometry.coordinates.map(c => [c[1], c[0]]);
        distanceKm = (route.distance / 1000).toFixed(1);
        durationMins = Math.max(1, Math.round(route.duration / 60));
      } else {
        throw new Error('OSRM no direct road found');
      }
    } catch (err) {
      latlngs = generateArcPoints(startLatLng, endLatLng);
      const rawDist = calculateDistanceKm(startLatLng.lat, startLatLng.lng, endLatLng.lat, endLatLng.lng);
      distanceKm = rawDist.toFixed(1);
      durationMins = Math.max(1, Math.round(rawDist / 60 * 60));
    }

    routePathCoordinates = latlngs;
    travelStepIndex = 0;

    if (currentRouteGroup) map.removeLayer(currentRouteGroup);

    const routeCasing = L.polyline(latlngs, {
      color: '#06b6d4',
      weight: 8,
      opacity: 0.45,
      lineCap: 'round',
      lineJoin: 'round'
    });

    const routeCore = L.polyline(latlngs, {
      color: '#38bdf8',
      weight: 4,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    });

    currentRouteGroup = L.featureGroup([routeCasing, routeCore]).addTo(map);

    // Smoothly pan & fit view
    map.fitBounds(currentRouteGroup.getBounds(), { padding: [70, 70] });

    if (travelVehicleMarker) map.removeLayer(travelVehicleMarker);
    travelVehicleMarker = createTravelVehicleMarker(latlngs[0]);

    if (routeHudTitle) routeHudTitle.textContent = `🚗 Travel Route: ${distanceKm} km`;
    if (routeHudDetails) routeHudDetails.textContent = `Drive: ~${durationMins} mins • Traveling now...`;

    if (startTravelBtn) {
      if (travelBtnIcon) travelBtnIcon.textContent = '⏸';
      if (travelBtnText) travelBtnText.textContent = 'Pause';
    }

    showToast(`Route created: ${distanceKm} km (${durationMins} mins)`);

    setTimeout(() => {
      startTravelSimulation();
    }, 300);
  }

  function startTravelSimulation() {
    if (routePathCoordinates.length === 0) return;
    isTraveling = true;
    if (travelBtnIcon) travelBtnIcon.textContent = '⏸';
    if (travelBtnText) travelBtnText.textContent = 'Pause';

    function step() {
      if (!isTraveling) return;

      travelStepIndex += travelSpeed;
      if (travelStepIndex >= routePathCoordinates.length) {
        travelStepIndex = routePathCoordinates.length - 1;
        isTraveling = false;
        if (travelVehicleMarker) travelVehicleMarker.setLatLng(routePathCoordinates[travelStepIndex]);
        if (routeProgressBar) routeProgressBar.style.width = '100%';
        if (travelBtnIcon) travelBtnIcon.textContent = '🔁';
        if (travelBtnText) travelBtnText.textContent = 'Replay Travel';
        if (routeHudTitle) routeHudTitle.textContent = '🏁 Arrived at Destination!';
        showToast('🎉 Travel complete! Arrived at destination.');
        return;
      }

      const currentCoord = routePathCoordinates[travelStepIndex];
      const nextCoord = routePathCoordinates[Math.min(travelStepIndex + 1, routePathCoordinates.length - 1)];

      if (travelVehicleMarker) {
        travelVehicleMarker.setLatLng(currentCoord);

        const carEl = document.getElementById('activeCarMarker');
        if (carEl && nextCoord) {
          const dy = nextCoord[0] - currentCoord[0];
          const dx = nextCoord[1] - currentCoord[1];
          const deg = (Math.atan2(dx, dy) * 180 / Math.PI);
          carEl.style.transform = `rotate(${deg}deg)`;
        }
      }

      if (routeProgressBar) {
        const pct = Math.round((travelStepIndex / (routePathCoordinates.length - 1)) * 100);
        routeProgressBar.style.width = `${pct}%`;
      }

      travelAnimTimer = setTimeout(step, 40);
    }

    step();
  }

  function stopTravelAnimation() {
    isTraveling = false;
    if (travelAnimTimer) clearTimeout(travelAnimTimer);
    if (travelBtnIcon) travelBtnIcon.textContent = '▶';
    if (travelBtnText) travelBtnText.textContent = 'Start Travel';
  }

  // Handle Double-Click / 2-Press on Map
  function handleLocationPress(latlng) {
    if (!routeStartMarker) {
      // 1st press: Set Origin (Point A)
      routeStartMarker = createRoutePointMarker(latlng, 'A');
      if (routeTravelHud) {
        routeTravelHud.classList.add('show');
        if (routeHudTitle) routeHudTitle.textContent = 'Point A (Start) Set 🟢';
        if (routeHudDetails) routeHudDetails.textContent = 'Press upon location 2 (double-click) to set Destination 🏁';
      }
      showToast('Origin set! Double-click your destination to create route.');
    } else if (!routeEndMarker) {
      // 2nd press: Set Destination (Point B) & Route
      routeEndMarker = createRoutePointMarker(latlng, 'B');
      calculateAndDrawRoute(routeStartMarker.getLatLng(), latlng);
    } else {
      // Both exist: reset and start new route with this as Point A
      clearTravelRoute(false);
      routeStartMarker = createRoutePointMarker(latlng, 'A');
      if (routeTravelHud) {
        routeTravelHud.classList.add('show');
        if (routeHudTitle) routeHudTitle.textContent = 'Point A (Start) Set 🟢';
        if (routeHudDetails) routeHudDetails.textContent = 'Press upon location 2 (double-click) to set Destination 🏁';
      }
      showToast('New start set! Double-click destination to create route.');
    }
  }

  // Double-Click on Map
  map.on('dblclick', (e) => {
    handleLocationPress(e.latlng);
  });

  // Start / Pause / Replay Button
  if (startTravelBtn) {
    startTravelBtn.addEventListener('click', () => {
      if (isTraveling) {
        stopTravelAnimation();
      } else {
        if (travelStepIndex >= routePathCoordinates.length - 1) {
          travelStepIndex = 0; // Replay from start
        }
        startTravelSimulation();
      }
    });
  }

  // Travel Speed Button
  if (travelSpeedBtn) {
    travelSpeedBtn.addEventListener('click', () => {
      if (travelSpeed === 1) travelSpeed = 2;
      else if (travelSpeed === 2) travelSpeed = 4;
      else travelSpeed = 1;
      travelSpeedBtn.textContent = `Speed: ${travelSpeed}x`;
      showToast(`Travel speed: ${travelSpeed}x`);
    });
  }

  // Clear Route Buttons
  if (clearRouteActionBtn) {
    clearRouteActionBtn.addEventListener('click', () => clearTravelRoute(true));
  }
  if (closeRouteBtn) {
    closeRouteBtn.addEventListener('click', () => clearTravelRoute(true));
  }

  // Route Mode Chip
  if (routeModeChip) {
    routeModeChip.addEventListener('click', () => {
      routeModeChip.classList.toggle('active');
      showToast('Double-click on any 2 locations on the map to create a travel route!');
      if (routeTravelHud && !routeTravelHud.classList.contains('show')) {
        routeTravelHud.classList.add('show');
        if (routeHudTitle) routeHudTitle.textContent = 'Plan Travel Route';
        if (routeHudDetails) routeHudDetails.textContent = 'Double-click location 1 for Start, then location 2 for Destination';
      }
    });
  }

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
        const cityName = addr.split(',')[0].trim() || 'My Location';
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
        focusOnArea(cityName, latitude, longitude, 15, 25, true);
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
      reverseGeocode(userBeaconMarker.getLatLng().lat, userBeaconMarker.getLatLng().lng).then((addr) => {
        const cityName = addr.split(',')[0].trim() || 'My Location';
        focusOnArea(cityName, userBeaconMarker.getLatLng().lat, userBeaconMarker.getLatLng().lng, 15, 25, true);
      });
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
        reverseGeocode(userBeaconMarker.getLatLng().lat, userBeaconMarker.getLatLng().lng).then((addr) => {
          const cityName = addr.split(',')[0].trim() || 'My Location';
          focusOnArea(cityName, userBeaconMarker.getLatLng().lat, userBeaconMarker.getLatLng().lng, 15, 25, true);
        });
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
              const placeName = item.display_name.split(',')[0].trim();
              searchResults.classList.remove('show');
              searchInput.value = placeName;
              addMarkerAt(lat, lon, placeName);
              focusOnArea(placeName, lat, lon, 14, 25);
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

  searchInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounceTimeout);
      const query = searchInput.value.trim();
      if (!query) return;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data && data.length > 0) {
          const item = data[0];
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);
          const placeName = item.display_name.split(',')[0].trim();
          searchResults.classList.remove('show');
          searchInput.value = placeName;
          addMarkerAt(lat, lon, placeName);
          focusOnArea(placeName, lat, lon, 14, 25);
        } else {
          showToast('Place not found. Try another city or town name.');
        }
      } catch (err) {
        console.error('Search enter error:', err);
      }
    }
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

  // ============================================================
  // CONNECT TO WEBSITE & APP MODAL CONTROLLER
  // ============================================================
  const connectModal = document.getElementById('connectModal');
  const connectModalBtn = document.getElementById('connectModalBtn');
  const closeConnectModalBtn = document.getElementById('closeConnectModalBtn');
  const modalTabBtns = document.querySelectorAll('.modal-tab-btn');
  const modalTabContents = document.querySelectorAll('.modal-tab-content');

  const iframeSnippet = document.getElementById('iframeSnippet');
  const rnWebviewSnippet = document.getElementById('rnWebviewSnippet');
  const nativeSdkSnippet = document.getElementById('nativeSdkSnippet');

  const copyIframeBtn = document.getElementById('copyIframeBtn');
  const copyRnWebviewBtn = document.getElementById('copyRnWebviewBtn');
  const copyNativeSdkBtn = document.getElementById('copyNativeSdkBtn');

  // Compute live current URL
  const getAppUrl = () => {
    return window.location.origin;
  };

  // Populate code snippets
  const populateSnippets = () => {
    const liveUrl = getAppUrl();

    if (iframeSnippet) {
      iframeSnippet.textContent = `<!-- Embed Live 2026 Map into any Website / HTML / React -->
<iframe 
  src="${liveUrl}" 
  width="100%" 
  height="600" 
  style="border: none; border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.35);" 
  allow="geolocation"
  loading="lazy">
</iframe>`;
    }

    if (rnWebviewSnippet) {
      rnWebviewSnippet.textContent = `// React Native Mobile App (iOS & Android)
// npm install react-native-webview
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export default function WebMapScreen() {
  return (
    <View style={styles.container}>
      <WebView 
        source={{ uri: '${liveUrl}' }} 
        geolocationEnabled={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0f19' },
  webview: { flex: 1 },
});`;
    }

    if (nativeSdkSnippet) {
      nativeSdkSnippet.textContent = `// Full Native Hardware-Accelerated Map
// Configured in this repository at:
// react-native-maps-master/example/src/MyMapView.tsx
import React, { useRef } from 'react';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

export default function NativeMap() {
  const mapRef = useRef<MapView>(null);
  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={{ flex: 1 }}
      showsUserLocation={true}
      showsMyLocationButton={true}
      initialRegion={{
        latitude: 20.0,
        longitude: 0.0,
        latitudeDelta: 60.0,
        longitudeDelta: 60.0,
      }}
    />
  );
}`;
    }
  };

  // Modal open / close
  if (connectModalBtn && connectModal) {
    connectModalBtn.addEventListener('click', () => {
      populateSnippets();
      connectModal.classList.add('show');
    });
  }

  if (closeConnectModalBtn && connectModal) {
    closeConnectModalBtn.addEventListener('click', () => {
      connectModal.classList.remove('show');
    });
  }

  if (connectModal) {
    connectModal.addEventListener('click', (e) => {
      if (e.target === connectModal) {
        connectModal.classList.remove('show');
      }
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && connectModal.classList.contains('show')) {
        connectModal.classList.remove('show');
      }
    });
  }

  // Tab switching
  modalTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modalTabBtns.forEach(b => b.classList.remove('active'));
      modalTabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = document.getElementById(btn.dataset.tab);
      if (targetTab) targetTab.classList.add('active');
    });
  });

  // Copy buttons
  const copyHelper = (btn, elem, label) => {
    if (!btn || !elem) return;
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(elem.textContent).then(() => {
        showToast(`${label} copied to clipboard!`);
      });
    });
  };

  copyHelper(copyIframeBtn, iframeSnippet, 'HTML Embed Code');
  copyHelper(copyRnWebviewBtn, rnWebviewSnippet, 'React Native Code');
  copyHelper(copyNativeSdkBtn, nativeSdkSnippet, 'Native SDK Code');
});
