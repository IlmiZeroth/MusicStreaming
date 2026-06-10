import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "dropzone", "list", "empty", "status", "summary"]
  static values = {
    startPosition: { type: Number, default: 1 }
  }

  connect() {
    this.draggedRow = null
    this.positionChangeTimer = null
    this.selectedFiles = Array.from(this.inputTarget.files || [])
    this.syncDropzoneState()
  }

  choose() {
    this.inputTarget.click()
  }

  albumSelected(event) {
    const nextPosition = Number(event.detail?.nextPosition || event.detail?.next_position)
    if (Number.isFinite(nextPosition) && nextPosition > 0) {
      this.startPositionValue = nextPosition
      this.updatePositions()
    }
  }

  filesChanged() {
    this.selectedFiles = Array.from(this.inputTarget.files || [])
    this.renderFiles(this.selectedFiles, { reveal: true })
  }

  dragEnter(event) {
    event.preventDefault()
    this.dropzoneTarget.classList.add("border-green-400", "bg-green-400/10", "ring-2", "ring-green-400/30")
    this.setStatus("Отпустите файлы здесь — я добавлю их в список ниже.")
  }

  dragOver(event) {
    event.preventDefault()
    this.dropzoneTarget.classList.add("border-green-400", "bg-green-400/10", "ring-2", "ring-green-400/30")
  }

  dragLeave(event) {
    if (this.dropzoneTarget.contains(event.relatedTarget)) return
    this.dropzoneTarget.classList.remove("border-green-400", "bg-green-400/10", "ring-2", "ring-green-400/30")
    this.syncDropzoneState()
  }

  drop(event) {
    event.preventDefault()
    this.dropzoneTarget.classList.remove("border-green-400", "bg-green-400/10", "ring-2", "ring-green-400/30")

    const files = Array.from(event.dataTransfer.files || []).filter((file) => file.type.startsWith("audio/") || this.audioExtension(file.name))
    if (files.length === 0) {
      this.setStatus("Я не нашёл аудиофайлы в переносе. Подойдут MP3, WAV, FLAC, OGG, M4A.")
      return
    }

    this.selectedFiles = files
    this.replaceInputFiles(files)
    this.renderFiles(files, { reveal: true })
  }

  renderFiles(files, options = {}) {
    this.listTarget.innerHTML = ""
    this.selectedFiles = files

    if (files.length === 0) {
      this.emptyTarget.classList.remove("hidden")
      this.syncDropzoneState()
      return
    }

    this.emptyTarget.classList.add("hidden")
    files.forEach((file, index) => {
      this.listTarget.insertAdjacentHTML("beforeend", this.rowTemplate(file, index))
    })
    this.updatePositions()
    this.syncDropzoneState()

    if (options.reveal) {
      requestAnimationFrame(() => this.listTarget.scrollIntoView({ behavior: "smooth", block: "nearest" }))
    }
  }

  dragStart(event) {
    const row = event.currentTarget.closest("[data-bulk-row]")
    if (!row) return

    this.draggedRow = row
    row.classList.add("opacity-60", "ring-2", "ring-green-400/20")
    event.currentTarget.classList.add("cursor-grabbing")
    event.dataTransfer.effectAllowed = "move"
  }

  dragOverRow(event) {
    event.preventDefault()
    const target = event.currentTarget
    if (!this.draggedRow || this.draggedRow === target) return

    const rect = target.getBoundingClientRect()
    const after = event.clientY > rect.top + rect.height / 2
    this.listTarget.insertBefore(this.draggedRow, after ? target.nextSibling : target)
  }

  dragEnd(event) {
    const row = event.currentTarget.closest("[data-bulk-row]") || this.draggedRow
    row?.classList.remove("opacity-60", "ring-2", "ring-green-400/20")
    event.currentTarget.classList.remove("cursor-grabbing")
    this.draggedRow = null
    this.updatePositions()
  }

  schedulePositionChanged(event) {
    window.clearTimeout(this.positionChangeTimer)
    const input = event.currentTarget
    this.positionChangeTimer = window.setTimeout(() => {
      if (input?.isConnected) this.positionChanged({ currentTarget: input })
    }, 350)
  }

  positionChanged(event) {
    window.clearTimeout(this.positionChangeTimer)
    const input = event.currentTarget
    const row = input.closest("[data-bulk-row]")
    if (!row) return

    const rawPosition = Number.parseInt(input.value, 10)
    if (!Number.isFinite(rawPosition) || rawPosition <= 0) return

    const start = this.startPositionValue || 1
    const rows = Array.from(this.listTarget.querySelectorAll("[data-bulk-row]"))
    const currentIndex = rows.indexOf(row)
    if (currentIndex === -1) return

    const maxIndex = Math.max(rows.length - 1, 0)
    const desiredIndex = Math.max(0, Math.min(rawPosition - start, maxIndex))

    if (desiredIndex !== currentIndex) {
      const referenceRow = rows[desiredIndex]

      if (desiredIndex > currentIndex) {
        this.listTarget.insertBefore(row, referenceRow.nextSibling)
      } else {
        this.listTarget.insertBefore(row, referenceRow)
      }
    }

    this.updatePositions()
    row.classList.add("ring-2", "ring-green-400/30")
    window.setTimeout(() => row.classList.remove("ring-2", "ring-green-400/30"), 300)
  }

  updatePositions() {
    const start = this.startPositionValue || 1
    this.listTarget.querySelectorAll("[data-bulk-row]").forEach((row, index) => {
      const position = start + index
      const positionInput = row.querySelector("[data-position-input]")
      if (positionInput) positionInput.value = position
    })
  }

  remove(event) {
    const row = event.currentTarget.closest("[data-bulk-row]")
    const removeIndex = Number(row.dataset.fileIndex)
    const remainingFiles = Array.from(this.inputTarget.files || []).filter((_file, index) => index !== removeIndex)
    this.replaceInputFiles(remainingFiles)
    this.renderFiles(remainingFiles)
  }

  replaceInputFiles(files) {
    const transfer = new DataTransfer()
    files.forEach((file) => transfer.items.add(file))
    this.inputTarget.files = transfer.files
  }

  syncDropzoneState() {
    const count = Array.from(this.inputTarget.files || []).length
    this.dropzoneTarget.classList.toggle("border-green-400/70", count > 0)
    this.dropzoneTarget.classList.toggle("bg-green-400/5", count > 0)

    if (count > 0) {
      this.setStatus(`Выбрано файлов: ${count}. Ниже можно поправить названия и порядок.`)
      if (this.hasSummaryTarget) this.summaryTarget.textContent = "Файлы добавлены"
    } else {
      this.setStatus("Можно кликнуть по области или перетащить аудиофайлы мышью.")
      if (this.hasSummaryTarget) this.summaryTarget.textContent = "Перенесите аудиофайлы сюда"
    }
  }

  setStatus(message) {
    if (this.hasStatusTarget) this.statusTarget.textContent = message
  }

  rowTemplate(file, index) {
    const name = this.titleFromFilename(file.name)
    return `
      <div data-bulk-row data-file-index="${index}" data-action="dragover->bulk-tracks#dragOverRow" class="grid gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3 transition sm:grid-cols-[auto_minmax(5rem,7rem)_1fr_auto] sm:items-center">
        <button type="button" draggable="true" data-action="dragstart->bulk-tracks#dragStart dragend->bulk-tracks#dragEnd" aria-label="Перетащить трек" title="Зажмите и перетащите, чтобы изменить порядок" class="flex h-11 w-11 cursor-grab select-none items-center justify-center rounded-xl bg-neutral-900 text-lg text-neutral-500 transition hover:bg-neutral-800 hover:text-white active:cursor-grabbing">☰</button>
        <label class="block">
          <span class="mb-1 block text-xs text-neutral-500">№ трека</span>
          <input data-position-input data-action="input->bulk-tracks#schedulePositionChanged change->bulk-tracks#positionChanged" type="number" name="track_items[][position]" min="1" step="1" value="${this.startPositionValue + index}" class="w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-center text-sm font-bold text-white outline-none focus:border-green-400">
        </label>
        <div class="min-w-0">
          <input type="hidden" name="track_items[][file_index]" value="${index}">
          <label class="block">
            <span class="mb-1 block text-xs text-neutral-500">Название</span>
            <input name="track_items[][name]" value="${this.escapeAttribute(name)}" class="w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-green-400">
          </label>
          <p class="mt-1 truncate text-xs text-neutral-500">${this.escapeHtml(file.name)} · ${this.formatBytes(file.size)}</p>
        </div>
        <button type="button" data-action="bulk-tracks#remove" class="rounded-xl px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/10">Удалить</button>
      </div>
    `
  }

  titleFromFilename(filename) {
    return filename.replace(/\.[^/.]+$/, "").replaceAll("_", " ").replaceAll("-", " ").trim()
  }

  audioExtension(filename) {
    return /\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(filename)
  }

  formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return ""
    const mb = bytes / 1024 / 1024
    return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`
  }

  escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;")
  }

  escapeAttribute(value) {
    return this.escapeHtml(value)
  }
}
