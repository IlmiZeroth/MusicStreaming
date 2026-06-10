class ProfileController < ApplicationController
  before_action :set_artist, only: [:show]
  before_action :set_account_user, only: [:settings, :update_settings]
  before_action :authorize_settings_access!, only: [:settings, :update_settings]

  def show
    return unless @artist.present?

    @popular_tracks = @artist.tracks.includes(album: { cover_image_attachment: :blob })
                             .order(streams: :desc)
                             .limit(10)

    @new_releases = @artist.tracks.includes(album: { cover_image_attachment: :blob })
                           .order(created_at: :desc)
                           .limit(10)
    @artist_albums = @artist.albums.with_attached_cover_image.order(release_date: :desc, created_at: :desc)
  end

  def update_settings
    if account_params[:password].blank? && account_params[:password_confirmation].blank?
      params[:user].delete(:password)
      params[:user].delete(:password_confirmation)
    end

    if @user.update(account_params)
      redirect_to profile_settings_path(@user), notice: "Настройки успешно обновлены!"
    else
      flash.now[:alert] = @user.errors.full_messages.to_sentence
      render :settings, status: :unprocessable_entity
    end
  end

  def settings
  end

  private

  def set_artist
    @artist = Artist.find_by(id: params[:id])
    redirect_to root_path, alert: "Исполнитель не найден" unless @artist.present?
  end

  def set_account_user
    @user = User.find_by(id: params[:id] || params[:profile_id]) || current_user
  end

  def authorize_settings_access!
    unless UserPolicy.new(current_user, @user).settings?
      flash[:alert] = "У вас нет доступа к настройкам этого аккаунта"
      redirect_to root_path
    end
  end

  def account_params
    params.require(:user).permit(:username, :email, :password, :password_confirmation)
  end
end
