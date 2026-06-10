require "sidekiq/web"

Rails.application.routes.draw do
  devise_for :users, controllers: { registrations: "users/registrations" }

  authenticate :user, ->(user) { user.admin? } do
    mount Sidekiq::Web => "/sidekiq"
  end

  get "up" => "rails/health#show", as: :rails_health_check
  get "search" => "search#index", as: :search

  namespace :admin do
    root "dashboard#index"
    resources :users, only: [:index, :update]
    resources :audit_logs, only: [:index]
  end

  namespace :moderation do
    root "dashboard#index"
    resources :artists, except: [:show] do
      collection { get :search }
    end
    resources :albums, except: [:show] do
      collection { get :search }
    end
    resources :tracks, except: [:show]
  end

  get "studio" => "studio#index", as: :studio
  root "pages#index"

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
  resources :playlists, only: [:show, :create]
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
