require "sidekiq/web"

Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html
  devise_for :users, controllers: { registrations: "users/registrations" }

  authenticate :user, ->(user) { user.admin? } do
    mount Sidekiq::Web => "/sidekiq"
  end
  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify if the app is live.
  get "up" => "rails/health#show", as: :rails_health_check
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
