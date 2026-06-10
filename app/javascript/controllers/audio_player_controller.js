import { Controller } from "@hotwired/stimulus";
import { Icons } from "./icons";

export default class extends Controller {
    static targets = [
        "player",
        "waveform",
        "playButton",
        "previousButton",
        "nextButton",
        "saveQueueButton",
        "saveQueuePanel",
        "saveQueueInput",
        "saveQueueStatus",
        "saveTrackButton",
        "saveTrackPanel",
        "saveTrackList",
        "saveTrackInput",
        "saveTrackStatus",
        "currentTime",
        "duration",
        "volumeButton",
        "volumeSlider",
        "trackTitle",
        "trackArtist",
        "trackImage",
        "queueTitle",
        "likeButton",
        "likeIcon"
    ];

    static values = {
        likedIcon: String,
        unlikedIcon: String,
        likedTitle: String,
        unlikedTitle: String,
        playlistCreateUrl: String,
        playlistSaveUrl: String,
        playlists: Array
    };

    connect() {
        this.metadataCache ||= new Map();
        this.metadataRequests ||= new Map();

        if (this.audioElement) {
            this.attachDocumentListeners();
            this.setupMediaSession();
            this.updateLikeButton();
            this.updateSaveTrackButton();
            this.updateQueueControls();
            this.updatePlayButton();
            this.updateMediaSession();
            this.broadcastPlaybackState();
            this.drawWaveform();
            return;
        }

        this.isPlaying = false;
        this.currentTrack = null;
        this.currentQueue = [];
        this.currentQueueName = '';
        this.currentQueueUrl = null;
        this.currentQueueIndex = 0;
        this.currentContextType = null;
        this.currentContextId = null;
        this.isAppeared = false;
        this.currentLoadToken = null;
        this.handledFinishToken = null;
        this.isAdvancingAfterFinish = false;
        this.lastAutoAdvanceAt = 0;
        this.waveformData = null;
        this.waveformDuration = null;
        this.metadataCache = new Map();
        this.metadataRequests = new Map();

        this.updatePlayButton();
        this.volumeButtonTarget.innerHTML = Icons.highSound;
        this.volumeButtonTarget.title = 'Выключить звук';
        this.volumeButtonTarget.setAttribute('aria-label', 'Выключить звук');

        // Only the native HTML5 audio element receives the audio URL.
        // This preserves normal browser Range-request streaming. The waveform is
        // rendered separately from JSON peaks and never fetches the audio file.
        this.audioElement = new Audio();
        this.audioElement.preload = 'metadata';
        this.setupNativeAudioListeners();
        this.setupWaveformRenderer();
        this.setupMediaSession();

        const savedVolume = this.getSavedVolume();
        this.setVolume(null, savedVolume);

        this.attachDocumentListeners();
        this.updateLikeButton();
        this.updateSaveTrackButton();
        this.updateQueueControls();
        this.broadcastPlaybackState();
    }

    attachDocumentListeners() {
        if (this.documentListenersAttached) return;

        this.handlePlayTrackEvent ||= this.handlePlayTrack.bind(this);
        this.handlePlayQueueEvent ||= this.handlePlayQueue.bind(this);
        this.handleLikeChangedEvent ||= this.handleLikeChanged.bind(this);
        document.addEventListener('play-track', this.handlePlayTrackEvent);
        document.addEventListener('play-queue', this.handlePlayQueueEvent);
        document.addEventListener('like-button:changed', this.handleLikeChangedEvent);
        this.documentListenersAttached = true;
    }

    detachDocumentListeners() {
        if (!this.documentListenersAttached) return;

        document.removeEventListener('play-track', this.handlePlayTrackEvent);
        document.removeEventListener('play-queue', this.handlePlayQueueEvent);
        document.removeEventListener('like-button:changed', this.handleLikeChangedEvent);
        this.documentListenersAttached = false;
    }

    setupNativeAudioListeners() {
        if (!this.audioElement || this.nativeAudioListenersAttached) return;

        this.audioElement.addEventListener('loadedmetadata', () => this.updateDurationFromMedia());
        this.audioElement.addEventListener('durationchange', () => this.updateDurationFromMedia());
        this.audioElement.addEventListener('canplay', () => this.updateDurationFromMedia());
        this.audioElement.addEventListener('timeupdate', () => this.updateCurrentTimeFromMedia());

        this.audioElement.addEventListener('play', () => {
            this.isPlaying = true;
            this.updatePlayButton();
            this.updateMediaSession();
            this.broadcastPlaybackState();
        });

        this.audioElement.addEventListener('pause', () => {
            if (!this.audioElement.ended) {
                this.isPlaying = false;
                this.updatePlayButton();
                this.updateMediaSession();
                this.broadcastPlaybackState();
            }
        });

        this.audioElement.addEventListener('ended', () => this.handleTrackFinished());
        this.nativeAudioListenersAttached = true;
    }

