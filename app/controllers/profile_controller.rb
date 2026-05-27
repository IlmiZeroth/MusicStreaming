class ProfileController < ApplicationController
  before_action :set_user, only: [:show, :settings, :update_settings]
  before_action :authorize_settings_access!, only: [:settings, :update_settings]

  def show
    @user = User.find_by(id: params[:id])
    if @user.present?
      @popular_tracks = Track.joins(:album)
                             .where(albums: { user_id: @user.id })
                             .order(streams: :desc)
                             .limit(10)

      @new_releases = Track.joins(:album)
                           .where(albums: { user_id: @user.id })
                           .order(created_at: :desc)
                           .limit(10)
      @user_albums = @user.albums || []
    else
      redirect_to root_path, alert: "Пользователь не найден"
    end
  end

  def update_settings
    @user = User.find_by(id: params[:profile_id])
    if @user.present?

      if user_params[:password].blank? && user_params[:password_confirmation].blank?
        params[:user].delete(:password)
        params[:user].delete(:password_confirmation)
      end

      if @user.update(user_params)
        redirect_to profile_settings_path, notice: 'Настройки успешно обновлены!'
      else
        flash.now[:alert] = @user.errors.full_messages.to_sentence
        render :settings, status: :unprocessable_entity
      end
    end
  end

  def settings
    @user = User.find_by(id: params[:profile_id])
    unless @user.present?
      redirect_to root_path, alert: "Пользователь не найден"
    end
  end

  def set_user
    @user = User.find_by(id: params[:id] || params[:profile_id])
    unless @user.present?
      redirect_to root_path, alert: "Пользователь не найден"
    end
  end

  def authorize_settings_access!
    unless UserPolicy.new(current_user, @user).settings?
      flash[:alert] = "У вас нет доступа к настройкам этого профиля"
      redirect_to root_path
    end
  end

  def user_params
    params.require(:user).permit(:username, :email, :password, :password_confirmation, :avatar)
  end
end