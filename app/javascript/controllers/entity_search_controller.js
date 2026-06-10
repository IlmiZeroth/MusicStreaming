import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "hidden", "results"]
  static values = { url: String }

  connect() {
    this.timeout = null
    this.lastQuery = ""
    this.selectedLabel = this.inputTarget.value.trim()
  }

  search() {
    const query = this.inputTarget.value.trim()

    if (query !== this.selectedLabel) {
      this.hiddenTarget.value = ""
    }

    if (query.length < 1) {
      this.hideResults()
      this.hiddenTarget.value = ""
      return
    }

    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => this.fetchResults(query), 180)
  }

  async fetchResults(query) {
    if (!this.urlValue || query === this.lastQuery) return

    this.lastQuery = query
    const url = new URL(this.urlValue, window.location.origin)
    url.searchParams.set("q", query)

    const response = await fetch(url, { headers: { Accept: "application/json" } })
    if (!response.ok) return

    const items = await response.json()
    this.renderResults(items)
  }

  renderResults(items) {
    if (!items.length) {
      this.resultsTarget.innerHTML = `<div class="px-3 py-3 text-neutral-400">Ничего не найдено</div>`
      this.resultsTarget.classList.remove("hidden")
      return
    }

    this.resultsTarget.innerHTML = items.map((item) => `
      <button type="button"
              class="block w-full text-left px-3 py-3 hover:bg-neutral-700 transition-colors"
              data-id="${this.escapeHtml(String(item.id))}"
              data-label="${this.escapeHtml(item.label)}"
              data-action="click->entity-search#select">
        <span class="block text-white">${this.escapeHtml(item.label)}</span>
        <span class="block text-sm text-neutral-400">${this.escapeHtml(item.subtitle || "")}</span>
      </button>
    `).join("")
    this.resultsTarget.classList.remove("hidden")
  }

  select(event) {
    const button = event.currentTarget
    this.inputTarget.value = button.dataset.label
    this.hiddenTarget.value = button.dataset.id
    this.selectedLabel = button.dataset.label
    this.hideResults()
  }

  hideResults() {
    this.resultsTarget.classList.add("hidden")
    this.resultsTarget.innerHTML = ""
    this.lastQuery = ""
    this.selectedLabel = this.inputTarget.value.trim()
  }

  escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;")
  }
}
