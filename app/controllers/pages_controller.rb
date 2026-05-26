class PagesController < ApplicationController
  def index
    @popular_tracks = Track.order(streams: :desc)
                           .limit(10)
    @new_releases = Track.order(created_at: :desc).limit(10)

    # Может быть пустым
    @user_playlists = current_user&.playlists || []
  end
end