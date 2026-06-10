class SearchController < ApplicationController
  MAX_QUERY_LENGTH = 100
  ARTISTS_LIMIT = 20
  ALBUMS_LIMIT = 24
  TRACKS_LIMIT = 32
  SUGGESTION_LIMIT = 5

  def index
    @query = normalized_query
    @artists = Artist.none
    @albums = Album.none
    @tracks = Track.none

    return if @query.blank?

    @artists = artists_scope.limit(ARTISTS_LIMIT)
    @albums = albums_scope.limit(ALBUMS_LIMIT)
    @tracks = tracks_scope.limit(TRACKS_LIMIT)
  end

  def suggestions
    query = normalized_query
    return render json: { query: query, items: [] } if query.blank?

    items = []
    items.concat(artists_scope.limit(SUGGESTION_LIMIT).map { |artist| suggestion_for_artist(artist) })
    items.concat(albums_scope.limit(SUGGESTION_LIMIT).map { |album| suggestion_for_album(album) })
    items.concat(tracks_scope.limit(SUGGESTION_LIMIT + 2).map { |track| suggestion_for_track(track) })

    render json: { query: query, items: items.first(12), all_results_url: search_path(q: query) }
  end

  private

  def normalized_query
    params[:q].to_s.strip[0, MAX_QUERY_LENGTH]
  end

  def query_like
    "%#{ActiveRecord::Base.sanitize_sql_like(normalized_query)}%"
  end

  def artists_scope
    Artist
      .with_attached_avatar
      .where("artists.name ILIKE ?", query_like)
      .order(:name)
  end

  def albums_scope
    Album
      .includes(:artist, cover_image_attachment: :blob)
      .joins(:artist)
      .where("albums.name ILIKE :q OR artists.name ILIKE :q", q: query_like)
      .order(release_date: :desc, created_at: :desc)
  end

  def tracks_scope
    Track
      .includes(audio_file_attachment: :blob, album: [:artist, { cover_image_attachment: :blob }])
      .joins(album: :artist)
      .where("tracks.name ILIKE :q OR albums.name ILIKE :q OR artists.name ILIKE :q", q: query_like)
      .order(streams: :desc, created_at: :desc)
  end

  def suggestion_for_artist(artist)
    {
      type: "artist",
      label: "Исполнитель",
      title: artist.name,
      subtitle: "#{artist.albums_count} альбомов · #{artist.tracks_count} треков",
      url: profile_path(artist),
      image: artist.avatar.attached? ? rails_blob_path(artist.avatar, only_path: true) : helpers.asset_path("default-user.svg")
    }
  end

  def suggestion_for_album(album)
    {
      type: "album",
      label: "Альбом",
      title: album.name,
      subtitle: album.artist.name,
      url: album_path(album),
      image: album.cover_image.attached? ? rails_blob_path(album.cover_image, only_path: true) : helpers.asset_path("default-music.svg")
    }
  end

  def suggestion_for_track(track)
    {
      type: "track",
      label: "Трек",
      title: track.name,
      subtitle: "#{track.artist.name} · #{track.album.name}",
      url: album_path(track.album),
      image: track.album.cover_image.attached? ? rails_blob_path(track.album.cover_image, only_path: true) : helpers.asset_path("default-music.svg")
    }
  end
end
