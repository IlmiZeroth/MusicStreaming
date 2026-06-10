import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
    static targets = ["icon"];
    static values = {
        resourceType: String,
        resourceId: String,
        likeUrl: String,
        unlikeUrl: String,
        liked: Boolean,
        likedIcon: String,
        unlikedIcon: String,
        likedTitle: String,
        unlikedTitle: String
    };

    connect() {
        this.handleExternalChange = this.handleExternalChange.bind(this);
        document.addEventListener("like-button:changed", this.handleExternalChange);
        this.render();
    }

    disconnect() {
        document.removeEventListener("like-button:changed", this.handleExternalChange);
    }

    async toggle(event) {
        event.preventDefault();
        event.stopPropagation();

        if (this.element.disabled) return;

        const previousLiked = this.likedValue;
        const nextLiked = !previousLiked;
        const url = previousLiked ? this.unlikeUrlValue : this.likeUrlValue;
        const method = previousLiked ? "DELETE" : "POST";

        this.setLoading(true);

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    "X-CSRF-Token": this.csrfToken(),
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                credentials: "same-origin"
            });

            if (response.redirected) {
                window.location.href = response.url;
                return;
            }

            if (!response.ok) throw new Error(`Like request failed: ${response.status}`);

            let data = {};
            try {
                data = await response.json();
            } catch (_error) {
                data = {};
            }

            this.setLiked(data.liked ?? nextLiked, true);
        } catch (error) {
            console.error(error);
            this.setLiked(previousLiked, false);
        } finally {
            this.setLoading(false);
        }
    }

    handleExternalChange(event) {
        const { resourceType, resourceId, liked } = event.detail;

        if (resourceType !== this.resourceTypeValue) return;
        if (String(resourceId) !== String(this.resourceIdValue)) return;

        this.setLiked(liked, false);
    }

    setLiked(liked, broadcast = true) {
        this.likedValue = liked;
        this.render();

        if (broadcast) {
            document.dispatchEvent(new CustomEvent("like-button:changed", {
                detail: {
                    resourceType: this.resourceTypeValue,
                    resourceId: this.resourceIdValue,
                    liked: this.likedValue
                }
            }));
        }
    }

    render() {
        const liked = this.likedValue;
        const iconUrl = liked ? this.likedIconValue : this.unlikedIconValue;
        const title = liked ? this.likedTitleValue : this.unlikedTitleValue;

        this.element.title = title;
        this.element.setAttribute("aria-label", title);
        this.element.dataset.liked = liked.toString();

        if (this.hasIconTarget && iconUrl) {
            this.iconTarget.src = iconUrl;
        }
    }

    setLoading(loading) {
        this.element.disabled = loading;
        this.element.classList.toggle("opacity-60", loading);
        this.element.classList.toggle("pointer-events-none", loading);
    }

    csrfToken() {
        const token = document.querySelector('meta[name="csrf-token"]');
        return token ? token.content : "";
    }
}
