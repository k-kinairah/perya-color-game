class AdminPanel {
  constructor(broadcastManager) {
    this.broadcast = broadcastManager;
    this.colors = ['red', 'blue', 'yellow', 'green', 'white', 'pink'];
    this.colorNames = {
      red: 'Red',
      blue: 'Blue',
      green: 'Green',
      yellow: 'Yellow',
      white: 'White',
      pink: 'Pink'
    };
    this.settings = {
      countdownDuration: 5,
      rollDuration: 3,
      revealDuration: 6,
      autoRoll: false,
      autoRollInterval: 0.4,
      soundEnabled: true,
      resultMode: 'fair',
      manualResult: ['red', 'blue', 'green'],
      musicVolume: 0.5,
      effectsVolume: 1
    };
    this.lastState = null;
    this.lastPublicSeenAt = 0;

    this.page = document.getElementById('adminPage');
    this.isAdminRoute = this.detectAdminRoute();

    this.bindElements();
    this.applyRoute();
    this.populateManualSelectors();
    this.bind();
    this.syncFromSettings();
    this.renderManualPreview();
    this.renderLastResult(null);
    this.renderHistory([]);
    this.updateConnection();
    this.startConnectionWatch();
  }

  detectAdminRoute() {
    return window.location.pathname.replace(/\/+$/, '') === '/zaynmalik' ||
      window.location.hash === '#zaynmalik' ||
      new URLSearchParams(window.location.search).has('zaynmalik');
  }

  bindElements() {
    this.connectionStatus = document.getElementById('connectionStatus');
    this.statusPhase = document.getElementById('statusPhase');
    this.statusCountdown = document.getElementById('statusCountdown');
    this.countdownBar = document.getElementById('countdownBar');
    this.statusRound = document.getElementById('statusRound');
    this.statusMode = document.getElementById('statusMode');

    this.startRoundBtn = document.getElementById('adminStartRound');
    this.forceRollBtn = document.getElementById('adminForceRoll');
    this.resetBtn = document.getElementById('adminReset');
    this.clearTopBtn = document.getElementById('adminClearHistoryTop');
    this.clearHistoryBtn = document.getElementById('adminClearHistory');
    this.exportHistoryBtn = document.getElementById('adminExportHistory');

    this.setCountdown = document.getElementById('setCountdown');
    this.setRollTime = document.getElementById('setRollTime');
    this.setReveal = document.getElementById('setReveal');
    this.countdownValue = document.getElementById('countdownValue');
    this.rollValue = document.getElementById('rollValue');
    this.revealValue = document.getElementById('revealValue');

    this.modeInputs = Array.from(document.querySelectorAll('input[name="resultMode"]'));
    this.manualControls = document.getElementById('manualResultControls');
    this.manualPreview = document.getElementById('manualPreview');
    this.manualDieSelects = [
      document.getElementById('manualDie1'),
      document.getElementById('manualDie2'),
      document.getElementById('manualDie3')
    ];

    this.setSound = document.getElementById('setSound');
    this.setAutoRoll = document.getElementById('setAutoRoll');
    this.setMusicVolume = document.getElementById('setMusicVolume');
    this.setEffectsVolume = document.getElementById('setEffectsVolume');
    this.setAutoRollInterval = document.getElementById('setAutoRollInterval');
    this.musicVolumeValue = document.getElementById('musicVolumeValue');
    this.effectsVolumeValue = document.getElementById('effectsVolumeValue');
    this.autoRollIntervalValue = document.getElementById('autoRollIntervalValue');

    this.lastResult = document.getElementById('lastResult');
    this.history = document.getElementById('adminHistory');
  }

  applyRoute(normalize = true) {
    document.body.classList.toggle('admin-route', this.isAdminRoute);
    document.body.classList.toggle('public-route', !this.isAdminRoute);
    if (this.page) this.page.hidden = !this.isAdminRoute;
    if (normalize && this.isAdminRoute && window.location.protocol !== 'file:' &&
        window.location.pathname !== '/admin' && window.history?.replaceState) {
      window.history.replaceState(null, '', '/zaynmalik');
    }
  }

  populateManualSelectors() {
    const options = this.colors
      .map(c => `<option value="${c}">${this.colorNames[c]}</option>`)
      .join('');
    for (const select of this.manualDieSelects) {
      if (select) select.innerHTML = options;
    }
  }

  bind() {
    if (!this.page) return;

    document.querySelectorAll('[data-route]').forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();
        window.location.href = link.getAttribute('href');
      });
    });

    this.broadcast.on('GAME_STATE', state => this.applyState(state));
    this.broadcast.on('STATE_UPDATE', state => this.applyState(state));

    this.startRoundBtn.addEventListener('click', () => this.sendCommand('START_ROUND'));
    this.forceRollBtn.addEventListener('click', () => this.sendCommand('FORCE_RESULT', { dice: this.getManualResult() }));
    this.resetBtn.addEventListener('click', () => this.sendCommand('RESET_ROUND'));
    this.clearTopBtn.addEventListener('click', () => this.sendCommand('CLEAR_HISTORY'));
    this.clearHistoryBtn.addEventListener('click', () => this.sendCommand('CLEAR_HISTORY'));
    this.exportHistoryBtn.addEventListener('click', () => this.exportHistory());

    this.setCountdown.addEventListener('input', () => {
      this.settings.countdownDuration = Math.max(1, parseFloat(this.setCountdown.value) || 5);
      this.syncTimingLabels();
      this.broadcastSettings();
    });
    this.setRollTime.addEventListener('input', () => {
      this.settings.rollDuration = Math.max(1, parseFloat(this.setRollTime.value) || 3);
      this.syncTimingLabels();
      this.broadcastSettings();
    });
    this.setReveal.addEventListener('input', () => {
      this.settings.revealDuration = Math.max(1, parseFloat(this.setReveal.value) || 6);
      this.syncTimingLabels();
      this.broadcastSettings();
    });

    for (const input of this.modeInputs) {
      input.addEventListener('change', () => {
        if (!input.checked) return;
        this.settings.resultMode = input.value;
        this.syncModeUi();
        this.broadcastSettings();
      });
    }

    for (const select of this.manualDieSelects) {
      select.addEventListener('change', () => {
        this.settings.manualResult = this.getManualResult();
        this.renderManualPreview();
        this.broadcastSettings();
      });
    }

    this.setSound.addEventListener('change', () => {
      this.settings.soundEnabled = this.setSound.checked;
      this.broadcastSettings();
    });
    this.setAutoRoll.addEventListener('change', () => {
      this.settings.autoRoll = this.setAutoRoll.checked;
      this.broadcastSettings();
    });
    this.setMusicVolume.addEventListener('input', () => {
      this.settings.musicVolume = this.clamp01(parseFloat(this.setMusicVolume.value));
      this.syncSettingsLabels();
      this.broadcastSettings();
    });
    this.setEffectsVolume.addEventListener('input', () => {
      this.settings.effectsVolume = this.clamp01(parseFloat(this.setEffectsVolume.value));
      this.syncSettingsLabels();
      this.broadcastSettings();
    });
    this.setAutoRollInterval.addEventListener('input', () => {
      this.settings.autoRollInterval = Math.max(0.4, parseFloat(this.setAutoRollInterval.value) || 0.4);
      this.syncSettingsLabels();
      this.broadcastSettings();
    });
  }

  sendCommand(type, payload = {}) {
    this.setButtonsDisabled(true);
    this.broadcast.send(type, payload);
    setTimeout(() => this.updateButtonStates(), 450);
  }

  broadcastSettings() {
    this.broadcast.send('UPDATE_SETTINGS', { settings: { ...this.settings, manualResult: this.settings.manualResult.slice() } });
  }

  applyState(state) {
    this.lastState = state;
    this.lastPublicSeenAt = Date.now();
    this.updateConnection();

    if (state.settings) {
      this.settings = { ...this.settings, ...state.settings };
      if (Array.isArray(state.settings.manualResult)) {
        this.settings.manualResult = state.settings.manualResult.slice();
      }
      this.syncFromSettings();
    }

    this.statusPhase.textContent = state.phase || 'Idle';
    this.statusRound.textContent = String(state.currentRound || 1);
    this.statusMode.textContent = this.modeLabel(this.settings.resultMode);
    this.updateCountdown(state);
    this.renderLastResult(state.lastResult || state.currentResult || null);
    this.renderHistory(state.history || []);
    this.updateButtonStates();
  }

  syncFromSettings() {
    this.setCountdown.value = this.settings.countdownDuration;
    this.setRollTime.value = this.settings.rollDuration;
    this.setReveal.value = this.settings.revealDuration;
    this.setSound.checked = !!this.settings.soundEnabled;
    this.setAutoRoll.checked = !!this.settings.autoRoll;
    this.setMusicVolume.value = this.settings.musicVolume ?? 0.5;
    this.setEffectsVolume.value = this.settings.effectsVolume ?? 1;
    this.setAutoRollInterval.value = this.settings.autoRollInterval ?? 0.4;

    for (const input of this.modeInputs) {
      input.checked = input.value === this.settings.resultMode;
    }

    const manual = Array.isArray(this.settings.manualResult) ? this.settings.manualResult : ['red', 'blue', 'green'];
    this.manualDieSelects.forEach((select, index) => {
      select.value = manual[index] || this.colors[index];
    });

    this.syncTimingLabels();
    this.syncSettingsLabels();
    this.syncModeUi();
    this.renderManualPreview();
  }

  syncTimingLabels() {
    this.countdownValue.textContent = `${this.formatSeconds(this.settings.countdownDuration)}s`;
    this.rollValue.textContent = `${this.formatSeconds(this.settings.rollDuration)}s`;
    this.revealValue.textContent = `${this.formatSeconds(this.settings.revealDuration)}s`;
  }

  syncSettingsLabels() {
    this.musicVolumeValue.textContent = `${Math.round((this.settings.musicVolume ?? 0.5) * 100)}%`;
    this.effectsVolumeValue.textContent = `${Math.round((this.settings.effectsVolume ?? 1) * 100)}%`;
    this.autoRollIntervalValue.textContent = `${this.formatSeconds(this.settings.autoRollInterval ?? 0.4)}s`;
  }

  syncModeUi() {
    const mode = this.settings.resultMode || 'fair';
    this.manualControls.classList.toggle('hidden', mode !== 'manual');
    this.statusMode.textContent = this.modeLabel(mode);
  }

  updateCountdown(state) {
    const progress = state.phase === 'Countdown' ? state.countdownProgress || 0 : 0;
    const remaining = state.phase === 'Countdown'
      ? Math.ceil(state.countdownRemaining || 0)
      : Math.ceil(this.settings.countdownDuration || 5);
    this.countdownBar.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
    this.statusCountdown.textContent = `${remaining} seconds`;
  }

  updateConnection() {
    const connected = Date.now() - this.lastPublicSeenAt < 1600;
    this.connectionStatus.textContent = connected ? 'Connected' : 'Waiting for Public Display...';
    this.connectionStatus.classList.toggle('connected', connected);
    this.connectionStatus.classList.toggle('waiting', !connected);
    this.updateButtonStates();
  }

  startConnectionWatch() {
    setInterval(() => this.updateConnection(), 500);
  }

  updateButtonStates() {
    const connected = Date.now() - this.lastPublicSeenAt < 1600;
    const state = this.lastState || {};
    const busy = state.phase === 'Countdown' || state.phase === 'Rolling' || state.phase === 'Reveal';
    this.startRoundBtn.disabled = !connected || busy;
    this.forceRollBtn.disabled = !connected || busy;
    this.resetBtn.disabled = !connected;
    this.clearTopBtn.disabled = !connected;
    this.clearHistoryBtn.disabled = !connected;
  }

  setButtonsDisabled(disabled) {
    [this.startRoundBtn, this.forceRollBtn, this.resetBtn, this.clearTopBtn, this.clearHistoryBtn].forEach(button => {
      button.disabled = disabled;
    });
  }

  renderManualPreview() {
    this.manualPreview.innerHTML = this.getManualResult()
      .map(color => this.dieIcon(color, this.colorNames[color]))
      .join('');
  }

  renderLastResult(result) {
    if (!result || result.length === 0) {
      this.lastResult.innerHTML = '<p class="admin-empty">No completed rounds yet.</p>';
      return;
    }
    this.lastResult.innerHTML = `<div class="last-result-dice">${result.map(color => this.dieIcon(color, this.colorNames[color])).join('')}</div>`;
  }

  renderHistory(history) {
    if (!this.history) return;
    if (!history.length) {
      this.history.innerHTML = '<p class="admin-empty">No previous results.</p>';
      return;
    }
    this.history.innerHTML = history.slice(0, 10).map(record => {
      const dice = record.result.map(c => this.dieIcon(c, this.colorNames[c])).join('');
      const time = this.formatTime(record.timestamp);
      return `<div class="history-row"><span class="history-index">#${record.round}</span><div>${dice}</div><strong>${time}</strong></div>`;
    }).join('');
  }

  exportHistory() {
    const payload = {
      exportedAt: new Date().toISOString(),
      currentMode: this.settings.resultMode,
      history: this.lastState?.history || []
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'perya-color-history.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  getManualResult() {
    return this.manualDieSelects.map((select, index) => {
      const value = select.value;
      return this.colors.includes(value) ? value : this.colors[index];
    });
  }

  dieIcon(color, label) {
    return `<span class="history-die" title="${label}" style="--die-color:${Die.colorHex(color).fill}"></span>`;
  }

  modeLabel(mode) {
    if (mode === 'manual') return 'Manual Result';
    if (mode === 'weighted') return 'Weighted Random';
    return 'Fair Random';
  }

  formatSeconds(value) {
    const n = Number(value) || 0;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  formatTime(value) {
    if (!value) return '-';
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }
}
