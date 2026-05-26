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
  def index

  end

end