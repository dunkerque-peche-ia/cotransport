/**
 * Map Manager - Gestion Avancée de la Carte Leaflet.js Géolocalisée (Dark Mode)
 * Recherche d'adresse (Nominatim), suivi GPS haute précision, glisser-déplacer du marqueur.
 */

class MapManager {
  constructor(containerId = 'map') {
    this.containerId = containerId;
    this.map = null;
    this.userMarker = null;
    this.radiusCircle = null;
    this.deliveryMarkers = new Map(); // id -> L.Marker
    this.routeLine = null;
    this.watchId = null;
    this.isTrackingGPS = false;

    // Position initiale par défaut : Dunkerque (Hauts-de-France)
    this.userCoords = { lat: 51.0343, lng: 2.3768 };
    this.radiusKm = 10;
    this.currentAddressName = "Dunkerque, Hauts-de-France";
    this.onPositionChanged = null;
  }

  /**
   * Initialise la carte avec le thème Dark Mode de CartoDB et les écouteurs d'événements
   */
  init(onPositionChangedCallback) {
    this.onPositionChanged = onPositionChangedCallback;

    this.map = L.map(this.containerId, {
      zoomControl: false,
      attributionControl: false
    }).setView([this.userCoords.lat, this.userCoords.lng], 12);

    // Ajout des tuiles Dark Mode CartoDB
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(this.map);

    // Contrôle de Zoom repositionné en haut à gauche
    L.control.zoom({ position: 'topleft' }).addTo(this.map);

    // Marqueur de position de l'utilisateur (glissable)
    this.updateUserPosition(this.userCoords.lat, this.userCoords.lng, true);

    // Permettre le clic direct sur la carte pour repositionner le centre d'alerte
    this.map.on('click', (e) => {
      this.updateUserPosition(e.latlng.lat, e.latlng.lng, true);
    });

    // Tenter la géolocalisation automatique initiale via l'API Browser
    this.requestCurrentLocation();
  }

  /**
   * Tente d'obtenir la position GPS actuelle haute précision du navigateur
   */
  requestCurrentLocation(showAlert = false) {
    if (!('geolocation' in navigator)) {
      if (showAlert) alert("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        this.updateUserPosition(lat, lng, true);
        this.map.flyTo([lat, lng], 13, { duration: 1.2 });
        this.reverseGeocode(lat, lng);
      },
      (err) => {
        console.warn("Géolocalisation GPS refusée ou temporairement indisponible.");
        if (showAlert) alert("Impossible de récupérer la position GPS. Vérifiez les permissions de votre navigateur.");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }

  /**
   * Active ou désactive le suivi GPS continu en temps réel (pour les déplacements)
   */
  toggleGPSTracking(onStatusChange) {
    if (this.isTrackingGPS) {
      if (this.watchId !== null) {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }
      this.isTrackingGPS = false;
      if (onStatusChange) onStatusChange(false);
    } else {
      if (!('geolocation' in navigator)) return;
      this.isTrackingGPS = true;
      if (onStatusChange) onStatusChange(true);

      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          this.updateUserPosition(lat, lng, true);
        },
        (err) => console.error("Erreur du suivi GPS continu:", err),
        { enableHighAccuracy: true, maximumAge: 2000 }
      );
    }
  }

  /**
   * Met à jour la position du conducteur et le rayon d'action
   */
  updateUserPosition(lat, lng, triggerCallback = true) {
    this.userCoords = { lat, lng };

    const userIcon = L.divIcon({
      className: 'custom-user-marker',
      html: `
        <div style="
          width: 24px; 
          height: 24px; 
          background: #6366f1; 
          border: 3px solid #ffffff; 
          border-radius: 50%; 
          box-shadow: 0 0 20px #6366f1, 0 0 35px rgba(99, 102, 241, 0.6);
          cursor: grab;
        "></div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    if (this.userMarker) {
      this.userMarker.setLatLng([lat, lng]);
    } else {
      this.userMarker = L.marker([lat, lng], {
        icon: userIcon,
        draggable: true,
        title: "Faites glisser pour changer votre position"
      }).addTo(this.map);

      // Événement de fin de glisser-déplacer du marqueur
      this.userMarker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        this.updateUserPosition(newPos.lat, newPos.lng, true);
      });
    }

    this.updateRadiusCircle(this.radiusKm);
    this.reverseGeocode(lat, lng);

    if (triggerCallback && this.onPositionChanged) {
      this.onPositionChanged(lat, lng);
    }
  }

  /**
   * Ajuste le cercle du rayon d'action autour de l'utilisateur
   */
  updateRadiusCircle(radiusKm) {
    this.radiusKm = radiusKm;
    const radiusMeters = radiusKm * 1000;

    if (this.radiusCircle) {
      this.radiusCircle.setLatLng([this.userCoords.lat, this.userCoords.lng]);
      this.radiusCircle.setRadius(radiusMeters);
    } else {
      this.radiusCircle = L.circle([this.userCoords.lat, this.userCoords.lng], {
        color: '#6366f1',
        fillColor: '#6366f1',
        fillOpacity: 0.08,
        weight: 1.5,
        dashArray: '6, 6',
        radius: radiusMeters
      }).addTo(this.map);
    }
  }

  /**
   * Recherche de ville ou d'adresse via l'API Nominatim (OpenStreetMap)
   */
  async searchAddress(query) {
    if (!query || query.trim().length < 2) return [];

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=fr&limit=5&q=${encodeURIComponent(query)}`);
      if (!response.ok) return [];
      const results = await response.json();

      return results.map(item => ({
        displayName: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      }));
    } catch (e) {
      console.warn("Erreur lors de la recherche de géocodage Nominatim:", e);
      return [];
    }
  }

