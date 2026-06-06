import { Controller } from "@hotwired/stimulus";
import { Icons } from "./icons";
import WaveSurfer from "wavesurfer.js";

export default class extends Controller {
    static targets = ["player", "waveform", "playButton", "currentTime", "duration", "volumeButton", "volumeSlider", "trackTitle", "trackArtist", "trackImage", "likeButton", "likeIcon"];
    static values = {
        likedIcon: String,
        unlikedIcon: String,
        likedTitle: String,
        unlikedTitle: String
    };

    connect() {
        if(this.wavesurfer) {
            this.attachDocumentListeners();
            this.updateLikeButton();
            return;
        }
        this.isPlaying = false;
        this.currentTrack = null;
        this.isAppeared = false;

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
    }

    attachDocumentListeners() {
        if (this.documentListenersAttached) return;

        this.handlePlayTrackEvent ||= this.handlePlayTrack.bind(this);
        this.handleLikeChangedEvent ||= this.handleLikeChanged.bind(this);
        document.addEventListener('play-track', this.handlePlayTrackEvent);
        document.addEventListener('like-button:changed', this.handleLikeChangedEvent);
        this.documentListenersAttached = true;
    }

    detachDocumentListeners() {
        if (!this.documentListenersAttached) return;

        document.removeEventListener('play-track', this.handlePlayTrackEvent);
        document.removeEventListener('like-button:changed', this.handleLikeChangedEvent);
        this.documentListenersAttached = false;
    }

    handlePlayTrack(event) {
        const { id, url, name, artist, image, liked, likeUrl, unlikeUrl } = event.detail;

        this.loadTrack(id, url, name, artist, image, liked, likeUrl, unlikeUrl);
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
            }
        });

        this.wavesurfer.on('audioprocess', () => {
            const currentTime = this.wavesurfer.getCurrentTime();
            this.currentTimeTarget.textContent = this.formatTime(currentTime);
        });

        this.wavesurfer.on('finish', () => {
            this.isPlaying = false;
            this.playButtonTarget.innerHTML = Icons.play;
        });

        this.wavesurfer.on('interaction', () => {
            this.currentTimeTarget.textContent = this.formatTime(this.wavesurfer.getCurrentTime());
        });
    }

    async loadTrack(trackId, trackUrl, trackName, trackArtist, trackImage, liked = false, likeUrl = null, unlikeUrl = null) {
        if (this.wavesurfer) {
            this.currentTrack = {
                id: trackId,
                title: trackName,
                artist: trackArtist,
                image: trackImage,
                liked: liked,
                likeUrl: likeUrl || `/like_track/${trackId}`,
                unlikeUrl: unlikeUrl || `/like_track/${trackId}`
            };
            this.updateLikeButton();

            fetch(`/tracks/${trackId}/stream`, {
                method: 'POST',
                headers: {
                    'X-CSRF-Token': this.csrfToken(),
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin'
            }).catch();
            await this.wavesurfer.load(trackUrl);
        }
            if(this.isPlaying) {
                this.wavesurfer.play();
                this.playButtonTarget.innerHTML = Icons.pause;
            }
            if(!this.isAppeared){
                this.playerTarget.classList.remove("hidden");
                this.wavesurfer.play();
                this.playButtonTarget.innerHTML = Icons.pause;
                this.isPlaying = true;
                this.isAppeared = true;
            }
        }

    playPause() {
        if (!this.wavesurfer) return;

        if (this.isPlaying) {
            this.wavesurfer.pause();
            this.playButtonTarget.innerHTML = Icons.play;
            this.isPlaying = false;
        } else {
            this.wavesurfer.play();
            this.playButtonTarget.innerHTML = Icons.pause;
            this.isPlaying = true;
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

    setLikeLoading(loading) {
        this.likeButtonTarget.disabled = loading;
        this.likeButtonTarget.classList.toggle('opacity-60', loading);
        this.likeButtonTarget.classList.toggle('pointer-events-none', loading);
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
