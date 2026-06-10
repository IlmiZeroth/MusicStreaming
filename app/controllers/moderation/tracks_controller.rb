module Moderation
  class TracksController < BaseController
    before_action :set_track, only: [:edit, :update, :destroy]
    before_action :set_selected_album, only: [:new, :edit, :create, :update, :bulk_new, :bulk_create]

    def index
      @q = params[:q].to_s.strip
      tracks = Track.joins(album: :artist).includes(album: [:artist, { cover_image_attachment: :blob }]).with_attached_audio_file.order(created_at: :desc)

      if @q.present?
        like = "%#{ActiveRecord::Base.sanitize_sql_like(@q)}%"
        tracks = tracks.where(
          <<~SQL.squish,
            tracks.name ILIKE :q OR
            albums.name ILIKE :q OR
            artists.name ILIKE :q OR
            tracks.audio_analysis_status ILIKE :q OR
            CAST(tracks.number_in_album AS TEXT) ILIKE :q OR
            CAST(tracks.id AS TEXT) ILIKE :q
          SQL
          q: like
        )
      end

      @tracks, @pagination = paginate(tracks)
    end

    def new
      @track = Track.new(album_id: params[:album_id], duration: 1, audio_analysis_status: "pending")
      @selected_album ||= @track.album
      @track.number_in_album ||= next_track_number_for(@selected_album) if @selected_album.present?
    end

    def create
      @track = Track.new(track_create_params.merge(duration: 1, audio_analysis_status: "pending"))
      @selected_album = @track.album
      @track.number_in_album = next_track_number_for(@selected_album) if @selected_album.present? && @track.number_in_album.blank?

      if @track.save
        enqueue_audio_analysis(@track)
        audit!("moderation.track.created", @track, name: @track.name, album_id: @track.album_id)
        redirect_to moderation_tracks_path, notice: "Трек загружен. Анализ waveform поставлен в очередь."
      else
        render :new, status: :unprocessable_entity
      end
    end

    def bulk_new
      @selected_album ||= Album.includes(:artist).find_by(id: params[:album_id])
      @bulk_start_position = next_track_number_for(@selected_album)
    end

    def bulk_create
      album = Album.includes(:artist).find_by(id: params.dig(:bulk_tracks, :album_id))
      files = Array(params.dig(:bulk_tracks, :audio_files)).reject(&:blank?)
      items = normalized_bulk_items(album)

      unless album.present?
        redirect_to bulk_new_moderation_tracks_path, alert: "Выберите альбом для загрузки."
        return
      end

      if files.blank?
        redirect_to bulk_new_moderation_tracks_path(album_id: album.id), alert: "Перенесите или выберите аудиофайлы."
        return
      end

      created_tracks = []
      ActiveRecord::Base.transaction do
        items.each_with_index do |item, index|
          file = files[item.fetch(:file_index, index).to_i]
          next unless file.present?

          track = album.tracks.build(
            name: item[:name].presence || filename_without_extension(file),
            number_in_album: item[:position].presence || next_track_number_for(album) + index,
            duration: 1,
            audio_analysis_status: "pending"
          )
          track.audio_file.attach(file)
          track.save!
          created_tracks << track
        end
      end

      created_tracks.each { |track| enqueue_audio_analysis(track) }
      audit!("moderation.track.bulk_created", album, album_id: album.id, count: created_tracks.size, track_ids: created_tracks.map(&:id))

      redirect_to moderation_tracks_path, notice: "Загружено треков: #{created_tracks.size}. Waveform-анализ поставлен в очередь."
    rescue ActiveRecord::RecordInvalid => error
      redirect_to bulk_new_moderation_tracks_path(album_id: album&.id), alert: error.record.errors.full_messages.to_sentence
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
      album_id = params[:album_id] || params.dig(:track, :album_id) || params.dig(:bulk_tracks, :album_id)
      @selected_album = Album.includes(:artist).find_by(id: album_id) if album_id.present?
    end

    def track_create_params
      params.require(:track).permit(:name, :audio_file, :number_in_album, :album_id)
    end

    def track_update_params
      params.require(:track).permit(:name, :audio_file, :number_in_album)
    end

    def normalized_bulk_items(album)
      base_position = next_track_number_for(album)
      raw_items = Array(params[:track_items]).map { |item| item.respond_to?(:permit) ? item.permit(:file_index, :name, :position).to_h : item.to_h }
      return fallback_bulk_items(base_position) if raw_items.blank?

      raw_items.map.with_index do |item, index|
        raw_position = item["position"].to_s.strip
        submitted_position = raw_position.match?(/\A\d+\z/) ? raw_position.to_i : nil

        {
          file_index: item["file_index"].presence || index,
          name: item["name"].to_s.strip,
          position: submitted_position.present? && submitted_position.positive? ? submitted_position : base_position + index
        }
      end.sort_by { |item| [item[:position].to_i, item[:file_index].to_i] }
    end

    def fallback_bulk_items(base_position)
      Array(params.dig(:bulk_tracks, :audio_files)).each_index.map do |index|
        { file_index: index, name: nil, position: base_position + index }
      end
    end

    def next_track_number_for(album)
      return 1 unless album.present?

      album.tracks.maximum(:number_in_album).to_i + 1
    end

    def filename_without_extension(file)
      File.basename(file.original_filename.to_s, File.extname(file.original_filename.to_s)).tr("_", " ").strip.presence || "Без названия"
    end

    def enqueue_audio_analysis(track)
      AnalyzeTrackAudioJob.perform_later(track.id) if track.audio_file.attached?
    end
  end
end
