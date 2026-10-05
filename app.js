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

  const INITIAL_POIS = [
    // --- TEMPLES 🛕 ---
    { id: 't1', name: 'Angkor Wat', category: 'temple', lat: 13.4125, lng: 103.8670, city: 'Siem Reap', country: 'Cambodia' },
    { id: 't2', name: 'Meenakshi Amman Temple', category: 'temple', lat: 9.9195, lng: 78.1194, city: 'Madurai', country: 'India' },
    { id: 't3', name: 'Golden Temple (Harmandir Sahib)', category: 'temple', lat: 31.6200, lng: 74.8765, city: 'Amritsar', country: 'India' },
    { id: 't4', name: 'Tirumala Venkateswara Temple', category: 'temple', lat: 13.6833, lng: 79.3472, city: 'Tirupati', country: 'India' },
    { id: 't5', name: 'Senso-ji Temple', category: 'temple', lat: 35.7148, lng: 139.7967, city: 'Tokyo', country: 'Japan' },
    { id: 't6', name: 'Kashi Vishwanath Temple', category: 'temple', lat: 25.3109, lng: 83.0107, city: 'Varanasi', country: 'India' },
    { id: 't7', name: 'Brihadisvara Temple', category: 'temple', lat: 10.7828, lng: 79.1318, city: 'Thanjavur', country: 'India' },
    { id: 't8', name: 'Wat Pho (Reclining Buddha)', category: 'temple', lat: 13.7465, lng: 100.4930, city: 'Bangkok', country: 'Thailand' },
    { id: 't9', name: 'Swaminarayan Akshardham', category: 'temple', lat: 28.6127, lng: 77.2773, city: 'New Delhi', country: 'India' },
    { id: 't10', name: 'Prambanan Temple', category: 'temple', lat: -7.7520, lng: 110.4915, city: 'Yogyakarta', country: 'Indonesia' },
    { id: 't11', name: 'Somnath Temple', category: 'temple', lat: 20.8880, lng: 70.4013, city: 'Prabhas Patan', country: 'India' },
    { id: 't12', name: 'Batu Caves Murugan Temple', category: 'temple', lat: 3.2379, lng: 101.6840, city: 'Gombak', country: 'Malaysia' },

    // --- HOTELS 🏨 ---
    { id: 'h1', name: 'Burj Al Arab', category: 'hotel', lat: 25.1412, lng: 55.1852, city: 'Dubai', country: 'UAE' },
    { id: 'h2', name: 'Marina Bay Sands', category: 'hotel', lat: 1.2834, lng: 103.8607, city: 'Downtown', country: 'Singapore' },
    { id: 'h3', name: 'The Taj Mahal Palace', category: 'hotel', lat: 18.9217, lng: 72.8332, city: 'Mumbai', country: 'India' },
    { id: 'h4', name: 'The Plaza Hotel', category: 'hotel', lat: 40.7644, lng: -73.9745, city: 'New York', country: 'USA' },
    { id: 'h5', name: 'The Ritz Paris', category: 'hotel', lat: 48.8682, lng: 2.3292, city: 'Paris', country: 'France' },
    { id: 'h6', name: 'The Beverly Hills Hotel', category: 'hotel', lat: 34.0818, lng: -118.4136, city: 'Beverly Hills', country: 'USA' },
    { id: 'h7', name: 'The Leela Palace', category: 'hotel', lat: 12.9606, lng: 77.6484, city: 'Bengaluru', country: 'India' },
    { id: 'h8', name: 'Atlantis The Palm', category: 'hotel', lat: 25.1304, lng: 55.1171, city: 'Dubai', country: 'UAE' },

    // --- CAFES ☕ ---
    { id: 'c1', name: 'Café de Flore', category: 'cafe', lat: 48.8540, lng: 2.3326, city: 'Paris', country: 'France' },
    { id: 'c2', name: 'Caffè Florian', category: 'cafe', lat: 45.4337, lng: 12.3384, city: 'Venice', country: 'Italy' },
    { id: 'c3', name: 'The Grounds of Alexandria', category: 'cafe', lat: -33.9108, lng: 151.1942, city: 'Sydney', country: 'Australia' },
    { id: 'c4', name: 'Confeitaria Colombo', category: 'cafe', lat: -22.9067, lng: -43.1782, city: 'Rio de Janeiro', country: 'Brazil' },
    { id: 'c5', name: 'Indian Coffee House', category: 'cafe', lat: 22.5756, lng: 88.3636, city: 'Kolkata', country: 'India' },
    { id: 'c6', name: 'Blue Bottle Coffee Shibuya', category: 'cafe', lat: 35.6628, lng: 139.7013, city: 'Tokyo', country: 'Japan' },
    { id: 'c7', name: 'Third Wave Coffee Koramangala', category: 'cafe', lat: 12.9352, lng: 77.6245, city: 'Bengaluru', country: 'India' },
    { id: 'c8', name: 'Café Central', category: 'cafe', lat: 48.2104, lng: 16.3653, city: 'Vienna', country: 'Austria' },

    // --- PARKS 🌳 ---
    { id: 'p1', name: 'Central Park', category: 'park', lat: 40.7851, lng: -73.9683, city: 'New York', country: 'USA' },
    { id: 'p2', name: 'Hyde Park', category: 'park', lat: 51.5073, lng: -0.1657, city: 'London', country: 'UK' },
    { id: 'p3', name: 'Cubbon Park', category: 'park', lat: 12.9763, lng: 77.5929, city: 'Bengaluru', country: 'India' },
    { id: 'p4', name: 'Ueno Park', category: 'park', lat: 35.7153, lng: 139.7739, city: 'Tokyo', country: 'Japan' },
    { id: 'p5', name: 'Lodhi Garden', category: 'park', lat: 28.5933, lng: 77.2197, city: 'New Delhi', country: 'India' },
    { id: 'p6', name: 'Golden Gate Park', category: 'park', lat: 37.7694, lng: -122.4862, city: 'San Francisco', country: 'USA' },
    { id: 'p7', name: 'Gardens by the Bay', category: 'park', lat: 1.2816, lng: 103.8636, city: 'Marina South', country: 'Singapore' },
    { id: 'p8', name: 'Lalbagh Botanical Garden', category: 'park', lat: 12.9507, lng: 77.5848, city: 'Bengaluru', country: 'India' },

    // --- SHOPPING MALLS 🛍️ ---
    { id: 'm1', name: 'The Dubai Mall', category: 'mall', lat: 25.1972, lng: 55.2796, city: 'Dubai', country: 'UAE' },
    { id: 'm2', name: 'Mall of America', category: 'mall', lat: 44.8549, lng: -93.2422, city: 'Bloomington', country: 'USA' },
    { id: 'm3', name: 'Siam Paragon', category: 'mall', lat: 13.7466, lng: 100.5350, city: 'Bangkok', country: 'Thailand' },
    { id: 'm4', name: 'Phoenix Marketcity', category: 'mall', lat: 12.9961, lng: 77.6966, city: 'Bengaluru', country: 'India' },
    { id: 'm5', name: 'Harrods', category: 'mall', lat: 51.4994, lng: -0.1633, city: 'London', country: 'UK' },
    { id: 'm6', name: 'Galeries Lafayette', category: 'mall', lat: 48.8732, lng: 2.3323, city: 'Paris', country: 'France' },
    { id: 'm7', name: 'High Street Phoenix & Palladium', category: 'mall', lat: 18.9953, lng: 72.8242, city: 'Mumbai', country: 'India' },
    { id: 'm8', name: 'Select CITYWALK', category: 'mall', lat: 28.5285, lng: 77.2189, city: 'New Delhi', country: 'India' },

    // --- TOURIST SIGHTS 🏛️ ---
    { id: 's1', name: 'Taj Mahal', category: 'tourist', lat: 27.1751, lng: 78.0421, city: 'Agra', country: 'India' },
    { id: 's2', name: 'Eiffel Tower', category: 'tourist', lat: 48.8584, lng: 2.2945, city: 'Paris', country: 'France' },
    { id: 's3', name: 'Colosseum', category: 'tourist', lat: 41.8902, lng: 12.4922, city: 'Rome', country: 'Italy' },
    { id: 's4', name: 'Great Pyramid of Giza', category: 'tourist', lat: 29.9792, lng: 31.1342, city: 'Giza', country: 'Egypt' },
    { id: 's5', name: 'Statue of Liberty', category: 'tourist', lat: 40.6892, lng: -74.0445, city: 'New York', country: 'USA' },
    { id: 's6', name: 'Machu Picchu', category: 'tourist', lat: -13.1631, lng: -72.5450, city: 'Cusco', country: 'Peru' },
    { id: 's7', name: 'Sydney Opera House', category: 'tourist', lat: -33.8568, lng: 151.2153, city: 'Sydney', country: 'Australia' },
    { id: 's8', name: 'Gateway of India', category: 'tourist', lat: 18.9220, lng: 72.8347, city: 'Mumbai', country: 'India' }
  ];

  let allPOIs = [...INITIAL_POIS];
  let activeCategory = 'all';
  const poiLayerGroup = L.layerGroup().addTo(map);
  const activeMarkersMap = {};

  // Elements
  const poiCategoryChips = document.querySelectorAll('.poi-chip[data-category]');
  const searchAreaBtn = document.getElementById('searchAreaBtn');
  const searchAreaText = document.getElementById('searchAreaText');
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
    return `
      <div class="poi-popup-card">
        <div class="poi-popup-badge" style="background: ${meta.color}22; color: ${meta.color}; border: 1px solid ${meta.color}55;">
          <span>${meta.emoji}</span>
          <span>${meta.label}</span>
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

    // Calculate category counts
    const counts = { all: allPOIs.length, temple: 0, hotel: 0, cafe: 0, park: 0, mall: 0, tourist: 0 };
    allPOIs.forEach(p => {
      if (counts[p.category] !== undefined) counts[p.category]++;
    });

    Object.keys(counts).forEach(cat => {
      if (countElems[cat]) countElems[cat].textContent = counts[cat];
    });

    if (explorePlacesBadge) {
      explorePlacesBadge.textContent = activeCategory === 'all' ? counts.all : counts[activeCategory] || 0;
    }

    // Filter places
    const filterQuery = (exploreFilterInput?.value || '').toLowerCase().trim();
    const visiblePlaces = allPOIs.filter(p => {
      const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
      const matchesSearch = !filterQuery || p.name.toLowerCase().includes(filterQuery) || (p.city && p.city.toLowerCase().includes(filterQuery));
      return matchesCategory && matchesSearch;
    });

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

    // Update Drawer Title
    if (exploreDrawerTitle) {
      if (activeCategory === 'all') {
        exploreDrawerTitle.textContent = `All Places (${visiblePlaces.length})`;
      } else {
        const catMeta = POI_CATEGORIES[activeCategory];
        exploreDrawerTitle.textContent = `${catMeta ? catMeta.emoji + ' ' + catMeta.plural : 'Places'} (${visiblePlaces.length})`;
      }
    }

    // Update Explore Drawer Cards
    if (explorePlacesList) {
      if (visiblePlaces.length === 0) {
        explorePlacesList.innerHTML = `
          <div class="poi-empty-state">
            <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
            <p>No places found in this view.</p>
            <button class="btn btn-sm btn-primary" id="drawerSearchAreaBtn" style="margin-top: 12px;">Search This Area</button>
          </div>
        `;
        const drawerBtn = document.getElementById('drawerSearchAreaBtn');
        if (drawerBtn) drawerBtn.addEventListener('click', searchAreaPOIs);
      } else {
        explorePlacesList.innerHTML = visiblePlaces.map(poi => {
          const meta = POI_CATEGORIES[poi.category] || { emoji: '📍', color: '#6366f1', label: 'Place', bg: '#6366f1' };
          return `
            <div class="poi-card" data-id="${poi.id}" data-lat="${poi.lat}" data-lng="${poi.lng}">
              <div class="poi-card-icon" style="background: ${meta.bg};">
                ${meta.emoji}
              </div>
              <div class="poi-card-content">
                <div class="poi-card-name">${escapeHTML(poi.name)}</div>
                <div class="poi-card-meta">
                  <span class="poi-card-category" style="color: ${meta.color};">${meta.label}</span>
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

  // Live Overpass API Search
  async function searchAreaPOIs() {
    if (!searchAreaBtn) return;
    searchAreaBtn.classList.add('loading');
    if (searchAreaText) searchAreaText.textContent = 'Searching...';

    try {
      const currentZoom = map.getZoom();
      let query = '';

      if (currentZoom < 9) {
        const center = map.getCenter();
        const radius = 15000;
        query = `[out:json][timeout:15];
(
  node["amenity"="place_of_worship"](around:${radius},${center.lat},${center.lng});
  node["tourism"="hotel"](around:${radius},${center.lat},${center.lng});
  node["amenity"="cafe"](around:${radius},${center.lat},${center.lng});
  node["leisure"="park"](around:${radius},${center.lat},${center.lng});
  node["shop"="mall"](around:${radius},${center.lat},${center.lng});
  node["tourism"="attraction"](around:${radius},${center.lat},${center.lng});
);
out center 40;`;
      } else {
        const bounds = map.getBounds();
        const south = bounds.getSouth();
        const west = bounds.getWest();
        const north = bounds.getNorth();
        const east = bounds.getEast();
        query = `[out:json][timeout:15];
(
  node["amenity"="place_of_worship"](${south},${west},${north},${east});
  node["tourism"="hotel"](${south},${west},${north},${east});
  node["amenity"="cafe"](${south},${west},${north},${east});
  node["leisure"="park"](${south},${west},${north},${east});
  node["shop"="mall"](${south},${west},${north},${east});
  node["tourism"="attraction"](${south},${west},${north},${east});
);
out center 60;`;
      }

      const res = await fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query));
      if (!res.ok) throw new Error(`Overpass returned HTTP ${res.status}`);
      const data = await res.json();

      let addedCount = 0;
      if (data && data.elements && data.elements.length > 0) {
        data.elements.forEach((el, idx) => {
          const tags = el.tags || {};
          const name = tags.name || tags['name:en'];
          if (!name) return;

          let category = 'tourist';
          if (tags.amenity === 'place_of_worship') category = 'temple';
          else if (tags.tourism === 'hotel' || tags.tourism === 'resort' || tags.tourism === 'guest_house') category = 'hotel';
          else if (tags.amenity === 'cafe') category = 'cafe';
          else if (tags.leisure === 'park' || tags.leisure === 'garden') category = 'park';
          else if (tags.shop === 'mall' || tags.shop === 'department_store') category = 'mall';
          else if (tags.tourism === 'attraction' || tags.historic) category = 'tourist';

          const lat = el.lat || (el.center && el.center.lat);
          const lng = el.lon || (el.center && el.center.lon);
          if (!lat || !lng) return;

          const isDuplicate = allPOIs.some(p => 
            (Math.abs(p.lat - lat) < 0.0005 && Math.abs(p.lng - lng) < 0.0005) ||
            p.name.toLowerCase() === name.toLowerCase()
          );

          if (!isDuplicate) {
            allPOIs.push({
              id: `osm_${el.id || idx}_${Date.now()}`,
              name: name,
              category: category,
              lat: lat,
              lng: lng,
              city: tags['addr:city'] || '',
              country: ''
            });
            addedCount++;
          }
        });
      }

      renderPOIs();
      if (addedCount > 0) {
        showToast(`Discovered ${addedCount} live places in this area!`);
      } else {
        showToast('No new places found in this view. Try panning or zooming in.');
      }
    } catch (err) {
      console.warn('Overpass API error:', err.message);
      showToast('Live search unavailable or timed out. Please retry.');
    } finally {
      searchAreaBtn.classList.remove('loading');
      if (searchAreaText) searchAreaText.textContent = 'Search This Area';
    }
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
