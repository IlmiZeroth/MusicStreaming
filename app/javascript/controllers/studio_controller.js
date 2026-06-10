// app/javascript/controllers/form_toggle_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
    static targets = ["albumForm", "trackForm"]
    static values = {
        trackDisabled: { type: Boolean, default: false }
    }

    connect() {
    }

    toggleAlbum() {
        if (this.albumFormTarget.style.display === 'none') {
            this.showAlbumForm()
        } else {
            this.hideAlbumForm()
        }
    }

    toggleTrack() {
        if (this.trackDisabledValue) return

        if (this.trackFormTarget.style.display === 'none') {
            this.showTrackForm()
        } else {
            this.hideTrackForm()
        }
    }

    showAlbumForm() {
        this.albumFormTarget.style.display = 'block'
        this.hideTrackForm()
    }

    hideAlbumForm() {
        this.albumFormTarget.style.display = 'none'
    }

    showTrackForm() {
        this.trackFormTarget.style.display = 'block'
        this.hideAlbumForm()
    }

    hideTrackForm() {
        this.trackFormTarget.style.display = 'none'
    }
}