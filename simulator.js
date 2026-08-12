/**
 * Simulator Manager - Générateur de notifications de Cotransportage en Temps Réel
 * Simule l'arrivée d'alertes réelles Tut Tut et Shopopop autour de la position utilisateur.
 */

class SimulatorManager {
  constructor(onNewDeliveryCallback) {
    this.onNewDelivery = onNewDeliveryCallback;
    this.isRunning = false;
    this.timer = null;

    // Magasins et enseignes réelles sur l'agglomération de Dunkerque
    this.stores = [
      { name: 'Auchan Drive Grande-Synthe', category: 'Alimentaire', vehicle: 'Coffre Classique' },
      { name: 'Carrefour Drive Grande-Synthe', category: 'Alimentaire', vehicle: 'Coffre Classique' },
      { name: 'E.Leclerc Drive Armbouts-Cappel', category: 'Alimentaire', vehicle: 'Coffre Classique' },
      { name: 'Intermarché Coudekerque-Branche', category: 'Alimentaire', vehicle: 'Coffre Classique' },
      { name: 'Leroy Merlin Grande-Synthe', category: 'Bricolage', vehicle: 'Break / Utilitaire' },
      { name: 'Castorama Coudekerque-Branche', category: 'Bricolage', vehicle: 'Break' },
      { name: 'Decathlon Grande-Synthe', category: 'Sport', vehicle: 'Coffre Classique' },
      { name: 'Brico Dépôt Coudekerque-Branche', category: 'Bricolage', vehicle: 'Utilitaire' },
      { name: 'Super U Cappelle-la-Grande', category: 'Alimentaire', vehicle: 'Coffre Classique' },
      { name: 'Carrefour Market Malo-les-Bains', category: 'Alimentaire', vehicle: 'Coffre Classique' }
    ];
  }

  /**
   * Génère une nouvelle notification de course réaliste
   */
  generateRandomDelivery() {
    const isTutTut = Math.random() > 0.45; // 55% Tut Tut, 45% Shopopop
    const store = this.stores[Math.floor(Math.random() * this.stores.length)];
    
    // Distance aléatoire entre 1.5 km et 16 km
    const distance = parseFloat((1.5 + Math.random() * 14.5).toFixed(1));
    
    // Tarification réaliste basée sur la distance et le type de magasin
    let basePrice = 5.50 + (distance * 0.95);
    if (store.category === 'Bricolage') basePrice += 3.50; // Suppléments colis lourds/volumineux
    const price = parseFloat(basePrice.toFixed(2));

    const pricePerKm = parseFloat((price / distance).toFixed(2));

    const delivery = {
      id: 'del_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      platform: isTutTut ? 'tuttut' : 'shopopop',
      title: isTutTut ? 'Tut Tut : Course prioritaire ⚡' : 'Shopopop : Offre de livraison 📦',
      storeName: store.name,
      category: store.category,
      vehicleType: store.vehicle,
      price: price,
      distance: distance,
      pricePerKm: pricePerKm,
      timestamp: new Date(),
      isRead: false
    };

    if (this.onNewDelivery) {
      this.onNewDelivery(delivery);
    }

    return delivery;
  }

  /**
   * Démarre la simulation automatique à intervalles réguliers (toutes les 6 à 12 secondes)
   */
  startAutoSimulation() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Générer une première course immédiatement
    this.generateRandomDelivery();

    const loop = () => {
      if (!this.isRunning) return;
      const delay = Math.floor(6000 + Math.random() * 8000); // 6s à 14s
      this.timer = setTimeout(() => {
        this.generateRandomDelivery();
        loop();
      }, delay);
    };

    loop();
  }

  /**
   * Arrête la simulation automatique
   */
  stopAutoSimulation() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Bascule l'état de la simulation
   */
  toggleAutoSimulation() {
    if (this.isRunning) {
      this.stopAutoSimulation();
    } else {
      this.startAutoSimulation();
    }
    return this.isRunning;
  }
}

// Export global
window.SimulatorManager = SimulatorManager;
