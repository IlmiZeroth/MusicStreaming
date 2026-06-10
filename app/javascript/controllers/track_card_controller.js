import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
    static targets = ["playIcon", "artwork", "active"];

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
        queueIndex: Number,
        playIcon: String,
        pauseIcon: String,
        contextType: String,
        contextId: String,
        contextUrl: String
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

    playTrack(event){
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (!this.hasUrlValue || !this.urlValue) return;

        const queuePayload = this.queuePayload();
        const playEvent = new CustomEvent('play-track', {
            detail: {
                ...this.currentTrackPayload(),
                queue: queuePayload.tracks,
                queueName: queuePayload.name,
                queueIndex: queuePayload.index,
                contextType: queuePayload.contextType,
                contextId: queuePayload.contextId,
                contextUrl: queuePayload.contextUrl,
                toggle: true,
                toggleScope: 'track'
            },
            bubbles: true
        });
        this.element.dispatchEvent(playEvent);
    }

    queuePayload() {
        if (this.hasQueueValue && Array.isArray(this.queueValue) && this.queueValue.length > 0) {
            const tracks = this.queueValue.filter((track) => track && track.url);
            const index = this.hasQueueIndexValue ? this.queueIndexValue : 0;

            return {
                name: this.hasQueueNameValue ? this.queueNameValue : 'Очередь воспроизведения',
                tracks,
                index: this.safeQueueIndex(index, tracks),
                contextType: this.contextType(),
                contextId: this.contextId(),
                contextUrl: this.contextUrl()
            };
        }

        const queueElement = this.element.closest('[data-playback-queue-name-value]');
        if (!queueElement) {
            return {
                name: this.hasQueueNameValue ? this.queueNameValue : 'Очередь воспроизведения',
                tracks: [this.currentTrackPayload()],
                index: 0,
                contextType: this.contextType(),
                contextId: this.contextId(),
                contextUrl: this.contextUrl()
            };
        }

        const trackElements = Array.from(queueElement.querySelectorAll('[data-controller~="track-card"]'));
        const tracks = trackElements
            .map((element) => this.trackPayloadFromElement(element))
            .filter((track) => track && track.url);

        const currentIndex = tracks.findIndex((track) => String(track.id) === String(this.idValue));

        return {
            name: queueElement.dataset.playbackQueueNameValue || 'Очередь воспроизведения',
            tracks: tracks.length > 0 ? tracks : [this.currentTrackPayload()],
            index: currentIndex >= 0 ? currentIndex : 0,
            contextType: queueElement.dataset.playbackContextTypeValue || this.contextType(),
            contextId: queueElement.dataset.playbackContextIdValue || this.contextId(),
            contextUrl: queueElement.dataset.playbackContextUrlValue || this.contextUrl()
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

    trackPayloadFromElement(element) {
        const { dataset } = element;

        return {
            id: dataset.trackCardIdValue,
            url: dataset.trackCardUrlValue,
            metadataUrl: dataset.trackCardMetadataUrlValue,
            duration: Number(dataset.trackCardDurationValue) || null,
            name: dataset.trackCardNameValue,
            artist: dataset.trackCardArtistValue,
            image: dataset.trackCardImageValue,
            liked: dataset.trackCardLikedValue === 'true',
            likeUrl: dataset.trackCardLikeUrlValue,
            unlikeUrl: dataset.trackCardUnlikeUrlValue
        };
    }

    safeQueueIndex(index, tracks) {
        if (!Number.isInteger(index) || index < 0 || index >= tracks.length) return 0;
        return index;
    }

    handleLikeChanged(event) {
        const { resourceType, resourceId, liked } = event.detail;
        if (resourceType !== 'track') return;
        if (String(resourceId) !== String(this.idValue)) return;

        this.likedValue = liked;
    }

    handlePlaybackState(event) {
        const state = event.detail || {};
        const isCurrentTrack = String(state.trackId || '') === String(this.idValue || '');
        const isPlaying = isCurrentTrack && state.isPlaying;

        this.applyActiveState(isCurrentTrack);

        if (this.hasPlayIconTarget) {
            this.playIconTarget.src = isPlaying ? this.pauseIconPath() : this.playIconPath();
            this.playIconTarget.alt = isPlaying ? 'Пауза' : 'Воспроизвести';
        }
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
        element.classList.toggle('bg-neutral-700', isActive);
        element.classList.toggle('shadow-lg', isActive);
        element.classList.toggle('shadow-green-400/20', isActive);
    }

    activeStateElement() {
        if (this.hasActiveTarget) return this.activeTarget;
        if (this.hasArtworkTarget) return this.artworkTarget;
        return this.element;
    }

    clearLegacyRootActiveState() {
        if (this.hasActiveTarget && this.activeTarget === this.element) return;
        this.element.classList.remove('ring-2', 'ring-green-400', 'bg-neutral-700', 'shadow-lg', 'shadow-green-400/20');
    }
}
