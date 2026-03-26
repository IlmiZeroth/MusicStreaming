import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
    static targets = ["menu"]

    connect() {
        document.addEventListener('click', this.handleClickOutside.bind(this))
    }

    disconnect() {
        document.removeEventListener('click', this.handleClickOutside.bind(this))
    }

    toggle() {
        this.menuTarget.classList.toggle('hidden')
    }

    close() {
        this.menuTarget.classList.add('hidden')
    }

    handleClickOutside(event) {
        if (!this.element.contains(event.target)) {
            this.close()
        }
    }
}