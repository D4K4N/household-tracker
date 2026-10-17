/**
 * Single-office vault: PIN gate + AES-GCM encryption for stored records.
 * The AES data key lives in memory only while unlocked.
 */
const AppVault = {
    storageKey: 'ht_office_vault_v1',
    idleMs: 3 * 60 * 1000,
    dataKey: null,
    idleTimer: null,
    onLock: null,
    _pinResolver: null,

    isSetup() {
        return !!localStorage.getItem(this.storageKey);
    },

    isUnlocked() {
        return !!this.dataKey;
    },

    _bytesToB64(bytes) {
        let s = '';
        bytes.forEach((b) => { s += String.fromCharCode(b); });
        return btoa(s);
    },

    _b64ToBytes(b64) {
        const s = atob(b64);
        const out = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
        return out;
    },

    async _deriveKek(pin, salt) {
        const enc = new TextEncoder();
        const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' },
            base,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    },

    async _encryptRaw(key, bytes) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
        return { iv: this._bytesToB64(iv), data: this._bytesToB64(new Uint8Array(cipher)) };
    },

    async _decryptRaw(key, payload) {
        const iv = this._b64ToBytes(payload.iv);
        const data = this._b64ToBytes(payload.data);
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
        return new Uint8Array(plain);
    },

    async setup(pin) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const kek = await this._deriveKek(pin, salt);
        const rawKey = crypto.getRandomValues(new Uint8Array(32));
        this.dataKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt']);
        const wrapped = await this._encryptRaw(kek, rawKey);
        const verifier = await this._encryptRaw(this.dataKey, new TextEncoder().encode('office-ok'));
        localStorage.setItem(this.storageKey, JSON.stringify({
            salt: this._bytesToB64(salt),
            wrapped,
            verifier
        }));
        this._armIdle();
    },

    async unlock(pin) {
        const cfg = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
        if (!cfg) throw new Error('Vault is not set up');
        const salt = this._b64ToBytes(cfg.salt);
        const kek = await this._deriveKek(pin, salt);
        let raw;
        try {
            raw = await this._decryptRaw(kek, cfg.wrapped);
        } catch (e) {
            throw new Error('Wrong PIN');
        }
        this.dataKey = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
        try {
            const check = await this._decryptRaw(this.dataKey, cfg.verifier);
            if (new TextDecoder().decode(check) !== 'office-ok') throw new Error('Wrong PIN');
        } catch (e) {
            this.dataKey = null;
            throw new Error('Wrong PIN');
        }
        this._armIdle();
    },

    async changePin(oldPin, newPin) {
        if (!/^\d{6,10}$/.test(newPin)) throw new Error('New PIN must be 6–10 digits');
        const cfg = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
        if (!cfg) throw new Error('Vault is not set up');
        const oldKek = await this._deriveKek(oldPin, this._b64ToBytes(cfg.salt));
        let raw;
        try {
            raw = await this._decryptRaw(oldKek, cfg.wrapped);
        } catch (e) {
            throw new Error('Current PIN is wrong');
        }
        this.dataKey = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const kek = await this._deriveKek(newPin, salt);
        const wrapped = await this._encryptRaw(kek, raw);
        const verifier = await this._encryptRaw(this.dataKey, new TextEncoder().encode('office-ok'));
        localStorage.setItem(this.storageKey, JSON.stringify({
            salt: this._bytesToB64(salt),
            wrapped,
            verifier
        }));
        this._armIdle();
    },

    lock() {
        this.dataKey = null;
        this._clearIdle();
        if (typeof this.onLock === 'function') this.onLock();
        this.showLock('locked');
    },

    async encryptJson(obj) {
        if (!this.dataKey) throw new Error('App is locked');
        const bytes = new TextEncoder().encode(JSON.stringify(obj));
        return this._encryptRaw(this.dataKey, bytes);
    },

    async decryptJson(payload) {
        if (!this.dataKey) throw new Error('App is locked');
        const bytes = await this._decryptRaw(this.dataKey, payload);
        return JSON.parse(new TextDecoder().decode(bytes));
    },

    _armIdle() {
        this._clearIdle();
        const bump = () => {
            this._clearIdle();
            this.idleTimer = setTimeout(() => this.lock(), this.idleMs);
        };
        ['touchstart', 'mousedown', 'keydown', 'scroll'].forEach((ev) => {
            document.addEventListener(ev, bump, { passive: true });
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.lock();
        });
        bump();
    },

    _clearIdle() {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.idleTimer = null;
    },

    showLock(mode) {
        const screen = document.getElementById('lockScreen');
        const app = document.getElementById('app');
        const title = document.getElementById('lockTitle');
        const hint = document.getElementById('lockHint');
        const confirmWrap = document.getElementById('lockConfirmWrap');
        const err = document.getElementById('lockError');
        if (!screen) return;
        screen.classList.add('active');
        if (app) app.setAttribute('aria-hidden', 'true');
        document.getElementById('lockPin').value = '';
        document.getElementById('lockPinConfirm').value = '';
        if (err) err.textContent = '';
        screen.dataset.mode = mode;
        if (mode === 'setup') {
            title.textContent = 'Set office PIN';
            hint.textContent = 'This app is for one office. Choose a 6-digit PIN. Data is encrypted on this device.';
            confirmWrap.style.display = 'block';
        } else if (mode === 'confirm') {
            title.textContent = 'Confirm PIN';
            hint.textContent = 'Enter your office PIN to continue.';
            confirmWrap.style.display = 'none';
        } else {
            title.textContent = 'Office lock';
            hint.textContent = 'Confidential water-meter records. Enter PIN to open.';
            confirmWrap.style.display = 'none';
        }
        setTimeout(() => document.getElementById('lockPin').focus(), 200);
    },

    hideLock() {
        const screen = document.getElementById('lockScreen');
        const app = document.getElementById('app');
        if (screen) screen.classList.remove('active');
        if (app) app.removeAttribute('aria-hidden');
    },

    async gate(startApp) {
        this.onLock = () => {
            this.showLock('locked');
        };
        if (!this.isSetup()) {
            this.showLock('setup');
        } else {
            this.showLock('locked');
        }
        return new Promise((resolve) => {
            this._started = false;
            this._startApp = async () => {
                if (this._started) return;
                this._started = true;
                this.hideLock();
                await startApp();
                resolve();
            };
        });
    },

    async submitLock() {
        const err = document.getElementById('lockError');
        const pin = (document.getElementById('lockPin').value || '').trim();
        const confirm = (document.getElementById('lockPinConfirm').value || '').trim();
        const mode = document.getElementById('lockScreen').dataset.mode;
        err.textContent = '';
        if (!/^\d{6,10}$/.test(pin)) {
            err.textContent = 'PIN must be 6–10 digits.';
            return;
        }
        try {
            if (mode === 'setup') {
                if (pin !== confirm) {
                    err.textContent = 'PINs do not match.';
                    return;
                }
                await this.setup(pin);
                document.getElementById('lockPin').dataset.lastPin = pin;
                await this._startApp();
                return;
            }
            if (mode === 'confirm' && this._pinResolver) {
                await this.unlock(pin);
                document.getElementById('lockPin').dataset.lastPin = pin;
                this.hideLock();
                this._pinResolver(true);
                this._pinResolver = null;
                return;
            }
            await this.unlock(pin);
            document.getElementById('lockPin').dataset.lastPin = pin;
            if (this._startApp) await this._startApp();
            else this.hideLock();
        } catch (e) {
            err.textContent = e.message || 'Unlock failed';
        }
    },

    confirmPin() {
        return new Promise((resolve) => {
            this._pinResolver = resolve;
            this.showLock('confirm');
        });
    },

    appendDigit(d) {
        const active = document.activeElement && document.activeElement.id === 'lockPinConfirm'
            ? document.getElementById('lockPinConfirm')
            : document.getElementById('lockPin');
        if (active.value.length < 10) active.value += d;
    },

    backspace() {
        const active = document.activeElement && document.activeElement.id === 'lockPinConfirm'
            ? document.getElementById('lockPinConfirm')
            : document.getElementById('lockPin');
        active.value = active.value.slice(0, -1);
    }
};

window.appVault = AppVault;
window.submitOfficeLock = () => AppVault.submitLock();
window.lockOfficeApp = () => AppVault.lock();
window.appendPinDigit = (d) => AppVault.appendDigit(d);
window.pinBackspace = () => AppVault.backspace();