    setupMediaSession() {
        if (!('mediaSession' in navigator) || this.mediaSessionConfigured) return;

        const safeAction = (action, handler) => {
            try {
                navigator.mediaSession.setActionHandler(action, handler);
            } catch (_error) {
                // Some browsers expose Media Session only partially.
            }
        };

        safeAction('play', () => this.playMedia());
        safeAction('pause', () => {
            if (!this.audioElement) return;
            this.audioElement.pause();
            this.isPlaying = false;
            this.updatePlayButton();
            this.updateMediaSession();
            this.broadcastPlaybackState();
        });
        safeAction('previoustrack', () => this.previousTrack());
        safeAction('nexttrack', () => this.nextTrack());
        safeAction('seekbackward', (details) => this.seekRelative(-(details.seekOffset || 10)));
        safeAction('seekforward', (details) => this.seekRelative(details.seekOffset || 10));
        safeAction('seekto', (details) => {
            if (!this.audioElement || !Number.isFinite(details.seekTime)) return;
            this.audioElement.currentTime = details.seekTime;
            this.updateCurrentTimeFromMedia();
        });

        this.mediaSessionConfigured = true;
    }

    seekRelative(offset) {
        if (!this.audioElement) return;

        const duration = this.bestKnownDuration();
        const current = Number(this.audioElement.currentTime) || 0;
        const next = duration ? Math.min(Math.max(current + offset, 0), duration) : Math.max(current + offset, 0);
        this.audioElement.currentTime = next;
        this.updateCurrentTimeFromMedia();
    }

    updateMediaSession() {
        if (!('mediaSession' in navigator)) return;

        try {
            navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';

            if (!this.currentTrack) return;

            const metadataKey = `${this.currentTrack.id || ''}:${this.currentTrack.title || ''}:${this.currentTrack.artist || ''}:${this.currentTrack.image || ''}:${this.currentQueueName || ''}`;
            if (this.lastMediaMetadataKey !== metadataKey && 'MediaMetadata' in window) {
                const artwork = [];
                if (this.currentTrack.image) {
                    artwork.push({ src: this.currentTrack.image, sizes: '512x512', type: 'image/png' });
                }

                navigator.mediaSession.metadata = new MediaMetadata({
                    title: this.currentTrack.title || 'Без названия',
                    artist: this.currentTrack.artist || '',
                    album: this.currentQueueName || '',
                    artwork
                });
                this.lastMediaMetadataKey = metadataKey;
            }

            const duration = this.bestKnownDuration();
            const currentTime = Number(this.audioElement?.currentTime) || 0;
            if (duration && typeof navigator.mediaSession.setPositionState === 'function') {
                navigator.mediaSession.setPositionState({ duration, playbackRate: 1, position: Math.min(currentTime, duration) });
            }
        } catch (_error) {
            // Ignore Media Session metadata errors; playback must keep working.
        }
    }

    updateDurationFromMedia() {
        const duration = Number(this.audioElement?.duration);
        if (!Number.isFinite(duration) || duration <= 0) return;

        if (this.currentTrack) {
            this.currentTrack.duration = duration;
        }

        this.waveformDuration = duration;
        this.durationTarget.textContent = this.formatTime(duration);
        this.drawWaveform();
        this.updateMediaSession();
        this.broadcastPlaybackState();
    }

    updateCurrentTimeFromMedia() {
        const currentTime = Number(this.audioElement?.currentTime);
        if (!Number.isFinite(currentTime) || currentTime < 0) return;

        this.currentTimeTarget.textContent = this.formatTime(currentTime);
        this.drawWaveform();
        this.updateMediaSession();
    }

    bestKnownDuration() {
        const mediaDuration = Number(this.audioElement?.duration);
        if (Number.isFinite(mediaDuration) && mediaDuration > 0) return mediaDuration;

        const waveformDuration = Number(this.waveformDuration);
        if (Number.isFinite(waveformDuration) && waveformDuration > 0) return waveformDuration;

        const currentTrackDuration = Number(this.currentTrack?.duration);
        if (Number.isFinite(currentTrackDuration) && currentTrackDuration > 0) return currentTrackDuration;

        return null;
    }

    handlePlayTrack(event) {
        const detail = event.detail || {};

        if (detail.toggle && this.shouldToggleCurrent(detail)) {
            this.playPause();
            return;
        }

        const queue = Array.isArray(detail.queue) && detail.queue.length > 0 ? detail.queue : [detail];
        const queueName = detail.queueName || 'Очередь воспроизведения';
        const queueIndex = Number.isInteger(detail.queueIndex) ? detail.queueIndex : this.indexForTrack(queue, detail.id);
        const context = this.contextFromDetail(detail);

        this.loadQueue(queue, queueName, queueIndex, true, context);
    }

    handlePlayQueue(event) {
        const detail = event.detail || {};

        if (detail.toggle && this.shouldToggleCurrent(detail)) {
            this.playPause();
            return;
        }

        const queue = Array.isArray(detail.queue) ? detail.queue : [];
        const queueName = detail.queueName || 'Очередь воспроизведения';
        const queueIndex = Number.isInteger(detail.queueIndex) ? detail.queueIndex : 0;
        const context = this.contextFromDetail(detail);

        this.loadQueue(queue, queueName, queueIndex, true, context);
    }

    disconnect() {
        this.detachDocumentListeners();
    }

    setupWaveformRenderer() {
        if (!this.hasWaveformTarget || this.waveformCanvas) return;

        this.waveformTarget.innerHTML = '';
        this.waveformTarget.style.height ||= '100px';

        this.waveformCanvas = document.createElement('canvas');
        this.waveformCanvas.className = 'block w-full h-full';
        this.waveformCanvas.style.width = '100%';
        this.waveformCanvas.style.height = '100%';
        this.waveformTarget.appendChild(this.waveformCanvas);

        this.handleWaveformSeekEvent ||= this.seekWaveform.bind(this);
        this.handleWaveformResizeEvent ||= this.drawWaveform.bind(this);
        this.waveformTarget.addEventListener('click', this.handleWaveformSeekEvent);
        window.addEventListener('resize', this.handleWaveformResizeEvent);

        this.drawWaveform();
    }

