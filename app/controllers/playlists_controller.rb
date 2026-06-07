# frozen_string_literal: true

class PlaylistsController < ApplicationController
  def create
    @playlist = current_user.playlists.build(playlist_params)
    track_ids = playlist_track_ids

    ActiveRecord::Base.transaction do
      @playlist.save!
      attach_tracks_to_playlist(@playlist, track_ids)
    end

    respond_to do |format|
      format.html { redirect_to collection_index_path, notice: 'Плейлист создан' }
      format.json do
        render json: {
          message: 'Плейлист сохранён',
          playlist: {
            id: @playlist.id,
            name: @playlist.name,
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
