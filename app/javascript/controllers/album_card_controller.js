import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
    static targets = ["playIcon", "artwork"];

    static values = {
        id: String,
        url: String,
        metadataUrl: String,
        duration: Number,
        name: String,
        artist: String,
        image: String,
        liked: Boolean,
        likeUrl: String,
        unlikeUrl: String,
        queueName: String,
        queue: Array,
        contextType: String,
        contextId: String,
        contextUrl: String,
        playIcon: String,
        pauseIcon: String
    };

    connect() {
        this.handleLikeChanged = this.handleLikeChanged.bind(this);
        this.handlePlaybackState = this.handlePlaybackState.bind(this);
        document.addEventListener('like-button:changed', this.handleLikeChanged);
        document.addEventListener('audio-player:state', this.handlePlaybackState);
        this.handlePlaybackState({ detail: window.__audioPlayerState || {} });
    }

    disconnect() {
        document.removeEventListener('like-button:changed', this.handleLikeChanged);
        document.removeEventListener('audio-player:state', this.handlePlaybackState);
    }

    playTrack(event) {
        event.preventDefault();
        event.stopPropagation();

        if (!this.hasUrlValue || !this.urlValue) return;

        const queue = this.queuePayload();
        const playEvent = new CustomEvent('play-track', {
            detail: {
                ...this.currentTrackPayload(),
                queue: queue.tracks,
                queueName: queue.name,
                queueIndex: 0,
                contextType: this.contextType(),
                contextId: this.contextId(),
                contextUrl: this.contextUrl(),
                toggle: true,
                toggleScope: 'context'
            },
            bubbles: true
        });
        this.element.dispatchEvent(playEvent);
    }

    queuePayload() {
        if (this.hasQueueValue && Array.isArray(this.queueValue) && this.queueValue.length > 0) {
            const tracks = this.queueValue.filter((track) => track && track.url);

            return {
                name: this.hasQueueNameValue ? this.queueNameValue : 'Очередь воспроизведения',
                tracks: tracks.length > 0 ? tracks : [this.currentTrackPayload()]
            };
        }

        return {
            name: this.hasQueueNameValue ? this.queueNameValue : 'Очередь воспроизведения',
            tracks: [this.currentTrackPayload()]
        };
    }

    currentTrackPayload() {
        return {
            id: this.idValue,
            url: this.urlValue,
            metadataUrl: this.metadataUrl(),
            duration: this.duration(),
            name: this.nameValue,
            artist: this.artistValue,
            image: this.imageValue,
            liked: this.likedValue,
            likeUrl: this.likeUrlValue,
            unlikeUrl: this.unlikeUrlValue
        };
    }

    handleLikeChanged(event) {
        const { resourceType, resourceId, liked } = event.detail;
        if (resourceType !== 'track') return;
        if (String(resourceId) !== String(this.idValue)) return;

        this.likedValue = liked;
    }

    handlePlaybackState(event) {
        const state = event.detail || {};
        const isActiveContext = this.isActiveContext(state);
        const isPlaying = isActiveContext && state.isPlaying;

        this.applyActiveState(isActiveContext);

        if (this.hasPlayIconTarget) {
            this.playIconTarget.src = isPlaying ? this.pauseIconPath() : this.playIconPath();
            this.playIconTarget.alt = isPlaying ? 'Пауза' : 'Воспроизвести';
        }
    }

    isActiveContext(state) {
        const type = this.contextType();
        const id = this.contextId();
        if (!type || !id) return false;

        return state.contextType === type && String(state.contextId || '') === String(id);
    }

    metadataUrl() {
        return this.hasMetadataUrlValue ? this.metadataUrlValue : null;
    }

    duration() {
        return this.hasDurationValue && this.durationValue > 0 ? this.durationValue : null;
    }

    contextType() {
        return this.hasContextTypeValue ? this.contextTypeValue : null;
    }

    contextId() {
        return this.hasContextIdValue ? this.contextIdValue : null;
    }

    contextUrl() {
        return this.hasContextUrlValue ? this.contextUrlValue : null;
    }

    playIconPath() {
        return this.hasPlayIconValue ? this.playIconValue : '/assets/play.svg';
    }

    pauseIconPath() {
        return this.hasPauseIconValue ? this.pauseIconValue : '/assets/pause.svg';
    }

    applyActiveState(isActive) {
        this.clearLegacyRootActiveState();

        const element = this.activeStateElement();
        element.classList.toggle('ring-2', isActive);
        element.classList.toggle('ring-green-400', isActive);
        element.classList.toggle('shadow-lg', isActive);
        element.classList.toggle('shadow-green-400/20', isActive);
    }

    activeStateElement() {
        if (this.hasArtworkTarget) return this.artworkTarget;
        return this.element;
    }

    clearLegacyRootActiveState() {
        this.element.classList.remove('ring-2', 'ring-green-400', 'shadow-lg', 'shadow-green-400/20');
    }
}
