# frozen_string_literal: true

class PlaylistsController < ApplicationController
  before_action :set_playlist, only: [:show, :edit, :update, :destroy]
  before_action :authorize_playlist_owner!, only: [:edit, :update, :destroy]

  def show
    @playlist_tracks = @playlist.playlist_tracks.includes(track: [{ album: [:artist, { cover_image_attachment: :blob }] }]).order(:position)
    @tracks = @playlist_tracks.map(&:track).compact
    @user = @playlist.user
    @show_actions = playlist_owner?(@playlist)
  end

  def edit
    @playlist_tracks = @playlist.playlist_tracks.includes(track: [{ album: [:artist, { cover_image_attachment: :blob }] }]).order(:position)
    @tracks = @playlist_tracks.map(&:track).compact
  end

  def create
    @playlist = current_user.playlists.build(playlist_params)
    track_ids = playlist_track_ids

    ActiveRecord::Base.transaction do
      @playlist.save!
      attach_tracks_to_playlist(@playlist, track_ids)
    end

    respond_to do |format|
      format.html { redirect_to playlist_path(@playlist), notice: "Плейлист создан" }
      format.json do
        render json: {
          message: "Плейлист сохранён",
          playlist: {
            id: @playlist.id,
            name: @playlist.name,
            url: playlist_path(@playlist),
            tracks_count: @playlist.tracks.count
          }
        }, status: :created
      end
    end
  rescue ActiveRecord::RecordInvalid
    respond_to do |format|
      format.html do
        redirect_to collection_index_path,
                    alert: @playlist.errors.full_messages.to_sentence.presence || "Не удалось создать плейлист"
      end
      format.json do
        render json: { error: @playlist.errors.full_messages.to_sentence.presence || "Не удалось создать плейлист" },
               status: :unprocessable_entity
      end
    end
  end

  def update
    track_ids = playlist_track_ids

    ActiveRecord::Base.transaction do
      @playlist.update!(playlist_params)
      replace_playlist_tracks(@playlist, track_ids)
    end

    redirect_to playlist_path(@playlist), notice: "Плейлист обновлён."
  rescue ActiveRecord::RecordInvalid
    @playlist_tracks = @playlist.playlist_tracks.includes(track: [{ album: [:artist, { cover_image_attachment: :blob }] }]).order(:position)
    @tracks = @playlist_tracks.map(&:track).compact
    flash.now[:alert] = @playlist.errors.full_messages.to_sentence.presence || "Не удалось сохранить плейлист"
    render :edit, status: :unprocessable_entity
  end

  def destroy
    name = @playlist.name
    @playlist.destroy!
    redirect_to collection_index_path, notice: "Плейлист #{name} удалён."
  rescue ActiveRecord::RecordNotDestroyed => error
    redirect_to playlist_path(@playlist), alert: error.record.errors.full_messages.to_sentence
  end


  def save_track
    track = Track.find_by(id: params[:track_id])
    unless track.present?
      render json: { error: "Трек не найден" }, status: :not_found
      return
    end

    playlist = playlist_for_save_track
    unless playlist.present?
      render json: { error: "Выберите плейлист или укажите название нового." }, status: :unprocessable_entity
      return
    end

    playlist_track = playlist.playlist_tracks.find_or_initialize_by(track: track)
    added = playlist_track.new_record?
    playlist_track.position ||= playlist.playlist_tracks.maximum(:position).to_i + 1
    playlist_track.save!

    render json: {
      message: added ? "Трек добавлен в плейлист" : "Трек уже есть в этом плейлисте",
      added: added,
      playlist: {
        id: playlist.id.to_s,
        name: playlist.name,
        url: playlist_path(playlist),
        tracks_count: playlist.tracks.count
      }
    }
  rescue ActiveRecord::RecordInvalid => error
    render json: { error: error.record.errors.full_messages.to_sentence.presence || "Не удалось сохранить трек" },
           status: :unprocessable_entity
  end

  def search_tracks
    query = params[:q].to_s.strip[0, 100]
    return render json: [] if query.blank?

    like = "%#{ActiveRecord::Base.sanitize_sql_like(query)}%"
    tracks = Track
      .includes(album: [:artist, { cover_image_attachment: :blob }])
      .joins(album: :artist)
      .where("tracks.name ILIKE :q OR albums.name ILIKE :q OR artists.name ILIKE :q", q: like)
      .order("artists.name ASC, albums.name ASC, tracks.number_in_album ASC NULLS LAST, tracks.name ASC")
      .limit(20)

    render json: tracks.map { |track| track_search_item(track) }
  end

  private


  def playlist_for_save_track
    playlist_id = params[:playlist_id].presence
    if playlist_id.present?
      return current_user.playlists.find_by(id: playlist_id)
    end

    name = params[:playlist_name].presence || params.dig(:playlist, :name).presence
    return nil if name.blank?

    current_user.playlists.create!(name: name.to_s.strip[0, 80], description: "Создано при сохранении трека")
  end

  def set_playlist
    @playlist = Playlist.includes(:user).find_by(id: params[:id])
    redirect_to collection_index_path, alert: "Плейлист не найден" unless @playlist.present?
  end

  def playlist_owner?(playlist)
    current_user.present? && (playlist.user_id == current_user.id || current_user.admin?)
  end

  def authorize_playlist_owner!
    return if playlist_owner?(@playlist)

    redirect_to playlist_path(@playlist), alert: "Редактировать можно только свои плейлисты."
  end

  def playlist_params
    params.require(:playlist).permit(:name, :description, :cover_image)
  end

  def playlist_track_ids
    ids = params[:playlist_track_ids].presence || params[:track_ids].presence || params.dig(:playlist, :track_ids)
    ids = ids.split(",") if ids.is_a?(String)
    Array(ids).map(&:to_s).map(&:strip).reject(&:blank?).uniq
  end

  def attach_tracks_to_playlist(playlist, track_ids)
    Track.where(id: track_ids).index_by { |track| track.id.to_s }.then do |tracks_by_id|
      track_ids.each_with_index do |track_id, index|
        track = tracks_by_id[track_id.to_s]
        next unless track

        playlist.playlist_tracks.create!(track: track, position: index + 1)
      end
    end
  end

  def replace_playlist_tracks(playlist, track_ids)
    playlist.playlist_tracks.destroy_all
    attach_tracks_to_playlist(playlist, track_ids)
  end

  def track_search_item(track)
    {
      id: track.id,
      title: track.name,
      subtitle: "#{track.artist.name} · #{track.album.name}",
      image: track.album.cover_image.attached? ? rails_blob_path(track.album.cover_image, only_path: true) : helpers.asset_path("default-music.svg")
    }
  end
end
