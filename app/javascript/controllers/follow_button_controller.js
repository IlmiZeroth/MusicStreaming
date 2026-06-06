import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
    static targets = ["icon"];
    static values = {
        followUrl: String,
        unfollowUrl: String,
        followedId: String,
        following: Boolean,
        followedIcon: String,
        unfollowedIcon: String,
        followTitle: String,
        unfollowTitle: String,
        removeOnUnfollow: Boolean
    };

    connect() {
        this.render();
    }

    async toggle(event) {
        event.preventDefault();
        event.stopPropagation();

        if (this.element.disabled) return;

        const wasFollowing = this.followingValue;
        const url = wasFollowing ? this.unfollowUrlValue : this.followUrlValue;
        const method = wasFollowing ? "DELETE" : "POST";

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

            if (!response.ok) throw new Error(`Follow request failed: ${response.status}`);

            let data = {};
            try {
                data = await response.json();
            } catch (_error) {
                data = {};
            }

            this.followingValue = data.following ?? !wasFollowing;
            this.render();

            if (wasFollowing && !this.followingValue && this.removeOnUnfollowValue) {
                this.removeArtistCard();
            }
        } catch (error) {
            console.error(error);
            this.followingValue = wasFollowing;
            this.render();
        } finally {
            this.setLoading(false);
        }
    }

    render() {
        const following = this.followingValue;
        const iconUrl = following ? this.followedIconValue : this.unfollowedIconValue;
        const title = following ? this.unfollowTitleValue : this.followTitleValue;

        this.element.title = title;
        this.element.setAttribute("aria-label", title);
        this.element.dataset.following = following.toString();

        if (this.hasIconTarget && iconUrl) {
            this.iconTarget.src = iconUrl;
        }
    }

    removeArtistCard() {
        this.decrementArtistsCount();

        const card = this.element.closest(".artist-card");
        if (!card) return;

        const list = card.closest('[data-collection-list="artists"]');
        card.classList.add("opacity-0", "scale-95");

        window.setTimeout(() => {
            card.remove();
            this.toggleEmptyArtistsState(list);
        }, 180);
    }

    decrementArtistsCount() {
        const counter = document.querySelector('[data-collection-count="artists"]');
        if (!counter) return;

        const currentValue = Number.parseInt(counter.textContent.trim(), 10);
        if (Number.isNaN(currentValue)) return;

        counter.textContent = Math.max(currentValue - 1, 0).toString();
    }

    toggleEmptyArtistsState(list) {
        if (!list) return;
        if (list.querySelector(".artist-card")) return;

        list.classList.add("hidden");

        const emptyState = document.querySelector('[data-collection-empty="artists"]');
        if (emptyState) emptyState.classList.remove("hidden");
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
