import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
    static values = {id: String, url: String, name: String, artist: String, image: String};
    connect() {
    }

    playTrack(){
        const event = new CustomEvent('play-track', {
            detail: {
                id: this.idValue,
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