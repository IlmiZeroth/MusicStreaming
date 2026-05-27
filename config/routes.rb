Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html
  devise_for :users, controllers: { registrations: "users/registrations" }
  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check
  get "studio" => "studio#index", as: :studio
  root "pages#index"
  post "followers/:id", to: "followers#create", as: :follow
  delete "followers/:id", to: "followers#destroy", as: :unfollow

  resources :pages, only: [:index]
  resources :profile, only: [:show, :update] do
    get :settings
    patch :update_settings
  end
  resources :albums, only: [:show, :create, :destroy, :update]
  resources :tracks, only: [:create, :destroy, :update]
  resources :tracks do
    member do
      post :stream
    end
  end
end
