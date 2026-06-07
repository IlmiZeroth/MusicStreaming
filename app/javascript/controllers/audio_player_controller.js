import { Controller } from "@hotwired/stimulus";
import { Icons } from "./icons";
import WaveSurfer from "wavesurfer.js";

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
        playlistCreateUrl: String
    };

    connect() {
        if(this.wavesurfer) {
            this.attachDocumentListeners();
            this.updateLikeButton();
            this.updateQueueControls();
            this.broadcastPlaybackState();
            return;
        }

        this.isPlaying = false;
        this.currentTrack = null;
        this.currentQueue = [];
        this.currentQueueName = '';
        this.currentQueueIndex = 0;
        this.currentContextType = null;
        this.currentContextId = null;
        this.isAppeared = false;
        this.currentLoadToken = null;

        this.playButtonTarget.innerHTML = Icons.play;
        this.volumeButtonTarget.innerHTML = Icons.highSound;

        this.wavesurfer = WaveSurfer.create({
            container: this.waveformTarget,
            waveColor: '#4F4A85',
            progressColor: '#383351',
            cursorColor: '#7C6E9E',
            barWidth: 1,
            barRadius: 3,
            cursorWidth: 1,
            height: 100,
            normalize: true,
            responsive: true,
        });

        const savedVolume = this.getSavedVolume();
        this.setupEventListeners();
        this.setVolume(null, savedVolume);

        this.attachDocumentListeners();
        this.updateLikeButton();
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
        // if (this.wavesurfer) {
        //     this.wavesurfer.destroy();
        // }
    }

    setupEventListeners() {
        this.wavesurfer.on('ready', () => {
            const duration = this.wavesurfer.getDuration();
            this.durationTarget.textContent = this.formatTime(duration);

            if (this.currentTrack) {
                this.trackTitleTarget.textContent = this.currentTrack.title;
                this.trackImageTarget.src = this.currentTrack.image;
                this.trackArtistTarget.textContent = this.currentTrack.artist || "Unknown Artist";
                this.updateLikeButton();
                this.updateQueueControls();
                this.broadcastPlaybackState();
            }
        });

        this.wavesurfer.on('play', () => {
            this.isPlaying = true;
            this.playButtonTarget.innerHTML = Icons.pause;
            this.broadcastPlaybackState();
        });

        this.wavesurfer.on('pause', () => {
            this.isPlaying = false;
            this.playButtonTarget.innerHTML = Icons.play;
            this.broadcastPlaybackState();
        });

        this.wavesurfer.on('audioprocess', () => {
            const currentTime = this.wavesurfer.getCurrentTime();
            this.currentTimeTarget.textContent = this.formatTime(currentTime);
        });

        this.wavesurfer.on('finish', () => {
            if (this.currentQueue.length > 1) {
                this.nextTrack();
                return;
            }

            this.isPlaying = false;
            this.playButtonTarget.innerHTML = Icons.play;
            this.broadcastPlaybackState();
        });

        this.wavesurfer.on('interaction', () => {
            this.currentTimeTarget.textContent = this.formatTime(this.wavesurfer.getCurrentTime());
        });
    }

    async loadQueue(queue, queueName, queueIndex = 0, autoplay = true, context = {}) {
        const tracks = queue.map((track) => this.normalizeTrack(track)).filter((track) => track.url);
        if (tracks.length === 0) return;

        this.currentQueue = tracks;
        this.currentQueueName = queueName || 'Очередь воспроизведения';
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

        await this.loadTrack(track.id, track.url, track.name, track.artist, track.image, track.liked, track.likeUrl, track.unlikeUrl, autoplay);
    }

    async loadTrack(trackId, trackUrl, trackName, trackArtist, trackImage, liked = false, likeUrl = null, unlikeUrl = null, autoplay = true) {
        if (!this.wavesurfer || !trackUrl) return;

        const loadToken = Symbol('track-load');
        this.currentLoadToken = loadToken;

        this.currentTrack = {
            id: trackId,
            title: trackName,
            artist: trackArtist,
            image: trackImage,
            liked: liked,
            likeUrl: likeUrl || `/like_track/${trackId}`,
            unlikeUrl: unlikeUrl || `/like_track/${trackId}`
        };

        this.trackTitleTarget.textContent = this.currentTrack.title;
        this.trackImageTarget.src = this.currentTrack.image;
        this.trackArtistTarget.textContent = this.currentTrack.artist || "Unknown Artist";
        this.currentTimeTarget.textContent = '0:00';
        this.durationTarget.textContent = '0:00';
        this.updateLikeButton();
        this.updateQueueControls();
        this.playerTarget.classList.remove("hidden");
        this.isAppeared = true;
        this.isPlaying = false;
        this.playButtonTarget.innerHTML = Icons.play;
        this.broadcastPlaybackState();

        fetch(`/tracks/${trackId}/stream`, {
            method: 'POST',
            headers: {
                'X-CSRF-Token': this.csrfToken(),
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin'
        }).catch(() => {});

        try {
            await this.wavesurfer.load(trackUrl);
        } catch (error) {
            if (this.currentLoadToken === loadToken) console.error(error);
            return;
        }

        if (this.currentLoadToken !== loadToken) return;

        if (autoplay) {
            await this.wavesurfer.play();
            this.playButtonTarget.innerHTML = Icons.pause;
            this.isPlaying = true;
        } else {
            this.playButtonTarget.innerHTML = Icons.play;
            this.isPlaying = false;
        }

        this.broadcastPlaybackState();
    }

    playPause() {
        if (!this.wavesurfer || !this.currentTrack) return;

        if (this.isPlaying) {
            this.wavesurfer.pause();
            this.playButtonTarget.innerHTML = Icons.play;
            this.isPlaying = false;
        } else {
            this.wavesurfer.play();
            this.playButtonTarget.innerHTML = Icons.pause;
            this.isPlaying = true;
        }

        this.broadcastPlaybackState();
    }

    nextTrack(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (this.currentQueue.length === 0) return;

        this.currentQueueIndex = (this.currentQueueIndex + 1) % this.currentQueue.length;
        this.updateQueueControls();
        this.broadcastPlaybackState();
        this.loadCurrentQueueTrack(true);
    }

    previousTrack(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (this.currentQueue.length === 0) return;

        this.currentQueueIndex = (this.currentQueueIndex - 1 + this.currentQueue.length) % this.currentQueue.length;
        this.updateQueueControls();
        this.broadcastPlaybackState();
        this.loadCurrentQueueTrack(true);
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

            this.setSaveQueueStatus(data.message || 'Плейлист сохранён');
            window.setTimeout(() => this.closeSaveQueueMenu(), 1200);
        } catch (error) {
            console.error(error);
            this.setSaveQueueStatus(error.message || 'Не удалось сохранить плейлист');
        } finally {
            this.setSaveQueueLoading(false);
        }
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

    updateQueueControls() {
        const hasQueue = this.currentQueue.length > 0;

        if (this.hasPreviousButtonTarget) this.previousButtonTarget.disabled = !hasQueue;
        if (this.hasNextButtonTarget) this.nextButtonTarget.disabled = !hasQueue;

        if (this.hasSaveQueueButtonTarget) {
            this.saveQueueButtonTarget.classList.toggle('hidden', !hasQueue);
            this.saveQueueButtonTarget.disabled = !hasQueue;
        }

        if (!hasQueue) this.closeSaveQueueMenu();

        if (this.hasQueueTitleTarget) {
            if (!hasQueue) {
                this.queueTitleTarget.textContent = '';
            } else {
                this.queueTitleTarget.textContent = `${this.currentQueueName} · ${this.currentQueueIndex + 1}/${this.currentQueue.length}`;
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

    setSaveQueueStatus(message) {
        if (!this.hasSaveQueueStatusTarget) return;
        this.saveQueueStatusTarget.textContent = message || '';
    }

    setVolume(event, volume) {
        if (this.wavesurfer) {
            if (event !== null) {
                volume = parseFloat(event.target.value) / 100;
            }
            this.saveVolume(volume);
            this.wavesurfer.setVolume(volume);
            this.volumeSliderTarget.value = volume * 100;

            if (volume === 0) {
                this.volumeButtonTarget.innerHTML = Icons.offSound;
            } else if (volume < 0.3) {
                this.volumeButtonTarget.innerHTML = Icons.lowSound;
            } else {
                this.volumeButtonTarget.innerHTML = Icons.highSound;
            }
        }
    }

    toggleMute() {
        if (this.wavesurfer) {
            const currentVolume = this.wavesurfer.getVolume();

            if (currentVolume > 0) {
                this.lastVolume = currentVolume;
                this.setVolume(null, 0);
            } else {
                const newVolume = this.lastVolume || 0.7;
                this.setVolume(null, newVolume);
            }
        }
    }

    normalizeTrack(track) {
        return {
            id: track.id?.toString(),
            url: track.url || '',
            name: track.name || 'Без названия',
            artist: track.artist || 'Unknown Artist',
            image: track.image || '',
            liked: track.liked === true || track.liked === 'true',
            likeUrl: track.likeUrl || `/like_track/${track.id}`,
            unlikeUrl: track.unlikeUrl || `/like_track/${track.id}`
        };
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
            id: detail.contextId || null
        };
    }

    playbackState() {
        return {
            trackId: this.currentTrack?.id || null,
            isPlaying: this.isPlaying,
            queueName: this.currentQueueName,
            queueIndex: this.currentQueueIndex,
            contextType: this.currentContextType,
            contextId: this.currentContextId
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

    csrfToken() {
        const token = document.querySelector('meta[name="csrf-token"]');
        return token ? token.content : '';
    }
}
