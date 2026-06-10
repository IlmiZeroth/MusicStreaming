require "sidekiq/web"

Rails.application.routes.draw do
  devise_for :users, controllers: { registrations: "users/registrations", sessions: "users/sessions", passwords: "users/passwords" }

  authenticate :user, ->(user) { user.admin? } do
    mount Sidekiq::Web => "/sidekiq"
  end

  get "up" => "rails/health#show", as: :rails_health_check
  get "search" => "search#index", as: :search
  get "search/suggestions" => "search#suggestions", as: :search_suggestions
  get "home" => "pages#index", as: :home
  get "top-tracks" => "pages#popular", as: :popular_tracks
  get "new-tracks" => "pages#new_releases", as: :new_tracks

  namespace :admin do
    root "dashboard#index"
    resources :users, except: [:new, :create, :show]
    resources :audit_logs, only: [:index]
    resources :mail_messages, only: [:index, :show, :destroy]
  end

  namespace :moderation do
    root "dashboard#index"
    resources :artists, except: [:show] do
      collection { get :search }
    end
    resources :albums, except: [:show] do
      collection { get :search }
    end
    resources :tracks, only: [:index, :edit, :update, :destroy] do
      collection do
        get :bulk_new
        post :bulk_create
      end
    end
  end

  get "studio" => "studio#index", as: :studio
  root "landing#index"

  post "followers/:id", to: "followers#create", as: :follow
  delete "followers/:id", to: "followers#destroy", as: :unfollow

  post "like_track/:id", to: "likes#like_track", as: :like_track
  delete "like_track/:id", to: "likes#unlike_track", as: :unlike_track

  post "like_album/:id", to: "likes#like_album", as: :like_album
  delete "like_album/:id", to: "likes#unlike_album", as: :unlike_album

  post "like_playlist/:id", to: "likes#like_playlist", as: :like_playlist
  delete "like_playlist/:id", to: "likes#unlike_playlist", as: :unlike_playlist

  resources :pages, only: [:index]
  resources :collection, only: [:index]
  resources :playlists, only: [:show, :create, :edit, :update, :destroy] do
    collection do
      get :search_tracks
      post :save_track
    end
  end
  resources :profile, only: [:show, :update] do
    get :settings
    patch :update_settings
  end
  resources :albums, only: [:show, :create, :destroy, :update]
  resources :tracks, only: [:create, :destroy, :update] do
    member do
      get :audio
      get :metadata
      post :stream
    end
  end
end
