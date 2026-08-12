/**
 * Application Controller - Agrégateur de Cotransportage (Tut Tut & Shopopop)
 * Coordonne les filtres, la géolocalisation haute précision, le flux temps réel et la carte.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialisation des sous-systèmes
  const notifier = new NotifierSystem();
  const mapManager = new MapManager('map');
  
  // État global de l'application
  const state = {
    deliveries: [],
    filters: {
      radiusKm: 10,
      minPrice: 5.0,
      minPricePerKm: 1.0,
      platforms: {
        tuttut: true,
        shopopop: true
      }
    },
    metrics: {
      totalCount: 0,
      potentialEarnings: 0,
      tuttutCount: 0,
      shopopopCount: 0
    }
  };

  // 1. Initialiser la carte avec le rappel de changement de position GPS
  mapManager.init((lat, lng) => {
    reapplyFilters();
  });

  // 2. Initialiser le simulateur de courses
  const simulator = new SimulatorManager((delivery) => {
    handleIncomingDelivery(delivery);
  });

  // Éléments du DOM
  const feedListEl = document.getElementById('feed-list');
  const feedCountBadgeEl = document.getElementById('feed-count-badge');
  const totalEarningsEl = document.getElementById('total-earnings');
  const activeCountEl = document.getElementById('active-count');
  
  // Filtres DOM
  const radiusRangeInput = document.getElementById('radius-range');
  const radiusValueDisplay = document.getElementById('radius-value');
  const minPriceInput = document.getElementById('min-price');
  const minKmPriceInput = document.getElementById('min-km-price');
  const toggleTutTutChip = document.querySelector('.toggle-chip[data-platform="tuttut"]');
  const toggleShopopopChip = document.querySelector('.toggle-chip[data-platform="shopopop"]');

  // Géolocalisation DOM
  const inputLocationSearch = document.getElementById('input-location-search');
  const btnSearchLocation = document.getElementById('btn-search-location');
  const locationResultsDropdown = document.getElementById('location-search-results');
  const btnRecenterGPS = document.getElementById('btn-recenter-gps');
  const btnToggleTracking = document.getElementById('btn-toggle-tracking');

  // Boutons et Actions
  const btnToggleSim = document.getElementById('btn-toggle-sim');
  const btnTriggerOneSim = document.getElementById('btn-trigger-onesim');
  const btnClearFeed = document.getElementById('btn-clear-feed');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const btnVoiceToggle = document.getElementById('btn-voice-toggle');
  const btnOpenIntegrationModal = document.getElementById('btn-open-integration');

  // Modals
  const integrationModal = document.getElementById('modal-integration');
  const closeIntegrationModal = document.getElementById('close-integration-modal');

  /**
   * Traitement d'une nouvelle course reçue (simulateur ou vraie notification)
   */
  function handleIncomingDelivery(delivery) {
    if (typeof delivery === 'string') {
      delivery = NotificationParser.parse('Notification', delivery);
    }

    // Mise à jour des coordonnées et distances par rapport au conducteur
    if (!delivery.lat || !delivery.lng) {
      const coords = mapManager.getRandomCoordsInRadius(delivery.distance);
      delivery.lat = coords.lat;
      delivery.lng = coords.lng;
    }

    delivery.distance = parseFloat(mapManager.calculateDistance(
      mapManager.userCoords.lat, mapManager.userCoords.lng,
      delivery.lat, delivery.lng
    ).toFixed(1));

    delivery.pricePerKm = parseFloat((delivery.price / (delivery.distance || 1)).toFixed(2));

    const isEligible = checkEligibility(delivery);
    state.deliveries.unshift(delivery);

    if (isEligible) {
      mapManager.addDeliveryMarker(delivery);
      renderDeliveryCard(delivery, true);
      
      notifier.playAlertSound(delivery.platform);
      notifier.speakDelivery(delivery);
      notifier.sendDesktopNotification(delivery);
    }

    updateMetrics();
  }

  function checkEligibility(delivery) {
    if (!state.filters.platforms[delivery.platform]) return false;
    if (delivery.distance > state.filters.radiusKm) return false;
    if (delivery.price < state.filters.minPrice) return false;
    if (delivery.pricePerKm < state.filters.minPricePerKm) return false;
    return true;
  }

  function renderDeliveryCard(delivery, isNew = false) {
    const emptyState = feedListEl.querySelector('.empty-feed');
    if (emptyState) {
      feedListEl.innerHTML = '';
    }

    const isTutTut = delivery.platform === 'tuttut';
    const card = document.createElement('div');
    card.className = `delivery-card ${delivery.platform} ${isNew ? 'new-arrival' : ''}`;
    card.id = `card-${delivery.id}`;

    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${mapManager.userCoords.lat},${mapManager.userCoords.lng}&destination=${delivery.lat},${delivery.lng}`;

    card.innerHTML = `
      <div class="card-top">
        <span class="platform-badge ${delivery.platform}">
          ${isTutTut ? '🍊 Tut Tut' : '🔷 Shopopop'}
        </span>
        <div class="price-tag">
          ${delivery.price.toFixed(2)} <span class="currency">€</span>
        </div>
      </div>
      
      <div class="card-title">
        <i class="fa-solid fa-store" style="color: ${isTutTut ? '#FF5A1F' : '#00B4D8'};"></i>
        ${delivery.storeName}
      </div>

      <div class="card-details">
        <div class="detail-item">
          <i class="fa-solid fa-location-arrow"></i>
          <span>${delivery.distance} km</span>
        </div>
        <div class="detail-item">
          <i class="fa-solid fa-box"></i>
          <span>${delivery.vehicleType}</span>
        </div>
        <div class="detail-item" style="grid-column: span 2;">
          <i class="fa-solid fa-chart-line"></i>
          <span>Rentabilité: <strong class="profitability-badge">${delivery.pricePerKm} €/km</strong></span>
        </div>
      </div>

      <div class="card-actions">
        <a href="${googleMapsUrl}" target="_blank" class="btn btn-card-action btn-primary" style="text-decoration: none;">
          <i class="fa-solid fa-route"></i> Itinéraire
        </a>
        <button class="btn btn-card-action btn-dismiss" data-id="${delivery.id}">
          <i class="fa-solid fa-xmark"></i> Ignorer
        </button>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-card-action')) return;
      if (delivery.lat && delivery.lng) {
        mapManager.map.flyTo([delivery.lat, delivery.lng], 14, { duration: 1.2 });
        mapManager.drawRouteLine(delivery.lat, delivery.lng, isTutTut ? '#FF5A1F' : '#00B4D8');
      }
    });

    const dismissBtn = card.querySelector('.btn-dismiss');
    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      card.remove();
      mapManager.removeDeliveryMarker(delivery.id);
      state.deliveries = state.deliveries.filter(d => d.id !== delivery.id);
      updateMetrics();

      if (feedListEl.children.length === 0) {
        renderEmptyState();
      }
    });

    feedListEl.prepend(card);
  }

  function renderEmptyState() {
    feedListEl.innerHTML = `
      <div class="empty-feed">
        <i class="fa-solid fa-radar"></i>
        <p>Aucune course active en cours.<br>Lancez le simulateur ou attendez une notification.</p>
      </div>
    `;
  }

  function updateMetrics() {
    const eligibleDeliveries = state.deliveries.filter(checkEligibility);
    
    state.metrics.totalCount = eligibleDeliveries.length;
    state.metrics.potentialEarnings = eligibleDeliveries.reduce((sum, d) => sum + d.price, 0);

    totalEarningsEl.textContent = `${state.metrics.potentialEarnings.toFixed(2)} €`;
    activeCountEl.textContent = state.metrics.totalCount;
    feedCountBadgeEl.textContent = state.metrics.totalCount;
  }

  function reapplyFilters() {
    mapManager.clearAllMarkers();
    feedListEl.innerHTML = '';

    // Recalcul des distances pour toutes les courses d'après la nouvelle position
    state.deliveries.forEach(delivery => {
      if (delivery.lat && delivery.lng) {
        delivery.distance = parseFloat(mapManager.calculateDistance(
          mapManager.userCoords.lat, mapManager.userCoords.lng,
          delivery.lat, delivery.lng
        ).toFixed(1));
        delivery.pricePerKm = parseFloat((delivery.price / (delivery.distance || 1)).toFixed(2));
      }
    });

    const eligible = state.deliveries.filter(checkEligibility);
    if (eligible.length === 0) {
      renderEmptyState();
    } else {
      eligible.forEach(delivery => {
        mapManager.addDeliveryMarker(delivery);
        renderDeliveryCard(delivery, false);
      });
    }

    updateMetrics();
  }

  // --- GESTION AVANCÉE DE LA GÉOLOCALISATION ET RECHERCHE D'ADRESSE ---
  async function performLocationSearch() {
    const query = inputLocationSearch.value.trim();
    if (!query) return;

    locationResultsDropdown.innerHTML = `<div class="search-result-item"><i class="fa-solid fa-spinner fa-spin"></i> Recherche en cours...</div>`;
    locationResultsDropdown.classList.add('active');

    const results = await mapManager.searchAddress(query);

    if (results.length === 0) {
      locationResultsDropdown.innerHTML = `<div class="search-result-item">Aucune ville ou adresse trouvée</div>`;
      return;
    }

    locationResultsDropdown.innerHTML = '';
    results.forEach(res => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `<i class="fa-solid fa-location-dot" style="color: #6366f1;"></i> ${res.displayName}`;
      item.addEventListener('click', () => {
        mapManager.updateUserPosition(res.lat, res.lng, true);
        mapManager.map.flyTo([res.lat, res.lng], 13, { duration: 1.2 });
        locationResultsDropdown.classList.remove('active');
        inputLocationSearch.value = res.displayName.split(',')[0];
      });
      locationResultsDropdown.appendChild(item);
    });
  }

  btnSearchLocation.addEventListener('click', performLocationSearch);
  inputLocationSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performLocationSearch();
  });

  // Fermer la liste déroulante au clic à l'extérieur
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.location-search-container')) {
      locationResultsDropdown.classList.remove('active');
    }
  });

  // Bouton Recentrer sur ma position GPS
  btnRecenterGPS.addEventListener('click', () => {
    mapManager.requestCurrentLocation(true);
  });

  // Toggle Suivi GPS continu
  btnToggleTracking.addEventListener('click', () => {
    mapManager.toggleGPSTracking((active) => {
      btnToggleTracking.classList.toggle('btn-primary', active);
      btnToggleTracking.innerHTML = active ? `<i class="fa-solid fa-satellite fa-spin"></i> Suivi Actif` : `<i class="fa-solid fa-satellite"></i> Suivi GPS`;
    });
  });

  // Event Listeners sur les contrôles du DOM
  radiusRangeInput.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    state.filters.radiusKm = val;
    radiusValueDisplay.textContent = `${val} km`;
    mapManager.updateRadiusCircle(val);
    reapplyFilters();
  });

  minPriceInput.addEventListener('change', (e) => {
    state.filters.minPrice = parseFloat(e.target.value) || 0;
    reapplyFilters();
  });

  minKmPriceInput.addEventListener('change', (e) => {
    state.filters.minPricePerKm = parseFloat(e.target.value) || 0;
    reapplyFilters();
  });

  toggleTutTutChip.addEventListener('click', () => {
    state.filters.platforms.tuttut = !state.filters.platforms.tuttut;
    toggleTutTutChip.classList.toggle('active', state.filters.platforms.tuttut);
    reapplyFilters();
  });

  toggleShopopopChip.addEventListener('click', () => {
    state.filters.platforms.shopopop = !state.filters.platforms.shopopop;
    toggleShopopopChip.classList.toggle('active', state.filters.platforms.shopopop);
    reapplyFilters();
  });

  btnToggleSim.addEventListener('click', () => {
    const isSimulating = simulator.toggleAutoSimulation();
    if (isSimulating) {
      btnToggleSim.innerHTML = `<i class="fa-solid fa-pause"></i> Pause Simu`;
      btnToggleSim.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    } else {
      btnToggleSim.innerHTML = `<i class="fa-solid fa-play"></i> Auto Simu`;
      btnToggleSim.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    }
  });

  btnTriggerOneSim.addEventListener('click', () => {
    simulator.generateRandomDelivery();
  });

  btnClearFeed.addEventListener('click', () => {
    state.deliveries = [];
    mapManager.clearAllMarkers();
    renderEmptyState();
    updateMetrics();
  });

  btnSoundToggle.addEventListener('click', () => {
    notifier.soundEnabled = !notifier.soundEnabled;
    btnSoundToggle.classList.toggle('active', notifier.soundEnabled);
    btnSoundToggle.innerHTML = notifier.soundEnabled ? `<i class="fa-solid fa-volume-high"></i>` : `<i class="fa-solid fa-volume-xmark"></i>`;
  });

  btnVoiceToggle.addEventListener('click', () => {
    notifier.voiceEnabled = !notifier.voiceEnabled;
    btnVoiceToggle.classList.toggle('active', notifier.voiceEnabled);
    btnVoiceToggle.innerHTML = notifier.voiceEnabled ? `<i class="fa-solid fa-comment-dots"></i>` : `<i class="fa-solid fa-comment-slash"></i>`;
  });

  window.openIntegrationModal = function() {
    const modal = document.getElementById('modal-integration');
    if (modal) modal.classList.add('active');
  };

  window.closeIntegrationModal = function() {
    const modal = document.getElementById('modal-integration');
    if (modal) modal.classList.remove('active');
  };

  if (btnOpenIntegrationModal) {
    btnOpenIntegrationModal.addEventListener('click', window.openIntegrationModal);
  }

  if (closeIntegrationModal) {
    closeIntegrationModal.addEventListener('click', window.closeIntegrationModal);
  }

  if (integrationModal) {
    integrationModal.addEventListener('click', (e) => {
      if (e.target === integrationModal) {
        window.closeIntegrationModal();
      }
    });
  }

  const btnTestParse = document.getElementById('btn-test-parse');
  const inputTestText = document.getElementById('input-test-text');

  if (btnTestParse && inputTestText) {
    btnTestParse.addEventListener('click', () => {
      const text = inputTestText.value.trim();
      if (!text) return;
      const parsed = NotificationParser.parse('Alerte Perso', text);
      handleIncomingDelivery(parsed);
      inputTestText.value = '';
    });
  }

  // Initialisation : Lancer 2 courses de démonstration au démarrage
  setTimeout(() => {
    simulator.generateRandomDelivery();
  }, 1000);
  setTimeout(() => {
    simulator.generateRandomDelivery();
  }, 2500);
});
