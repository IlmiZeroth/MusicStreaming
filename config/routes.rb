Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html
  devise_for :users, controllers: { registrations: 'users/registrations' }
  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check
  get "studio" => "studio#index", as: :studio
  root "pages#index"
  resources :pages, only: [:index]
  resources :profile, only: [:show]
  resources :albums, only: [:create, :destroy, :update]
  resources :tracks, only: [:create, :destroy, :update]
end
