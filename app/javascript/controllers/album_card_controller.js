import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
    static values = {id: String, url: String, name: String, artist: String, image: String, liked: Boolean, likeUrl: String, unlikeUrl: String};

    connect() {
        this.handleLikeChanged = this.handleLikeChanged.bind(this);
        document.addEventListener('like-button:changed', this.handleLikeChanged);
    }

    disconnect() {
        document.removeEventListener('like-button:changed', this.handleLikeChanged);
    }

    playTrack(event) {
        event.preventDefault();
        event.stopPropagation();

        if (!this.hasUrlValue || !this.urlValue) return;

        const playEvent = new CustomEvent('play-track', {
            detail: {
                id: this.idValue,
                url: this.urlValue,
                name: this.nameValue,
                artist: this.artistValue,
                image: this.imageValue,
                liked: this.likedValue,
                likeUrl: this.likeUrlValue,
                unlikeUrl: this.unlikeUrlValue
            },
            bubbles: true
        });
        this.element.dispatchEvent(playEvent);
    }

    handleLikeChanged(event) {
        const { resourceType, resourceId, liked } = event.detail;
        if (resourceType !== 'track') return;
        if (String(resourceId) !== String(this.idValue)) return;

        this.likedValue = liked;
    }
}
