/**
 * Notifier System - Gestionnaire d'alertes Sonores, Vocales et Push
 * Génère des bips audio élégants avec Web Audio API et des synthèses vocales
 */

class NotifierSystem {
  constructor() {
    this.soundEnabled = true;
    this.voiceEnabled = true;
    this.pushEnabled = false;
    this.audioCtx = null;

    this.initAudioContext();
  }

  initAudioContext() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    } catch (e) {
      console.warn("Web Audio API non supportée sur ce navigateur.");
    }
  }

  /**
   * Déclenche un son d'alerte moderne (double chime mélodieux)
   * @param {'tuttut'|'shopopop'} platform 
   */
  playAlertSound(platform = 'tuttut') {
    if (!this.soundEnabled) return;

    if (!this.audioCtx) this.initAudioContext();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const osc1 = this.audioCtx.createOscillator();
    const osc2 = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    // Fréquences différentes selon la plateforme
    if (platform === 'tuttut') {
      // Tonalité dynamique Orange (Tut Tut) : Sol 5 -> Do 6
      osc1.frequency.setValueAtTime(783.99, now); // G5
      osc1.frequency.exponentialRampToValueAtTime(1046.50, now + 0.15); // C6
      osc2.frequency.setValueAtTime(392.00, now);
      osc2.frequency.exponentialRampToValueAtTime(523.25, now + 0.15);
    } else {
      // Tonalité fluide Bleue (Shopopop) : Mi 5 -> La 5
      osc1.frequency.setValueAtTime(659.25, now); // E5
      osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.15); // A5
      osc2.frequency.setValueAtTime(329.63, now);
      osc2.frequency.exponentialRampToValueAtTime(440.00, now + 0.15);
    }

    osc1.type = 'sine';
    osc2.type = 'triangle';

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  }

  /**
   * Synthèse vocale en français pour annoncer la course sans regarder l'écran
   * @param {Object} delivery 
   */
  speakDelivery(delivery) {
    if (!this.voiceEnabled || !('speechSynthesis' in window)) return;

    // Annuler la parole précédente pour ne pas accumuler de retard
    window.speechSynthesis.cancel();

    const platformName = delivery.platform === 'tuttut' ? 'Tut Tut' : 'Shopopop';
    const text = `Nouvelle course ${platformName}. ${delivery.storeName}. ${delivery.price.toString().replace('.', ' virgule ')} euros. Distance ${delivery.distance} kilomètres.`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.1; // Légèrement plus rapide pour la réactivité
    utterance.pitch = 1.0;

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Demande la permission pour les notifications du navigateur
   */
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      alert("Votre navigateur ne prend pas en charge les notifications de bureau.");
      return false;
    }

    const permission = await Notification.requestPermission();
    this.pushEnabled = (permission === 'granted');
    return this.pushEnabled;
  }

  /**
   * Envoie une notification système native sur l'ordinateur/téléphone
   * @param {Object} delivery 
   */
  sendDesktopNotification(delivery) {
    if (!this.pushEnabled || Notification.permission !== 'granted') return;

    const platformTitle = delivery.platform === 'tuttut' ? '🍊 Tut Tut' : '🔷 Shopopop';
    const title = `${platformTitle} - ${delivery.price.toFixed(2)} €`;
    const options = {
      body: `${delivery.storeName} (${delivery.distance} km) - Rentabilité: ${delivery.pricePerKm} €/km`,
      icon: delivery.platform === 'tuttut' ? 'https://cdn-icons-png.flaticon.com/512/2972/2972531.png' : 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png',
      tag: delivery.id
    };

    new Notification(title, options);
  }
}

// Export global
window.NotifierSystem = NotifierSystem;
