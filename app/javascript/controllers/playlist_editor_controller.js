import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["searchInput", "searchResults", "trackList", "trackIds"]
  static values = { searchUrl: String }

  connect() {
    this.timeout = null
    this.draggedRow = null
    this.updateHidden()
  }

  queueSearch() {
    const query = this.searchInputTarget.value.trim()
    if (query.length < 2) {
      this.hideResults()
      return
    }

    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => this.search(query), 160)
  }

  async search(query) {
    const url = new URL(this.searchUrlValue, window.location.origin)
    url.searchParams.set("q", query)

    const response = await fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin" })
    if (!response.ok) return

    const items = await response.json()
    this.renderResults(items)
  }

  renderResults(items) {
    if (!items.length) {
      this.searchResultsTarget.innerHTML = `<div class="px-3 py-3 text-sm text-neutral-400">Ничего не найдено</div>`
      this.searchResultsTarget.classList.remove("hidden")
      return
    }

    this.searchResultsTarget.innerHTML = items.map((item) => `
      <button type="button" class="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-neutral-900" data-action="playlist-editor#addFromSearch" data-id="${this.escapeAttribute(item.id)}" data-title="${this.escapeAttribute(item.title)}" data-subtitle="${this.escapeAttribute(item.subtitle || "")}" data-image="${this.escapeAttribute(item.image || "")}">
        <img src="${this.escapeAttribute(item.image || "")}" alt="" class="h-10 w-10 rounded-xl object-cover ring-1 ring-neutral-800">
        <span class="min-w-0">
          <span class="block truncate text-sm font-bold text-white">${this.escapeHtml(item.title)}</span>
          <span class="block truncate text-xs text-neutral-500">${this.escapeHtml(item.subtitle || "")}</span>
        </span>
      </button>
    `).join("")
    this.searchResultsTarget.classList.remove("hidden")
  }

  addFromSearch(event) {
    const button = event.currentTarget
    if (this.hasTrack(button.dataset.id)) {
      this.searchInputTarget.value = ""
      this.hideResults()
      return
    }

    this.trackListTarget.insertAdjacentHTML("beforeend", this.rowTemplate({
      id: button.dataset.id,
      title: button.dataset.title,
      subtitle: button.dataset.subtitle,
      image: button.dataset.image
    }))

    this.searchInputTarget.value = ""
    this.hideResults()
    this.updateHidden()
  }

  remove(event) {
    event.currentTarget.closest("[data-track-id]")?.remove()
    this.updateHidden()
  }

  dragStart(event) {
    this.draggedRow = event.currentTarget
    event.dataTransfer.effectAllowed = "move"
  }

  dragOver(event) {
    event.preventDefault()
    const target = event.currentTarget
    if (!this.draggedRow || target === this.draggedRow) return

    const rect = target.getBoundingClientRect()
    const after = event.clientY > rect.top + rect.height / 2
    this.trackListTarget.insertBefore(this.draggedRow, after ? target.nextSibling : target)
  }

  dragEnd() {
    this.draggedRow = null
    this.updateHidden()
  }

  updateHidden() {
    const ids = Array.from(this.trackListTarget.querySelectorAll("[data-track-id]")).map((row) => row.dataset.trackId)
    this.trackIdsTarget.value = ids.join(",")
    this.trackListTarget.querySelectorAll("[data-position]").forEach((node, index) => {
      node.textContent = index + 1
    })
  }

  hasTrack(id) {
    return Boolean(this.trackListTarget.querySelector(`[data-track-id="${CSS.escape(String(id))}"]`))
  }

  hideResults() {
    this.searchResultsTarget.classList.add("hidden")
    this.searchResultsTarget.innerHTML = ""
  }

  rowTemplate(item) {
    return `
      <div data-track-id="${this.escapeAttribute(item.id)}" draggable="true" data-action="dragstart->playlist-editor#dragStart dragover->playlist-editor#dragOver dragend->playlist-editor#dragEnd" class="grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/60 px-3 py-3">
        <span class="cursor-grab rounded-xl bg-neutral-900 px-3 py-2 text-sm text-neutral-500">☰</span>
        <span data-position class="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-900 text-sm font-bold text-neutral-300"></span>
        <span class="flex min-w-0 items-center gap-3">
          <img src="${this.escapeAttribute(item.image || "")}" alt="" class="h-10 w-10 rounded-xl object-cover ring-1 ring-neutral-800">
          <span class="min-w-0">
            <span class="block truncate font-semibold text-white">${this.escapeHtml(item.title)}</span>
            <span class="block truncate text-sm text-neutral-500">${this.escapeHtml(item.subtitle || "")}</span>
          </span>
        </span>
        <button type="button" data-action="playlist-editor#remove" class="rounded-xl px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/10">Удалить</button>
      </div>
    `
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
