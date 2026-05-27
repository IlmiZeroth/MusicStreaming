// app/javascript/controllers/avatar_preview_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
    static targets = ["preview", "input"]

    connect() {
        console.log("Avatar preview controller connected")
    }

    preview() {
        const file = this.inputTarget.files[0]

        if (file) {
            // Проверяем тип файла
            if (!file.type.match('image.*')) {
                alert('Пожалуйста, выберите изображение')
                this.inputTarget.value = ''
                return
            }

            // Проверяем размер файла (например, максимум 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('Файл太大了. Максимальный размер 5MB')
                this.inputTarget.value = ''
                return
            }

            const reader = new FileReader()

            reader.onload = (event) => {
                this.previewTarget.src = event.target.result
            }

            reader.readAsDataURL(file)
        } else {
            // Если файл не выбран, показываем дефолтную аватарку
            this.previewTarget.src = this.previewTarget.dataset.defaultUrl || '/assets/default-user.svg'
        }
    }

    resetPreview() {
        // Сброс превью к дефолтному изображению
        this.previewTarget.src = this.previewTarget.dataset.defaultUrl || '/assets/default-user.svg'
        this.inputTarget.value = ''
    }
}