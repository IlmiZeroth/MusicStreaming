import { Controller } from "@hotwired/stimulus";

const STORAGE_KEY = "music-streaming:navigation-stack:v1";
const MAX_STACK_LENGTH = 80;

export default class extends Controller {
    static values = {
        fallbackUrl: String
    };

    connect() {
        this.boundSync = this.sync.bind(this);
        document.addEventListener("navigation-history:changed", this.boundSync);
        document.addEventListener("turbo:load", this.boundSync);
        this.sync();
    }

    disconnect() {
        document.removeEventListener("navigation-history:changed", this.boundSync);
        document.removeEventListener("turbo:load", this.boundSync);
    }

    goBack(event) {
        event.preventDefault();
        event.stopPropagation();

        const targetUrl = this.previousUrl();
        if (targetUrl && !this.urlsEqual(targetUrl, this.currentUrl())) {
            this.prepareStackForVisit(targetUrl);
            this.visit(targetUrl);
            return;
        }

        if (window.history.length > 1) {
            window.history.back();
            return;
        }

        const fallbackUrl = this.fallbackUrl();
        if (fallbackUrl && !this.urlsEqual(fallbackUrl, this.currentUrl())) {
            this.visit(fallbackUrl);
        }
    }

    sync() {
        const targetUrl = this.previousUrl() || this.fallbackUrl();
        const canGoBack = Boolean(
            targetUrl && !this.urlsEqual(targetUrl, this.currentUrl())
        ) || window.history.length > 1;

        this.element.disabled = !canGoBack;
        this.element.classList.toggle("opacity-40", !canGoBack);
        this.element.classList.toggle("cursor-default", !canGoBack);
        this.element.classList.toggle("pointer-events-none", !canGoBack);
    }

    previousUrl() {
        const currentUrl = this.currentUrl();
        let stack = this.loadStack();
        const currentIndex = this.lastIndexOfUrl(stack, currentUrl);

        if (currentIndex >= 0) {
            stack = stack.slice(0, currentIndex + 1);
        }

        while (stack.length > 0 && this.urlsEqual(stack[stack.length - 1], currentUrl)) {
            stack.pop();
        }

        const previousUrl = stack[stack.length - 1];
        if (previousUrl) return previousUrl;

        const fallbackUrl = this.fallbackUrl();
        return fallbackUrl && !this.urlsEqual(fallbackUrl, currentUrl) ? fallbackUrl : null;
    }

    prepareStackForVisit(targetUrl) {
        let stack = this.loadStack();
        const targetIndex = this.lastIndexOfUrl(stack, targetUrl);

        if (targetIndex >= 0) {
            stack = stack.slice(0, targetIndex + 1);
        } else {
            stack = [targetUrl];
        }

        this.saveStack(stack);
        document.dispatchEvent(new CustomEvent("navigation-history:changed", {
            detail: {
                stack: stack,
                currentUrl: targetUrl
            }
        }));
    }

    visit(url) {
        if (window.Turbo && typeof window.Turbo.visit === "function") {
            window.Turbo.visit(url, { action: "replace" });
        } else {
            window.location.assign(url);
        }
    }

    currentUrl() {
        return this.normalizeUrl(window.location.href) || "/";
    }

    fallbackUrl() {
        return this.hasFallbackUrlValue ? this.normalizeUrl(this.fallbackUrlValue) : null;
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
