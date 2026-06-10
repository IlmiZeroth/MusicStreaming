class PagesController < ApplicationController
  def index
    @popular_tracks = Track.includes(album: :artist).order(streams: :desc).limit(10)
    @new_releases = Track.includes(album: :artist).order(created_at: :desc).limit(10)
    @user_playlists = current_user&.playlists || []
  end
end