  /**
   * Géocodage inverse (coordonnées -> nom de ville/adresse)
   */
  async reverseGeocode(lat, lng) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12`);
      if (res.ok) {
        const data = await res.json();
        const city = data.address.city || data.address.town || data.address.village || data.address.municipality || "Position personnalisée";
        this.currentAddressName = city;

        const addressBadge = document.getElementById('current-location-badge');
        if (addressBadge) {
          addressBadge.innerHTML = `<i class="fa-solid fa-location-dot" style="color:#10b981;"></i> ${city}`;
        }
      }
    } catch (e) {
      // Silencieux en cas de quota dépassé
    }
  }

  /**
   * Ajoute un marqueur de course sur la carte
   */
  addDeliveryMarker(delivery) {
    if (this.deliveryMarkers.has(delivery.id)) return;

    if (!delivery.lat || !delivery.lng) {
      const coords = this.getRandomCoordsInRadius(delivery.distance);
      delivery.lat = coords.lat;
      delivery.lng = coords.lng;
    }

    // Calcul de la distance réelle exacte depuis la position actuelle de l'utilisateur
    delivery.distance = parseFloat(this.calculateDistance(
      this.userCoords.lat, this.userCoords.lng,
      delivery.lat, delivery.lng
    ).toFixed(1));
    delivery.pricePerKm = parseFloat((delivery.price / (delivery.distance || 1)).toFixed(2));

    const isTutTut = delivery.platform === 'tuttut';
    const markerClass = isTutTut ? 'marker-pulse-tuttut' : 'marker-pulse-shopopop';
    const color = isTutTut ? '#FF5A1F' : '#00B4D8';

    const customIcon = L.divIcon({
      className: 'custom-delivery-marker',
      html: `
        <div class="${markerClass}"></div>
        <div style="
          position: absolute;
          top: -24px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(17, 24, 39, 0.92);
          border: 1px solid ${color};
          color: white;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 800;
          font-size: 0.72rem;
          padding: 2px 6px;
          border-radius: 6px;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0,0,0,0.6);
        ">
          ${delivery.price.toFixed(2)} €
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const marker = L.marker([delivery.lat, delivery.lng], { icon: customIcon }).addTo(this.map);

    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${this.userCoords.lat},${this.userCoords.lng}&destination=${delivery.lat},${delivery.lng}`;

    const popupContent = `
      <div class="popup-delivery">
        <div class="popup-header">
          <span style="color: ${color}; font-weight: 800;">${isTutTut ? '🍊 Tut Tut' : '🔷 Shopopop'}</span>
          <span class="popup-price">${delivery.price.toFixed(2)} €</span>
        </div>
        <div style="font-size: 0.85rem; font-weight: 700; margin-bottom: 4px;">${delivery.storeName}</div>
        <div style="font-size: 0.78rem; color: #9ca3af; margin-bottom: 8px;">
          📍 Distance: <strong>${delivery.distance} km</strong> (${delivery.pricePerKm} €/km)
        </div>
        <a href="${googleMapsUrl}" target="_blank" style="
          display: block;
          text-align: center;
          background: ${color};
          color: white;
          font-weight: 700;
          font-size: 0.78rem;
          padding: 6px 10px;
          border-radius: 6px;
          text-decoration: none;
        ">
          🧭 Itinéraire Waze / Maps
        </a>
      </div>
    `;

    marker.bindPopup(popupContent);

    marker.on('click', () => {
      this.drawRouteLine(delivery.lat, delivery.lng, color);
    });

    this.deliveryMarkers.set(delivery.id, marker);
  }

  removeDeliveryMarker(id) {
    if (this.deliveryMarkers.has(id)) {
      const marker = this.deliveryMarkers.get(id);
      this.map.removeLayer(marker);
      this.deliveryMarkers.delete(id);
    }
  }

  clearAllMarkers() {
    this.deliveryMarkers.forEach((marker) => this.map.removeLayer(marker));
    this.deliveryMarkers.clear();
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = null;
    }
  }

  drawRouteLine(destLat, destLng, color = '#6366f1') {
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
    }

    this.routeLine = L.polyline([
      [this.userCoords.lat, this.userCoords.lng],
      [destLat, destLng]
    ], {
      color: color,
      weight: 3,
      opacity: 0.85,
      dashArray: '8, 8'
    }).addTo(this.map);
  }

  /**
   * Calcul de la formule de Haversine pour la distance précise en km entre 2 points GPS
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  getRandomCoordsInRadius(distKm) {
    const r = distKm / 111.3;
    const u = Math.random();
    const v = Math.random();
    const w = r * Math.sqrt(u);
    const t = 2 * Math.PI * v;
    const x = w * Math.cos(t);
    const y = w * Math.sin(t);

    return {
      lat: this.userCoords.lat + y,
      lng: this.userCoords.lng + (x / Math.cos(this.userCoords.lat * (Math.PI / 180)))
    };
  }
}

// Export global
window.MapManager = MapManager;
