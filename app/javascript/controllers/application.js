import { Application } from "@hotwired/stimulus"
import "@hotwired/turbo-rails"

const application = Application.start()

application.debug = false
window.Stimulus   = application

export { application }
