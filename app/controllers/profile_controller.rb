class ProfileController < ApplicationController
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
  end

  def user_params
    params.require(:user).permit(:username, :email, :password, :password_confirmation, :avatar)
  end
end