    renderWaveform(peaks, duration = null) {
        this.waveformData = this.validPeaks(peaks) ? this.normalizePeaks(peaks) : null;
        this.waveformDuration = Number(duration) > 0 ? Number(duration) : this.bestKnownDuration();
        this.drawWaveform();
    }

    normalizePeaks(peaks) {
        const channels = Array.isArray(peaks?.[0]) ? peaks : [peaks];
        const longestChannelLength = Math.max(...channels.map((channel) => Array.isArray(channel) ? channel.length : 0));
        const pointCount = Math.floor(longestChannelLength / 2);
        if (!Number.isFinite(pointCount) || pointCount <= 0) return [];

        const normalized = [];

        for (let index = 0; index < pointCount; index += 1) {
            let min = 1;
            let max = -1;
            let touched = false;

            channels.forEach((channel) => {
                if (!Array.isArray(channel)) return;

                const channelMin = Number(channel[index * 2]);
                const channelMax = Number(channel[index * 2 + 1]);
                if (!Number.isFinite(channelMin) || !Number.isFinite(channelMax)) return;

                min = Math.min(min, channelMin);
                max = Math.max(max, channelMax);
                touched = true;
            });

            normalized.push(touched ? Math.max(Math.abs(min), Math.abs(max)) : 0);
        }

        const maxAmplitude = Math.max(...normalized, 0);
        if (maxAmplitude <= 0) return normalized;

        return normalized.map((value) => value / maxAmplitude);
    }

    drawWaveform() {
        if (!this.waveformCanvas || !this.hasWaveformTarget) return;

        const rect = this.waveformTarget.getBoundingClientRect();
        const cssWidth = Math.max(1, Math.floor(rect.width || this.waveformTarget.clientWidth || 1));
        const cssHeight = Math.max(60, Math.floor(rect.height || this.waveformTarget.clientHeight || 100));
        const ratio = window.devicePixelRatio || 1;

        const canvasWidth = Math.floor(cssWidth * ratio);
        const canvasHeight = Math.floor(cssHeight * ratio);
        if (this.waveformCanvas.width !== canvasWidth) this.waveformCanvas.width = canvasWidth;
        if (this.waveformCanvas.height !== canvasHeight) this.waveformCanvas.height = canvasHeight;

        const context = this.waveformCanvas.getContext('2d');
        if (!context) return;

        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, cssWidth, cssHeight);

        const progress = this.playbackProgress();
        const data = Array.isArray(this.waveformData) ? this.waveformData : [];

        if (data.length === 0) {
            this.drawEmptyWaveform(context, cssWidth, cssHeight, progress);
            return;
        }

        const barCount = Math.max(1, Math.min(cssWidth, data.length));
        const samplesPerBar = data.length / barCount;
        const barWidth = Math.max(1, cssWidth / barCount);
        const progressX = cssWidth * progress;

        for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
            const start = Math.floor(barIndex * samplesPerBar);
            const end = Math.max(start + 1, Math.floor((barIndex + 1) * samplesPerBar));
            const amplitude = Math.max(...data.slice(start, end), 0);
            const barHeight = Math.max(2, amplitude * cssHeight * 0.82);
            const x = barIndex * barWidth;
            const y = (cssHeight - barHeight) / 2;

