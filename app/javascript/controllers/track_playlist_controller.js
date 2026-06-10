import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    trackId: String,
    saveUrl: String,
    playlists: Array
  }

  connect() {
    this.panel = null
    this.boundCloseOnDocument = this.closeOnDocument.bind(this)
    this.boundCloseOnEscape = this.closeOnEscape.bind(this)
    this.boundPositionPanel = this.positionPanel.bind(this)
  }

  disconnect() {
    this.close()
  }

  toggle(event) {
    event?.preventDefault()
    event?.stopPropagation()

    if (this.panel) {
      this.close()
    } else {
      this.open()
    }
  }

  open() {
    this.panel = document.createElement("div")
    this.panel.className = "fixed z-[80] w-[calc(100vw-2rem)] max-w-sm rounded-3xl border border-neutral-800 bg-neutral-950/98 p-3 text-white shadow-2xl shadow-black/60 backdrop-blur"
    this.panel.addEventListener("click", (event) => event.stopPropagation())
    this.renderPanel()
    document.body.appendChild(this.panel)
    this.positionPanel()

    window.addEventListener("resize", this.boundPositionPanel)
    window.addEventListener("scroll", this.boundPositionPanel, true)
    document.addEventListener("click", this.boundCloseOnDocument)
    document.addEventListener("keydown", this.boundCloseOnEscape)
  }

  close() {
    if (this.panel) {
      this.panel.remove()
      this.panel = null
    }

    window.removeEventListener("resize", this.boundPositionPanel)
    window.removeEventListener("scroll", this.boundPositionPanel, true)
    document.removeEventListener("click", this.boundCloseOnDocument)
    document.removeEventListener("keydown", this.boundCloseOnEscape)
  }

  closeOnDocument() {
    this.close()
  }

  closeOnEscape(event) {
    if (event.key === "Escape") this.close()
  }

  positionPanel() {
    if (!this.panel) return

    const rect = this.element.getBoundingClientRect()
    const gap = 10
    const width = Math.min(384, window.innerWidth - 32)
    this.panel.style.width = `${width}px`

    const left = Math.min(Math.max(rect.right - width, 16), window.innerWidth - width - 16)
    const spaceBelow = window.innerHeight - rect.bottom
    const below = spaceBelow >= 280 || rect.top < spaceBelow
    const top = below ? rect.bottom + gap : Math.max(16, rect.top - this.panel.offsetHeight - gap)

    this.panel.style.left = `${left}px`
    this.panel.style.top = `${Math.min(top, window.innerHeight - this.panel.offsetHeight - 16)}px`
  }

  renderPanel(status = "") {
    if (!this.panel) return

    const playlists = this.playlistsValue || []
    const playlistList = playlists.length > 0
      ? playlists.map((playlist) => `
          <button type="button"
                  class="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-neutral-900"
                  data-playlist-id="${this.escapeAttribute(playlist.id)}"
                  data-action="track-playlist#saveExisting">
            <span class="min-w-0 truncate text-sm font-semibold text-white">${this.escapeHtml(playlist.name)}</span>
            <span class="shrink-0 text-xs text-green-300">Добавить</span>
          </button>
        `).join("")
      : `<div class="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-3 py-3 text-sm text-neutral-400">У вас пока нет плейлистов. Создайте новый ниже.</div>`

    this.panel.innerHTML = `
      <div class="flex items-start justify-between gap-3 px-1 pb-2">
        <div>
          <div class="text-sm font-black text-white">Сохранить трек</div>
          <div class="mt-0.5 text-xs text-neutral-500">Выберите плейлист или создайте новый.</div>
        </div>
        <button type="button" class="rounded-xl px-2 py-1 text-neutral-400 transition hover:bg-neutral-900 hover:text-white" data-action="track-playlist#closeByButton">✕</button>
      </div>
      <div class="max-h-52 overflow-y-auto pr-1">${playlistList}</div>
      <form class="mt-3 border-t border-neutral-800 pt-3" data-action="submit->track-playlist#saveNew">
        <label class="mb-2 block text-xs text-neutral-500">Новый плейлист</label>
        <div class="flex gap-2">
          <input name="playlist_name" autocomplete="off" placeholder="Название плейлиста" class="min-w-0 flex-1 rounded-2xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-green-400">
          <button type="submit" class="rounded-2xl bg-green-400 px-3 py-2 text-sm font-bold text-black transition hover:bg-green-300">Создать</button>
        </div>
      </form>
      <p class="min-h-5 px-1 pt-2 text-xs ${status.includes("Не") ? "text-red-300" : "text-neutral-400"}" data-status>${this.escapeHtml(status)}</p>
    `

    this.panel.querySelectorAll("[data-action]").forEach((element) => {
      element.addEventListener("click", (event) => {
        const action = element.dataset.action || ""
        if (action.includes("saveExisting")) this.saveExisting(event)
        if (action.includes("closeByButton")) this.closeByButton(event)
      })
      element.addEventListener("submit", (event) => {
        const action = element.dataset.action || ""
        if (action.includes("saveNew")) this.saveNew(event)
      })
    })

    requestAnimationFrame(() => this.positionPanel())
  }

  closeByButton(event) {
    event?.preventDefault()
    event?.stopPropagation()
    this.close()
  }

  async saveExisting(event) {
    event?.preventDefault()
    event?.stopPropagation()

    const playlistId = event.currentTarget?.dataset?.playlistId
    if (!playlistId) return

    await this.save({ playlist_id: playlistId })
  }

  async saveNew(event) {
    event?.preventDefault()
    event?.stopPropagation()

    const form = event.currentTarget
    const input = form.querySelector("input[name='playlist_name']")
    const playlistName = input?.value?.trim()
    if (!playlistName) {
      input?.focus()
      this.setStatus("Введите название плейлиста")
      return
    }

    await this.save({ playlist_name: playlistName })
  }

  async save(payload) {
    this.setStatus("Сохраняем...")

    try {
      const response = await fetch(this.saveUrlValue, {
        method: "POST",
        headers: {
          "X-CSRF-Token": this.csrfToken(),
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({ track_id: this.trackIdValue, ...payload })
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить трек")

      this.addPlaylistOption(data.playlist)
      this.renderPanel(data.message || "Трек сохранён")
    } catch (error) {
      this.setStatus(error.message || "Не удалось сохранить трек")
    }
  }

  addPlaylistOption(playlist) {
    if (!playlist?.id) return

    const playlists = this.playlistsValue || []
    if (!playlists.some((item) => String(item.id) === String(playlist.id))) {
      this.playlistsValue = [...playlists, { id: playlist.id.toString(), name: playlist.name }]
    }
  }

  setStatus(message) {
    if (!this.panel) return
    const status = this.panel.querySelector("[data-status]")
    if (status) {
      status.textContent = message || ""
      status.classList.toggle("text-red-300", String(message).startsWith("Не"))
    }
  }

  csrfToken() {
    return document.querySelector("meta[name='csrf-token']")?.content || ""
  }

  escapeHtml(value) {
    return String(value ?? "")
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
