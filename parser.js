/**
 * Parser de Notifications - Tut Tut & Shopopop
 * Extrait les informations clés des notifications Push (Montant, Magasin, Distance, Ville)
 */

class NotificationParser {
  /**
   * Analyse le texte d'une notification push brute et retourne un objet structuré
   * @param {string} title - Titre de la notification
   * @param {string} body - Corps du texte de la notification
   * @param {string} [appPackage] - Package Android optionnel (ex: 'com.tuttut.app' ou 'com.shopopop.driver')
   * @returns {Object} Course structurée
   */
  static parse(title = '', body = '', appPackage = '') {
    const rawText = `${title} ${body}`.trim();
    
    // Détection de la plateforme
    let platform = 'unknown';
    if (appPackage.includes('tuttut') || rawText.toLowerCase().includes('tut tut') || title.toLowerCase().includes('tuttut')) {
      platform = 'tuttut';
    } else if (appPackage.includes('shopopop') || rawText.toLowerCase().includes('shopopop') || title.toLowerCase().includes('shopopop')) {
      platform = 'shopopop';
    } else {
      // Héristique basée sur la structure des phrases
      if (rawText.includes('Cotrap') || rawText.includes('Livraison disponible') || rawText.includes('Tut-Tut')) {
        platform = 'tuttut';
      } else {
        platform = 'shopopop';
      }
    }

    // 1. Extraction du Montant (€)
    let price = 0;
    const priceMatches = rawText.match(/(\d+[.,]?\d*)\s*€/i) || rawText.match(/€\s*(\d+[.,]?\d*)/i);
    if (priceMatches && priceMatches[1]) {
      price = parseFloat(priceMatches[1].replace(',', '.'));
    }

    // 2. Extraction du Magasin / Enseigne
    let storeName = 'Drive Partenaire';
    const knownStores = ['Carrefour', 'Intermarché', 'E.Leclerc', 'Leclerc', 'Leroy Merlin', 'Auchan', 'Brico Dépôt', 'Decathlon', 'Super U', 'Hyper U', 'Système U', 'Castorama', 'Boulanger', 'Monoprix'];
    for (const store of knownStores) {
      if (new RegExp(store, 'i').test(rawText)) {
        storeName = store;
        break;
      }
    }

    // 3. Extraction de la Distance (km)
    let distance = 3.5; // valeur par défaut si non précisée
    const distMatch = rawText.match(/(\d+[.,]?\d*)\s*km/i);
    if (distMatch && distMatch[1]) {
      distance = parseFloat(distMatch[1].replace(',', '.'));
    }

    // 4. Extraction du Type de Véhicule ou Volume
    let vehicleType = 'Coffre Classique';
    if (/break/i.test(rawText)) vehicleType = 'Break';
    if (/utilitaire|fourgon/i.test(rawText)) vehicleType = 'Utilitaire';
    if (/scooter|moto|vélo/i.test(rawText)) vehicleType = 'Deux-roues';

    // 5. Calcul de Rentabilité (€ par km)
    const pricePerKm = distance > 0 ? (price / distance).toFixed(2) : price.toFixed(2);

    return {
      id: 'del_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      platform,
      title: title || `${platform === 'tuttut' ? 'Tut Tut' : 'Shopopop'} - Course disponible`,
      body: body || rawText,
      price: price || 7.50,
      storeName,
      distance: distance,
      pricePerKm: parseFloat(pricePerKm),
      vehicleType,
      timestamp: new Date(),
      isRead: false
    };
  }

  /**
   * Retourne un exemple d'analyse de test
   */
  static getSamplePayloads() {
    return [
      {
        platform: 'tuttut',
        title: 'Tut Tut : Course prioritaire 🚀',
        body: 'Nouvelle livraison disponible à Carrefour Drive (4.2 km) - Gain : 11.50 € - Coffre requis.'
      },
      {
        platform: 'shopopop',
        title: 'Shopopop - Offre autour de vous 📦',
        body: 'Retrait Intermarché Super à 2.8 km -> Livraison Centre-Ville. Rémunération : 8.20 €'
      },
      {
        platform: 'tuttut',
        title: 'Tut Tut - Livraison Bricolage 🛠️',
        body: 'Retrait Leroy Merlin (6.5 km) - 16.00 € - Véhicule Break recommandé.'
      },
      {
        platform: 'shopopop',
        title: 'Shopopop - Course Express ⚡',
        body: 'Nouvelle proposition E.Leclerc Drive (1.9 km). Gain : 6.80 €'
      }
    ];
  }
}

// Export pour le navigateur
window.NotificationParser = NotificationParser;
