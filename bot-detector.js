(function() {
  'use strict';

  const BotDetector = {
    signals: [],
    score: 0,
    maxScore: 100,
    sessionStart: Date.now(),
    interactions: { mouseMoves: 0, mouseClicks: 0, scrollEvents: 0, keyPresses: 0, touchEvents: 0, lastActivity: Date.now() },
    fingerprint: {},

    checkWebView() {
      const ua = navigator.userAgent;
      const signals = [];
      if (window.AppInventor) { signals.push('app-inventor-bridge'); this.score += 30; }
      if (window.webkit && window.webkit.messageHandlers) { signals.push('webkit-message-handlers'); this.score += 15; }
      if (ua.includes('Windows NT 5.1') && ua.includes('Chrome/0.')) { signals.push('known-bot-user-agent'); this.score += 40; }
      if (window.chrome && !window.chrome.runtime) { signals.push('chrome-no-runtime'); this.score += 15; }
      if (navigator.webdriver) { signals.push('navigator-webdriver'); this.score += 35; }
      if (window.outerWidth === 0 && window.outerHeight === 0) { signals.push('no-outer-size'); this.score += 20; }
      return signals;
    },

    checkFingerprint() {
      const signals = [];
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            this.fingerprint.webgl = { vendor, renderer };
            if (vendor === 'Google Inc. (NVIDIA)' && renderer.includes('SwiftShader')) {
              signals.push('swiftshader-headless'); this.score += 25;
            }
          }
        }
        if (navigator.plugins.length === 0) { signals.push('no-plugins'); this.score += 10; }
        if (!navigator.language || navigator.languages.length === 0) { signals.push('no-language'); this.score += 5; }
        if (screen.width === 0 || screen.height === 0) { signals.push('invalid-screen-size'); this.score += 15; }
        if (!navigator.deviceMemory) { signals.push('no-device-memory'); this.score += 5; }
        if (!navigator.hardwareConcurrency || navigator.hardwareConcurrency === 0) { signals.push('no-hardware-concurrency'); this.score += 5; }
      } catch (e) { signals.push('fingerprint-error'); this.score += 5; }
      return signals;
    },

    setupBehaviorTracking() {
      document.addEventListener('mousemove', () => { this.interactions.mouseMoves++; this.interactions.lastActivity = Date.now(); }, { passive: true });
      document.addEventListener('click', () => { this.interactions.mouseClicks++; this.interactions.lastActivity = Date.now(); }, { passive: true });
      document.addEventListener('scroll', () => { this.interactions.scrollEvents++; this.interactions.lastActivity = Date.now(); }, { passive: true });
      document.addEventListener('keydown', () => { this.interactions.keyPresses++; this.interactions.lastActivity = Date.now(); }, { passive: true });
      document.addEventListener('touchstart', () => { this.interactions.touchEvents++; this.interactions.lastActivity = Date.now(); }, { passive: true });
    },

    checkBehavior() {
      const signals = [];
      const elapsed = Date.now() - this.sessionStart;
      if (elapsed > 5000 && this.interactions.mouseMoves === 0) { signals.push('no-mouse-movement'); this.score += 20; }
      const hasButtons = document.querySelectorAll('button, a, [role="button"]').length;
      if (hasButtons > 0 && this.interactions.mouseClicks === 0 && elapsed > 10000) { signals.push('no-interaction-with-elements'); this.score += 15; }
      const pageHeight = document.documentElement.scrollHeight;
      if (pageHeight > window.innerHeight * 1.5 && this.interactions.scrollEvents === 0 && elapsed > 8000) { signals.push('no-scroll-on-long-page'); this.score += 10; }
      return signals;
    },

    checkNetwork() {
      const signals = [];
      if (!document.referrer || document.referrer === '') { signals.push('no-referrer'); this.score += 5; }
      if (window.self !== window.top) { signals.push('loaded-in-iframe'); this.score += 10; }
      return signals;
    },

    collect() {
      const webViewSignals = this.checkWebView();
      const fingerprintSignals = this.checkFingerprint();
      const behaviorSignals = this.checkBehavior();
      const networkSignals = this.checkNetwork();
      this.signals = [...webViewSignals, ...fingerprintSignals, ...behaviorSignals, ...networkSignals];
      return {
        score: this.score,
        maxScore: this.maxScore,
        isBot: this.score >= 50,
        isSuspicious: this.score >= 25,
        signals: this.signals,
        fingerprint: this.fingerprint,
        interactions: this.interactions,
        userAgent: navigator.userAgent,
        screen: { width: screen.width, height: screen.height, availWidth: screen.availWidth, availHeight: screen.availHeight, colorDepth: screen.colorDepth, pixelRatio: window.devicePixelRatio },
        window: { width: window.innerWidth, height: window.innerHeight, outerWidth: window.outerWidth, outerHeight: window.outerHeight },
        navigator: { webdriver: navigator.webdriver, languages: navigator.languages, language: navigator.language, platform: navigator.platform, hardwareConcurrency: navigator.hardwareConcurrency, deviceMemory: navigator.deviceMemory, maxTouchPoints: navigator.maxTouchPoints, plugins: navigator.plugins.length },
        timestamp: Date.now(),
        sessionDuration: Date.now() - this.sessionStart
      };
    },

    async report(endpoint) {
      const data = this.collect();
      try {
        await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      } catch (e) { console.error('Bot detection report failed:', e); }
      return data;
    },

    init(options = {}) {
      this.setupBehaviorTracking();
      window.addEventListener('load', () => {
        setTimeout(() => {
          const data = this.collect();
          if (options.onDetect && (data.isBot || data.isSuspicious)) { options.onDetect(data); }
          if (options.endpoint) { this.report(options.endpoint); }
          if (options.debug) { console.log('[BotDetector]', data); }
        }, options.delay || 3000);
      });
      if (options.recheckInterval) {
        setInterval(() => {
          const data = this.collect();
          if (options.onDetect && (data.isBot || data.isSuspicious)) { options.onDetect(data); }
        }, options.recheckInterval);
      }
      return this;
    }
  };

  window.BotDetector = BotDetector;
  if (window.BOT_DETECTOR_CONFIG) { BotDetector.init(window.BOT_DETECTOR_CONFIG); }
})();