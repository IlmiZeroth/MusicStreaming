import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "results"]
  static values = { url: String }

  connect() {
    this.timeout = null
    this.lastQuery = ""
    this.boundHideOnOutsideClick = this.hideOnOutsideClick.bind(this)
    document.addEventListener("click", this.boundHideOnOutsideClick)
  }

  disconnect() {
    document.removeEventListener("click", this.boundHideOnOutsideClick)
    clearTimeout(this.timeout)
  }

  queue() {
    const query = this.inputTarget.value.trim()

    if (query.length < 2) {
      this.hide()
      return
    }

    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => this.search(query), 160)
  }

  keydown(event) {
    if (event.key === "Escape") this.hide()
  }

  async search(query) {
    if (!this.urlValue || query === this.lastQuery) return
    this.lastQuery = query

    const url = new URL(this.urlValue, window.location.origin)
    url.searchParams.set("q", query)

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        credentials: "same-origin"
      })

      if (!response.ok) return
      const payload = await response.json()
      this.render(payload)
    } catch (_error) {
      this.hide()
    }
  }

  render(payload) {
    const items = Array.isArray(payload.items) ? payload.items : []
    const query = payload.query || this.inputTarget.value.trim()

    if (items.length === 0) {
      this.resultsTarget.innerHTML = `
        <div class="px-4 py-4 text-sm text-neutral-400">Ничего не найдено</div>
        <a href="/search?q=${encodeURIComponent(query)}" class="block rounded-2xl px-4 py-3 text-sm font-semibold text-green-300 hover:bg-neutral-900">Открыть полный поиск</a>
      `
      this.resultsTarget.classList.remove("hidden")
      return
    }

    const rows = items.map((item) => `
      <a href="${this.escapeAttribute(item.url)}" class="flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-neutral-900">
        <img src="${this.escapeAttribute(item.image || "")}" alt="" class="h-11 w-11 rounded-xl object-cover ring-1 ring-neutral-800">
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-bold text-white">${this.escapeHtml(item.title || "")}</span>
          <span class="block truncate text-xs text-neutral-500">${this.escapeHtml(item.label || "")} · ${this.escapeHtml(item.subtitle || "")}</span>
        </span>
      </a>
    `).join("")

    this.resultsTarget.innerHTML = `
      <div class="grid gap-1">${rows}</div>
      <a href="${this.escapeAttribute(payload.all_results_url || `/search?q=${encodeURIComponent(query)}`)}" class="mt-2 block rounded-2xl border border-neutral-800 bg-neutral-900/70 px-4 py-3 text-center text-sm font-semibold text-green-300 transition hover:border-green-400/50 hover:bg-neutral-900">Все результаты</a>
    `
    this.resultsTarget.classList.remove("hidden")
  }

  hideOnOutsideClick(event) {
    if (!this.element.contains(event.target)) this.hide()
  }

  hide() {
    this.resultsTarget.classList.add("hidden")
    this.resultsTarget.innerHTML = ""
    this.lastQuery = ""
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
