# frozen_string_literal: true

class PlaylistsController < ApplicationController
  before_action :set_playlist, only: [:show]

  def show
    @playlist_tracks = @playlist.playlist_tracks.includes(track: [{ album: [:artist, { cover_image_attachment: :blob }] }]).order(:position)
    @tracks = @playlist_tracks.map(&:track).compact
    @user = @playlist.user
    @show_actions = UserPolicy.new(current_user, @user).settings?
  end

  def create
    @playlist = current_user.playlists.build(playlist_params)
    track_ids = playlist_track_ids

    ActiveRecord::Base.transaction do
      @playlist.save!
      attach_tracks_to_playlist(@playlist, track_ids)
    end

    respond_to do |format|
      format.html { redirect_to playlist_path(@playlist), notice: 'Плейлист создан' }
      format.json do
        render json: {
          message: 'Плейлист сохранён',
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
                    alert: @playlist.errors.full_messages.to_sentence.presence || 'Не удалось создать плейлист'
      end
      format.json do
        render json: { error: @playlist.errors.full_messages.to_sentence.presence || 'Не удалось создать плейлист' },
               status: :unprocessable_entity
      end
    end
  end

  private

  def set_playlist
    @playlist = Playlist.includes(:user).find_by(id: params[:id])
    redirect_to collection_index_path, alert: 'Плейлист не найден' unless @playlist.present?
  end

  def playlist_params
    params.require(:playlist).permit(:name, :description)
  end

  def playlist_track_ids
    ids = params[:track_ids].presence || params.dig(:playlist, :track_ids)
    Array(ids).reject(&:blank?)
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
end
