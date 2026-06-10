import { Controller } from "@hotwired/stimulus";

const STORAGE_KEY = "music-streaming:navigation-stack:v1";
const POPSTATE_KEY = "music-streaming:navigation-popstate:v1";
const MAX_STACK_LENGTH = 80;

export default class extends Controller {
    connect() {
        this.boundRecordCurrentLocation = this.recordCurrentLocation.bind(this);
        this.boundMarkPopstate = this.markPopstate.bind(this);

        window.addEventListener("popstate", this.boundMarkPopstate);
        document.addEventListener("turbo:load", this.boundRecordCurrentLocation);

        this.recordCurrentLocation();
    }

    disconnect() {
        window.removeEventListener("popstate", this.boundMarkPopstate);
        document.removeEventListener("turbo:load", this.boundRecordCurrentLocation);
    }

    markPopstate() {
        sessionStorage.setItem(POPSTATE_KEY, "1");
    }

    recordCurrentLocation() {
        const currentUrl = this.currentUrl();
        let stack = this.loadStack();
        const wasBrowserBackOrForward = sessionStorage.getItem(POPSTATE_KEY) === "1";
        sessionStorage.removeItem(POPSTATE_KEY);

        if (stack.length === 0) {
            stack = [currentUrl];
        } else if (!this.urlsEqual(stack[stack.length - 1], currentUrl)) {
            if (wasBrowserBackOrForward) {
                const existingIndex = this.lastIndexOfUrl(stack, currentUrl);
                stack = existingIndex >= 0 ? stack.slice(0, existingIndex + 1) : [...stack, currentUrl];
            } else {
                stack = [...stack, currentUrl];
            }
        }

        this.saveStack(stack);
        this.broadcastChange();
    }

    broadcastChange() {
        document.dispatchEvent(new CustomEvent("navigation-history:changed", {
            detail: {
                stack: this.loadStack(),
                currentUrl: this.currentUrl()
            }
        }));
    }

    currentUrl() {
        return this.normalizeUrl(window.location.href) || "/";
    }

    loadStack() {
        try {
            const rawStack = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
            if (!Array.isArray(rawStack)) return [];

            return this.compactConsecutiveUrls(rawStack
                .map((url) => this.normalizeUrl(url))
                .filter(Boolean));
        } catch (_error) {
            return [];
        }
    }

    saveStack(stack) {
        const normalizedStack = this.compactConsecutiveUrls(stack
            .map((url) => this.normalizeUrl(url))
            .filter(Boolean))
            .slice(-MAX_STACK_LENGTH);

        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedStack));
    }

    compactConsecutiveUrls(urls) {
        return urls.reduce((result, url) => {
            if (result.length === 0 || !this.urlsEqual(result[result.length - 1], url)) {
                result.push(url);
            }
            return result;
        }, []);
    }

    normalizeUrl(url) {
        try {
            const parsedUrl = new URL(url, window.location.origin);
            if (parsedUrl.origin !== window.location.origin) return null;

            return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}` || "/";
        } catch (_error) {
            return null;
        }
    }

    urlsEqual(left, right) {
        return this.normalizeUrl(left) === this.normalizeUrl(right);
    }

    lastIndexOfUrl(stack, url) {
        const normalizedUrl = this.normalizeUrl(url);
        for (let index = stack.length - 1; index >= 0; index -= 1) {
            if (this.normalizeUrl(stack[index]) === normalizedUrl) return index;
        }
        return -1;
    }
}