            context.fillStyle = x <= progressX ? '#383351' : '#4F4A85';
            context.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
        }
    }

    drawEmptyWaveform(context, width, height, progress) {
        const centerY = height / 2;
        const progressX = width * progress;

        context.lineWidth = 2;
        context.strokeStyle = '#4F4A85';
        context.beginPath();
        context.moveTo(0, centerY);
        context.lineTo(width, centerY);
        context.stroke();

        if (progressX > 0) {
            context.strokeStyle = '#383351';
            context.beginPath();
            context.moveTo(0, centerY);
            context.lineTo(progressX, centerY);
            context.stroke();
        }
    }

    playbackProgress() {
        const duration = this.bestKnownDuration();
        const currentTime = Number(this.audioElement?.currentTime);
        if (!duration || !Number.isFinite(currentTime) || currentTime <= 0) return 0;

        return Math.min(Math.max(currentTime / duration, 0), 1);
    }

    seekWaveform(event) {
        if (!this.currentTrack || !this.audioElement) return;

        const duration = this.bestKnownDuration();
        if (!duration) return;

        const rect = this.waveformTarget.getBoundingClientRect();
        if (!rect.width) return;

        const progress = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
        this.audioElement.currentTime = progress * duration;
        this.updateCurrentTimeFromMedia();
    }

    async loadQueue(queue, queueName, queueIndex = 0, autoplay = true, context = {}) {
        const tracks = queue.map((track) => this.normalizeTrack(track)).filter((track) => track.url);
        if (tracks.length === 0) return;

        this.currentQueue = tracks;
        this.currentQueueName = queueName || 'Очередь воспроизведения';
        this.currentQueueUrl = context.url || this.urlForContext(context.type, context.id);
        this.currentQueueIndex = this.safeQueueIndex(queueIndex, tracks);
        this.currentContextType = context.type || null;
        this.currentContextId = context.id || null;
        this.updateQueueControls();
        this.broadcastPlaybackState();

        await this.loadCurrentQueueTrack(autoplay);
    }

    async loadCurrentQueueTrack(autoplay = true) {
        const track = this.currentQueue[this.currentQueueIndex];
        if (!track) return;

        await this.loadTrack(track.id, track.url, track.name, track.artist, track.image, track.liked, track.likeUrl, track.unlikeUrl, track.metadataUrl, track.duration, autoplay);
    }

    async loadTrack(trackId, trackUrl, trackName, trackArtist, trackImage, liked = false, likeUrl = null, unlikeUrl = null, metadataUrl = null, fallbackDuration = null, autoplay = true) {
        if (!this.audioElement || !trackUrl) return;

        const loadToken = Symbol('track-load');
        this.currentLoadToken = loadToken;

        this.currentTrack = {
            id: trackId,
            title: trackName,
            artist: trackArtist,
            image: trackImage,
            liked: liked,
            likeUrl: likeUrl || `/like_track/${trackId}`,
            unlikeUrl: unlikeUrl || `/like_track/${trackId}`,
            metadataUrl: metadataUrl,
            duration: fallbackDuration
        };

        this.audioElement.pause();
        this.audioElement.removeAttribute('src');
        this.audioElement.load();

        const cachedMetadata = this.cachedTrackMetadata(metadataUrl);
        const cachedDuration = Number(cachedMetadata?.duration);
        const initialDuration = cachedDuration > 0 ? cachedDuration : fallbackDuration;
        const cachedPeaks = cachedMetadata?.analyzed === true && this.validPeaks(cachedMetadata.peaks)
            ? cachedMetadata.peaks
            : null;

        this.renderCurrentTrackInfo();
        this.updateMediaSession();
        this.currentTimeTarget.textContent = '0:00';
        this.durationTarget.textContent = initialDuration ? this.formatTime(initialDuration) : '0:00';
        this.renderWaveform(cachedPeaks, initialDuration);
        this.updateLikeButton();
        this.updateSaveTrackButton();
        this.updateQueueControls();
        this.playerTarget.classList.remove("hidden");
        this.isAppeared = true;
        this.isPlaying = false;
        this.updatePlayButton();
        this.broadcastPlaybackState();

        // Start the native audio request immediately. Metadata/waveform fetching
        // must never block playback startup. The audio URL is used only here, so
        // the browser keeps normal Range-request streaming.
        this.audioElement.preload = autoplay ? 'auto' : 'metadata';
        this.audioElement.src = trackUrl;

        this.fetchAndRenderTrackMetadata(metadataUrl, fallbackDuration, loadToken);

        if (autoplay) {
            await this.playMedia();
        } else {
            this.audioElement.load();
            this.isPlaying = false;
        }

        fetch(`/tracks/${trackId}/stream`, {
            method: 'POST',
            headers: {
                'X-CSRF-Token': this.csrfToken(),
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin'
        }).catch(() => {});

        if (this.currentLoadToken !== loadToken) return;

        this.updateDurationFromMedia();
        this.updatePlayButton();
        this.updateMediaSession();
        this.broadcastPlaybackState();
    }

    async playPause() {
        if (!this.audioElement || !this.currentTrack) return;

        if (this.isPlaying) {
            this.audioElement.pause();
            this.isPlaying = false;
        } else {
            await this.playMedia();
        }

        this.updatePlayButton();
        this.broadcastPlaybackState();
    }

    async playMedia() {
        if (!this.audioElement?.src) return;

        try {
            await this.audioElement.play();
            this.isPlaying = true;
            this.updateMediaSession();
        } catch (error) {
            console.warn('Не удалось начать воспроизведение', error);
            this.isPlaying = false;
        }
    }

    async nextTrack(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        await this.advanceQueueBy(1, true);
    }

    async previousTrack(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        await this.advanceQueueBy(-1, true);
    }

    async advanceQueueBy(step, autoplay = true) {
        if (this.currentQueue.length === 0) return;

        this.currentQueueIndex = (this.currentQueueIndex + step + this.currentQueue.length) % this.currentQueue.length;
        this.updateQueueControls();
        this.broadcastPlaybackState();
        await this.loadCurrentQueueTrack(autoplay);
    }

    async handleTrackFinished() {
        const finishToken = this.currentLoadToken;
        const now = Date.now();
        if (this.isAdvancingAfterFinish || this.handledFinishToken === finishToken || now - this.lastAutoAdvanceAt < 750) return;
        this.handledFinishToken = finishToken;

        if (this.currentQueue.length > 1) {
            this.isAdvancingAfterFinish = true;
            this.lastAutoAdvanceAt = now;
            try {
                await this.advanceQueueBy(1, true);
            } finally {
                window.setTimeout(() => {
                    this.isAdvancingAfterFinish = false;
                }, 250);
            }
            return;
        }

        this.isPlaying = false;
        this.updatePlayButton();
        this.broadcastPlaybackState();
    }

    noop(event) {
        if (event) event.stopPropagation();
    }

    toggleSaveQueueMenu(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (this.currentQueue.length === 0 || !this.hasSaveQueuePanelTarget) return;

        if (this.saveQueuePanelTarget.classList.contains('hidden')) {
            this.openSaveQueueMenu();
        } else {
            this.closeSaveQueueMenu();
        }
    }

    openSaveQueueMenu() {
        if (!this.hasSaveQueuePanelTarget) return;

        this.saveQueuePanelTarget.classList.remove('hidden');
        this.setSaveQueueStatus('');

        if (this.hasSaveQueueInputTarget) {
            this.saveQueueInputTarget.value = this.currentQueueName || 'Мой плейлист';
            requestAnimationFrame(() => {
                this.saveQueueInputTarget.focus();
                this.saveQueueInputTarget.select();
            });
        }
    }

    closeSaveQueueMenu(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (!this.hasSaveQueuePanelTarget) return;
        this.saveQueuePanelTarget.classList.add('hidden');
        this.setSaveQueueStatus('');
    }

    async saveQueue(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (this.currentQueue.length === 0) return;

        const defaultName = this.currentQueueName || 'Мой плейлист';
        const name = this.hasSaveQueueInputTarget ? this.saveQueueInputTarget.value : defaultName;
        if (!name || !name.trim()) {
            this.setSaveQueueStatus('Введите название плейлиста');
            if (this.hasSaveQueueInputTarget) this.saveQueueInputTarget.focus();
            return;
        }

        this.setSaveQueueLoading(true);
        this.setSaveQueueStatus('Сохраняем...');

        try {
            const response = await fetch(this.playlistCreateUrl(), {
                method: 'POST',
                headers: {
                    'X-CSRF-Token': this.csrfToken(),
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    playlist: {
                        name: name.trim(),
                        description: `Сохранено из временной очереди «${defaultName}»`
                    },
                    track_ids: this.currentQueue.map((track) => track.id)
                })
            });

            if (response.redirected) {
                window.location.href = response.url;
                return;
            }

            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Не удалось сохранить плейлист');

            if (data.playlist) {
                this.currentQueueName = `Плейлист: ${data.playlist.name}`;
                this.currentContextType = 'playlist';
                this.currentContextId = data.playlist.id;
                this.currentQueueUrl = data.playlist.url || this.urlForContext('playlist', data.playlist.id);
                this.updateQueueControls();
                this.broadcastPlaybackState();
            }

            this.setSaveQueueStatus(data.message || 'Плейлист сохранён', this.currentQueueUrl, 'Открыть');
        } catch (error) {
            console.error(error);
            this.setSaveQueueStatus(error.message || 'Не удалось сохранить плейлист');
        } finally {
            this.setSaveQueueLoading(false);
        }
    }


    toggleSaveTrackMenu(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (!this.currentTrack || !this.hasSaveTrackPanelTarget) return;

        if (this.saveTrackPanelTarget.classList.contains('hidden')) {
            this.openSaveTrackMenu();
        } else {
            this.closeSaveTrackMenu();
        }
    }

    openSaveTrackMenu() {
        if (!this.hasSaveTrackPanelTarget) return;

        this.renderSaveTrackList();
        this.setSaveTrackStatus('');
        this.saveTrackPanelTarget.classList.remove('hidden');

        if (this.hasSaveTrackInputTarget) {
            this.saveTrackInputTarget.value = '';
        }
    }

    closeSaveTrackMenu(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (!this.hasSaveTrackPanelTarget) return;
        this.saveTrackPanelTarget.classList.add('hidden');
        this.setSaveTrackStatus('');
    }

    renderSaveTrackList() {
        if (!this.hasSaveTrackListTarget) return;

        const playlists = this.playlistsValue || [];
        if (playlists.length === 0) {
            this.saveTrackListTarget.innerHTML = '<div class="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-3 py-3 text-sm text-neutral-400">У вас пока нет плейлистов. Создайте новый ниже.</div>';
            return;
        }

        this.saveTrackListTarget.innerHTML = playlists.map((playlist) => `
            <button type="button"
                    data-playlist-id="${this.escapeAttribute(playlist.id)}"
                    data-action="audio-player#saveCurrentTrackToExistingPlaylist"
                    class="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-neutral-900">
                <span class="min-w-0 truncate text-sm font-semibold text-white">${this.escapeHtml(playlist.name)}</span>
                <span class="shrink-0 text-xs text-green-300">Добавить</span>
            </button>
        `).join('');
    }

    async saveCurrentTrackToExistingPlaylist(event) {
        event.preventDefault();
        event.stopPropagation();

        const playlistId = event.currentTarget.dataset.playlistId;
        if (!playlistId) return;

        await this.saveCurrentTrackToPlaylist({ playlist_id: playlistId });
    }

    async saveCurrentTrackToNewPlaylist(event) {
        event.preventDefault();
        event.stopPropagation();

        const name = this.hasSaveTrackInputTarget ? this.saveTrackInputTarget.value.trim() : '';
        if (!name) {
            this.setSaveTrackStatus('Введите название плейлиста');
            if (this.hasSaveTrackInputTarget) this.saveTrackInputTarget.focus();
            return;
        }

        await this.saveCurrentTrackToPlaylist({ playlist_name: name });
    }

    async saveCurrentTrackToPlaylist(payload) {
        if (!this.currentTrack) return;

        this.setSaveTrackLoading(true);
        this.setSaveTrackStatus('Сохраняем...');

        try {
            const response = await fetch(this.playlistSaveEndpoint(), {
                method: 'POST',
                headers: {
                    'X-CSRF-Token': this.csrfToken(),
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify({ track_id: this.currentTrack.id, ...payload })
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Не удалось сохранить трек');

            this.addPlaylistOption(data.playlist);
            this.renderSaveTrackList();
            if (this.hasSaveTrackInputTarget) this.saveTrackInputTarget.value = '';
            this.setSaveTrackStatus(data.message || 'Трек сохранён');
        } catch (error) {
            this.setSaveTrackStatus(error.message || 'Не удалось сохранить трек');
        } finally {
            this.setSaveTrackLoading(false);
        }
    }

    addPlaylistOption(playlist) {
        if (!playlist?.id) return;

        const playlists = this.playlistsValue || [];
        if (!playlists.some((item) => String(item.id) === String(playlist.id))) {
            this.playlistsValue = [...playlists, { id: playlist.id.toString(), name: playlist.name }];
        }
    }

    setSaveTrackStatus(message) {
        if (!this.hasSaveTrackStatusTarget) return;
        this.saveTrackStatusTarget.textContent = message || '';
        this.saveTrackStatusTarget.classList.toggle('text-red-300', String(message || '').startsWith('Не'));
        this.saveTrackStatusTarget.classList.toggle('text-neutral-400', !String(message || '').startsWith('Не'));
    }

    setSaveTrackLoading(loading) {
        if (this.hasSaveTrackButtonTarget) {
            this.saveTrackButtonTarget.disabled = loading;
            this.saveTrackButtonTarget.classList.toggle('opacity-60', loading);
            this.saveTrackButtonTarget.classList.toggle('pointer-events-none', loading);
        }
        if (this.hasSaveTrackInputTarget) this.saveTrackInputTarget.disabled = loading;
    }

    async toggleLike(event) {
        event.preventDefault();
        event.stopPropagation();

        if (!this.currentTrack || this.likeButtonTarget.disabled) return;

        const previousLiked = this.currentTrack.liked;
        const nextLiked = !previousLiked;
        const url = previousLiked ? this.currentTrack.unlikeUrl : this.currentTrack.likeUrl;
        const method = previousLiked ? 'DELETE' : 'POST';

        this.setLikeLoading(true);

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'X-CSRF-Token': this.csrfToken(),
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin'
            });

            if (response.redirected) {
                window.location.href = response.url;
                return;
            }

            if (!response.ok) throw new Error(`Player like request failed: ${response.status}`);

            let data = {};
            try {
                data = await response.json();
            } catch (_error) {
                data = {};
            }

            this.currentTrack.liked = data.liked ?? nextLiked;
            this.syncCurrentTrackInQueue(this.currentTrack.liked);
            this.updateLikeButton();
            this.broadcastCurrentTrackLike();
        } catch (error) {
            console.error(error);
            this.currentTrack.liked = previousLiked;
            this.updateLikeButton();
        } finally {
            this.setLikeLoading(false);
        }
    }

    handleLikeChanged(event) {
        if (!this.currentTrack) return;

        const { resourceType, resourceId, liked } = event.detail;
        if (resourceType !== 'track') return;

        this.currentQueue.forEach((track) => {
            if (String(track.id) === String(resourceId)) track.liked = liked;
        });

        if (String(resourceId) !== String(this.currentTrack.id)) return;

        this.currentTrack.liked = liked;
        this.updateLikeButton();
    }

    broadcastCurrentTrackLike() {
        document.dispatchEvent(new CustomEvent('like-button:changed', {
            detail: {
                resourceType: 'track',
                resourceId: this.currentTrack.id,
                liked: this.currentTrack.liked
            }
        }));
    }

    syncCurrentTrackInQueue(liked) {
        this.currentQueue.forEach((track) => {
            if (String(track.id) === String(this.currentTrack.id)) track.liked = liked;
        });
    }

    renderCurrentTrackInfo() {
        if (!this.currentTrack) return;

        this.trackTitleTarget.textContent = this.currentTrack.title;
        this.trackTitleTarget.title = this.currentTrack.title;
        this.trackImageTarget.src = this.currentTrack.image;
        this.trackImageTarget.alt = this.currentTrack.title;
        const artist = this.currentTrack.artist || "Unknown Artist";
        this.trackArtistTarget.textContent = artist;
        this.trackArtistTarget.title = artist;
    }

    updatePlayButton() {
        const title = this.isPlaying ? 'Пауза' : 'Воспроизвести';
        this.playButtonTarget.innerHTML = this.isPlaying ? Icons.pause : Icons.play;
        this.playButtonTarget.title = title;
        this.playButtonTarget.setAttribute('aria-label', title);
        this.updateMediaSession();
    }

    updateLikeButton() {
        if (!this.hasLikeButtonTarget || !this.hasLikeIconTarget) return;

        if (!this.currentTrack) {
            this.likeButtonTarget.classList.add('hidden');
            return;
        }

        const liked = this.currentTrack.liked;
        const title = liked ? this.likedTitleValue : this.unlikedTitleValue;
        this.likeButtonTarget.classList.remove('hidden');
        this.likeButtonTarget.title = title;
        this.likeButtonTarget.setAttribute('aria-label', title);
        this.likeButtonTarget.dataset.liked = liked.toString();
        this.likeIconTarget.src = liked ? this.likedIconValue : this.unlikedIconValue;
    }



    updateSaveTrackButton() {
        if (!this.hasSaveTrackButtonTarget) return;

        if (!this.currentTrack) {
            this.saveTrackButtonTarget.classList.add('hidden');
            this.saveTrackButtonTarget.classList.remove('flex');
            this.closeSaveTrackMenu();
            return;
        }

        this.saveTrackButtonTarget.classList.remove('hidden');
        this.saveTrackButtonTarget.classList.add('flex');
    }

    updateQueueControls() {
        const hasQueue = this.currentQueue.length > 0;

        if (this.hasPreviousButtonTarget) this.previousButtonTarget.disabled = !hasQueue;
        if (this.hasNextButtonTarget) this.nextButtonTarget.disabled = !hasQueue;

        if (this.hasSaveQueueButtonTarget) {
            this.saveQueueButtonTarget.classList.toggle('hidden', !hasQueue);
            this.saveQueueButtonTarget.disabled = !hasQueue;
        }

        if (!hasQueue) this.closeSaveQueueMenu();
        if (!this.currentTrack) this.closeSaveTrackMenu();

        if (this.hasQueueTitleTarget) {
            if (!hasQueue) {
                this.queueTitleTarget.textContent = '';
                this.queueTitleTarget.removeAttribute('href');
                this.queueTitleTarget.removeAttribute('title');
            } else {
                const label = `${this.currentQueueName} · ${this.currentQueueIndex + 1}/${this.currentQueue.length}`;
                this.queueTitleTarget.textContent = label;
                this.queueTitleTarget.title = label;

                if (this.currentQueueUrl) {
                    this.queueTitleTarget.href = this.currentQueueUrl;
                    this.queueTitleTarget.classList.add('hover:underline');
                } else {
                    this.queueTitleTarget.removeAttribute('href');
                    this.queueTitleTarget.classList.remove('hover:underline');
                }
            }
        }
    }

    setLikeLoading(loading) {
        this.likeButtonTarget.disabled = loading;
        this.likeButtonTarget.classList.toggle('opacity-60', loading);
        this.likeButtonTarget.classList.toggle('pointer-events-none', loading);
    }

    setSaveQueueLoading(loading) {
        if (this.hasSaveQueueButtonTarget) {
            this.saveQueueButtonTarget.disabled = loading;
            this.saveQueueButtonTarget.classList.toggle('opacity-60', loading);
            this.saveQueueButtonTarget.classList.toggle('pointer-events-none', loading);
        }

        if (this.hasSaveQueueInputTarget) {
            this.saveQueueInputTarget.disabled = loading;
        }
    }

    setSaveQueueStatus(message, url = null, linkText = null) {
        if (!this.hasSaveQueueStatusTarget) return;
        this.saveQueueStatusTarget.textContent = message || '';

        if (url) {
            const link = document.createElement('a');
            link.href = url;
            link.textContent = linkText || 'Открыть';
            link.className = 'ml-2 text-green-400 hover:underline';
            link.addEventListener('click', (event) => event.stopPropagation());
            this.saveQueueStatusTarget.appendChild(link);
        }
    }

    setVolume(event, volume) {
        if (!this.audioElement) return;

        if (event !== null) {
            volume = parseFloat(event.target.value) / 100;
        }

        volume = Math.min(Math.max(Number(volume) || 0, 0), 1);
        this.saveVolume(volume);
        this.audioElement.volume = volume;
        this.volumeSliderTarget.value = volume * 100;

        let title = 'Выключить звук';
        if (volume === 0) {
            this.volumeButtonTarget.innerHTML = Icons.offSound;
            title = 'Включить звук';
        } else if (volume < 0.3) {
            this.volumeButtonTarget.innerHTML = Icons.lowSound;
        } else {
            this.volumeButtonTarget.innerHTML = Icons.highSound;
        }
        this.volumeButtonTarget.title = title;
        this.volumeButtonTarget.setAttribute('aria-label', title);
    }

    toggleMute() {
        if (!this.audioElement) return;

        const currentVolume = this.audioElement.volume;

        if (currentVolume > 0) {
            this.lastVolume = currentVolume;
            this.setVolume(null, 0);
        } else {
            const newVolume = this.lastVolume || 0.7;
            this.setVolume(null, newVolume);
        }
    }

    normalizeTrack(track) {
        return {
            id: track.id?.toString(),
            url: track.url || '',
            metadataUrl: track.metadataUrl || track.metadata_url || '',
            duration: Number(track.duration) > 0 ? Number(track.duration) : null,
            name: track.name || 'Без названия',
            artist: track.artist || 'Unknown Artist',
            image: track.image || '',
            liked: track.liked === true || track.liked === 'true',
            likeUrl: track.likeUrl || `/like_track/${track.id}`,
            unlikeUrl: track.unlikeUrl || `/like_track/${track.id}`
        };
    }

    async fetchAndRenderTrackMetadata(metadataUrl, fallbackDuration, loadToken, attempt = 0) {
        if (!metadataUrl) return;

        const metadata = await this.fetchTrackMetadata(metadataUrl, fallbackDuration);
        if (this.currentLoadToken !== loadToken) return;

        const hasRealPeaks = metadata.analyzed === true && this.validPeaks(metadata.peaks);
        const metadataDuration = Number(metadata.duration);
        const duration = metadataDuration > 0 ? metadataDuration : fallbackDuration;

        if (duration > 0 && this.currentTrack) {
            this.currentTrack.duration = duration;
            this.waveformDuration = duration;
            this.durationTarget.textContent = this.formatTime(duration);
        }

        if (hasRealPeaks) {
            this.renderWaveform(metadata.peaks, duration);
            return;
        }

        // If analysis is still running, poll a few times in the background. This
        // updates the waveform once Sidekiq saves peaks, but does not enqueue a
        // new analysis job and does not block audio playback.
        if (['pending', 'processing'].includes(metadata.status) && attempt < 6) {
            window.setTimeout(() => {
                if (this.currentLoadToken === loadToken) {
                    this.fetchAndRenderTrackMetadata(metadataUrl, fallbackDuration, loadToken, attempt + 1);
                }
            }, attempt < 2 ? 1000 : 2500);
        }
    }

    cachedTrackMetadata(metadataUrl) {
        if (!metadataUrl || !this.metadataCache) return null;
        return this.metadataCache.get(metadataUrl) || null;
    }

    async fetchTrackMetadata(metadataUrl, fallbackDuration = null) {
        if (!metadataUrl) {
            return { peaks: null, duration: fallbackDuration };
        }

        const cached = this.cachedTrackMetadata(metadataUrl);
        if (cached) return cached;

        if (this.metadataRequests?.has(metadataUrl)) {
            return this.metadataRequests.get(metadataUrl);
        }

        const request = this.requestTrackMetadata(metadataUrl, fallbackDuration).finally(() => {
            this.metadataRequests?.delete(metadataUrl);
        });
        this.metadataRequests?.set(metadataUrl, request);
        return request;
    }

    async requestTrackMetadata(metadataUrl, fallbackDuration = null) {
        try {
            const response = await fetch(metadataUrl, {
                headers: { 'Accept': 'application/json' },
                credentials: 'same-origin',
                cache: 'default'
            });
            if (!response.ok) throw new Error(`Metadata request failed: ${response.status}`);

            const data = await response.json();
            const metadata = {
                peaks: data.peaks,
                duration: Number(data.duration) > 0 ? Number(data.duration) : fallbackDuration,
                analyzed: data.analyzed === true,
                status: data.status || null,
                error: data.error || null
            };

            // Cache only successful waveform data. Pending/failed responses should
            // not hide a waveform that may become available a moment later.
            if (metadata.analyzed === true && this.validPeaks(metadata.peaks)) {
                this.metadataCache?.set(metadataUrl, metadata);
            }

            return metadata;
        } catch (error) {
            console.warn(error);
            return { peaks: null, duration: fallbackDuration };
        }
    }

    validPeaks(peaks) {
        return Array.isArray(peaks) && peaks.length > 0 && Array.isArray(peaks[0]) && peaks[0].length > 0;
    }

    redrawWaveformAfterReveal() {
        requestAnimationFrame(() => this.drawWaveform());
    }

    shouldToggleCurrent(detail) {
        if (!this.currentTrack) return false;

        if (detail.toggleScope === 'context') {
            const context = this.contextFromDetail(detail);
            return Boolean(
                context.type &&
                context.id &&
                this.currentContextType === context.type &&
                String(this.currentContextId) === String(context.id)
            );
        }

        if (detail.id) {
            return String(detail.id) === String(this.currentTrack.id);
        }

        return false;
    }

    contextFromDetail(detail) {
        return {
            type: detail.contextType || null,
            id: detail.contextId || null,
            url: detail.contextUrl || this.urlForContext(detail.contextType, detail.contextId)
        };
    }

    urlForContext(type, id) {
        if (!type || !id) return null;

        if (type === 'album') return `/albums/${id}`;
        if (type === 'playlist') return `/playlists/${id}`;
        if (type === 'artist-popular') return `/profile/${id}`;

        return null;
    }

    playbackState() {
        return {
            trackId: this.currentTrack?.id || null,
            isPlaying: this.isPlaying,
            queueName: this.currentQueueName,
            queueIndex: this.currentQueueIndex,
            contextType: this.currentContextType,
            contextId: this.currentContextId,
            contextUrl: this.currentQueueUrl
        };
    }

    broadcastPlaybackState() {
        const state = this.playbackState();
        window.__audioPlayerState = state;
        document.dispatchEvent(new CustomEvent('audio-player:state', { detail: state }));
    }

    indexForTrack(queue, trackId) {
        const index = queue.findIndex((track) => String(track.id) === String(trackId));
        return index >= 0 ? index : 0;
    }

    safeQueueIndex(index, tracks) {
        if (!Number.isInteger(index) || index < 0 || index >= tracks.length) return 0;
        return index;
    }

    playlistCreateUrl() {
        return this.hasPlaylistCreateUrlValue ? this.playlistCreateUrlValue : '/playlists';
    }

    playlistSaveEndpoint() {
        return this.hasPlaylistSaveUrlValue ? this.playlistSaveUrlValue : '/playlists/save_track';
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    saveVolume(volume) {
        localStorage.setItem('audio-player-volume', volume);
    }

    getSavedVolume() {
        const saved = localStorage.getItem('audio-player-volume');
        if (saved !== null) {
            const volume = parseFloat(saved);
            if (!isNaN(volume) && volume >= 0 && volume <= 1) {
                return volume;
            }
        }
        return 0.7;
    }

    escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value ?? '';
        return div.innerHTML;
    }

    escapeAttribute(value) {
        return this.escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    csrfToken() {
        const token = document.querySelector('meta[name="csrf-token"]');
        return token ? token.content : '';
    }
}
