import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
    static values = {url: String, name: String, artist: String, image: String};
    connect() {
    }

    playTrack(){
        const event = new CustomEvent('play-track', {
            detail: {
                url: this.urlValue,
                name: this.nameValue,
                artist: this.artistValue,
                image: this.imageValue
            },
            bubbles: true
        });
        this.element.dispatchEvent(event);
    }
}