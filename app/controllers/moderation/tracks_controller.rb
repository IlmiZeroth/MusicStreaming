module Moderation
  class TracksController < BaseController
    before_action :set_track, only: [:edit, :update, :destroy]
    before_action :set_selected_album, only: [:new, :edit, :create, :update]

    def index
      @tracks = Track.includes(album: :artist).order(created_at: :desc)
    end

    def new
      @track = Track.new(album_id: params[:album_id], duration: 1, audio_analysis_status: "pending")
      @selected_album ||= @track.album
    end

    def create
      @track = Track.new(track_create_params.merge(duration: 1, audio_analysis_status: "pending"))
      @selected_album = @track.album

      if @track.save
        enqueue_audio_analysis(@track)
        audit!("moderation.track.created", @track, name: @track.name, album_id: @track.album_id)
        redirect_to moderation_tracks_path, notice: "Трек загружен. Анализ waveform поставлен в очередь."
      else
        render :new, status: :unprocessable_entity
      end
    end

    def edit
      @selected_album = @track.album
    end

    def update
      audio_replaced = track_update_params[:audio_file].present?
      @selected_album = @track.album

      if @track.update(track_update_params)
        if audio_replaced
          @track.update_columns(
            audio_analysis_status: "pending",
            audio_analysis_error: nil,
            audio_peaks: nil,
            audio_peaks_version: nil,
            audio_analyzed_at: nil,
            updated_at: Time.current
          )
          enqueue_audio_analysis(@track)
        end

        audit!("moderation.track.updated", @track, name: @track.name, album_id: @track.album_id, audio_replaced: audio_replaced)
        redirect_to moderation_tracks_path, notice: "Трек обновлён."
      else
        render :edit, status: :unprocessable_entity
      end
    end

    def destroy
      track_id = @track.id
      track_name = @track.name

      if @track.destroy
        audit!("moderation.track.deleted", nil, track_id: track_id, name: track_name)
        redirect_to moderation_tracks_path, notice: "Трек удалён."
      else
        redirect_to moderation_tracks_path, alert: @track.errors.full_messages.to_sentence
      end
    end

    private

    def set_track
      @track = Track.find(params[:id])
    end

    def set_selected_album
      album_id = params[:album_id] || params.dig(:track, :album_id)
      @selected_album = Album.includes(:artist).find_by(id: album_id) if album_id.present?
    end

    def track_create_params
      params.require(:track).permit(:name, :audio_file, :number_in_album, :album_id)
    end

    def track_update_params
      params.require(:track).permit(:name, :audio_file, :number_in_album)
    end

    def enqueue_audio_analysis(track)
      AnalyzeTrackAudioJob.perform_later(track.id) if track.audio_file.attached?
    end
  end
end
