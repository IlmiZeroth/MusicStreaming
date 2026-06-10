class SearchController < ApplicationController
  MAX_QUERY_LENGTH = 100
  ARTISTS_LIMIT = 20
  ALBUMS_LIMIT = 24
  TRACKS_LIMIT = 32

  def index
    @query = params[:q].to_s.strip[0, MAX_QUERY_LENGTH]
    @artists = Artist.none
    @albums = Album.none
    @tracks = Track.none

    return if @query.blank?

    like = "%#{ActiveRecord::Base.sanitize_sql_like(@query)}%"

    @artists = Artist
      .with_attached_avatar
      .where("artists.name ILIKE ?", like)
      .order(:name)
      .limit(ARTISTS_LIMIT)

    @albums = Album
      .includes(:artist, cover_image_attachment: :blob)
      .joins(:artist)
      .where("albums.name ILIKE :q OR artists.name ILIKE :q", q: like)
      .order(release_date: :desc, created_at: :desc)
      .limit(ALBUMS_LIMIT)

    @tracks = Track
      .includes(audio_file_attachment: :blob, album: [:artist, { cover_image_attachment: :blob }])
      .joins(album: :artist)
      .where("tracks.name ILIKE :q OR albums.name ILIKE :q OR artists.name ILIKE :q", q: like)
      .order(streams: :desc, created_at: :desc)
      .limit(TRACKS_LIMIT)
  end
end
