class PagesController < ApplicationController
  def index
    @popular_tracks = popular_tracks_scope.limit(10)
    @new_releases = new_releases_scope.limit(10)
    @user_playlists = current_user&.playlists || []
  end

  def popular
    @tracks = popular_tracks_scope.limit(100)
  end

  def new_releases
    @tracks = new_releases_scope.limit(100)
  end

  private

  def popular_tracks_scope
    Track.includes(album: [:artist, { cover_image_attachment: :blob }]).order(streams: :desc, id: :asc)
  end

  def new_releases_scope
    Track.includes(album: [:artist, { cover_image_attachment: :blob }]).order(created_at: :desc, id: :desc)
  end
end
