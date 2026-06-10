import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
    static targets = ["scroller", "previousButton", "nextButton"];

    connect() {
        this.updateButtons();
        this.boundUpdateButtons = this.updateButtons.bind(this);
        window.addEventListener('resize', this.boundUpdateButtons);
    }

    disconnect() {
        window.removeEventListener('resize', this.boundUpdateButtons);
    }

    scrollByWheel(event) {
        if (!this.hasScrollerTarget || !this.canScroll()) return;

        const primaryDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
        if (primaryDelta === 0) return;

        event.preventDefault();
        this.scrollerTarget.scrollBy({ left: primaryDelta, behavior: 'auto' });
        this.updateButtons();
    }

    scrollPrevious(event) {
        event.preventDefault();
        this.scrollByPage(-1);
    }

    scrollNext(event) {
        event.preventDefault();
        this.scrollByPage(1);
    }

    scrollByPage(direction) {
        if (!this.hasScrollerTarget || !this.canScroll()) return;

        const amount = Math.max(this.scrollerTarget.clientWidth * 0.8, 240);
        this.scrollerTarget.scrollBy({ left: direction * amount, behavior: 'smooth' });
        window.setTimeout(() => this.updateButtons(), 250);
    }

    updateButtons() {
        if (!this.hasScrollerTarget) {
            if (this.hasPreviousButtonTarget) this.previousButtonTarget.disabled = true;
            if (this.hasNextButtonTarget) this.nextButtonTarget.disabled = true;
            return;
        }

        const maxScrollLeft = Math.max(this.scrollerTarget.scrollWidth - this.scrollerTarget.clientWidth, 0);
        const scrollLeft = this.scrollerTarget.scrollLeft;
        const canScroll = maxScrollLeft > 1;

        if (this.hasPreviousButtonTarget) {
            this.previousButtonTarget.disabled = !canScroll || scrollLeft <= 1;
        }

        if (this.hasNextButtonTarget) {
            this.nextButtonTarget.disabled = !canScroll || scrollLeft >= maxScrollLeft - 1;
        }
    }

    canScroll() {
        return this.hasScrollerTarget && this.scrollerTarget.scrollWidth > this.scrollerTarget.clientWidth + 1;
    }
}
