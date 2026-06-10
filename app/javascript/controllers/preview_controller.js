// app/javascript/controllers/preview_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
    static targets = ["preview", "input"]
    static values = { defaultUrl: String }

    preview() {
        const file = this.inputTarget.files[0]

        if (file) {
            if (!file.type.match('image.*')) {
                alert('Пожалуйста, выберите изображение')
                this.inputTarget.value = ''
                return
            }

            if (file.size > 5 * 1024 * 1024) {
                alert('Максимальный размер 5MB')
                this.inputTarget.value = ''
                return
            }

            const reader = new FileReader()

            reader.onload = (event) => {
                this.previewTarget.src = event.target.result
            }

            reader.readAsDataURL(file)
        } else {
            this.resetPreview()
        }
    }

    resetPreview() {
        const defaultUrl = this.defaultUrlValue || '/assets/default-user.svg'
        this.previewTarget.src = defaultUrl
        this.inputTarget.value = ''
    }
}