class TracksController < PagesController
  include ActiveStorage::Streaming

  AUDIO_CHUNK_SIZE = 512.kilobytes

  before_action :set_track, only: [:audio, :metadata, :stream, :update, :destroy]
  before_action :authorize_track_management!, only: [:create, :update, :destroy]

  def create
    @album = Album.find_by(id: track_params[:album_id])
    unless @album.present?
      redirect_to moderation_albums_path, alert: "Альбом не найден."
      return
    end

    @track = @album.tracks.build(track_params.merge(duration: 1, audio_analysis_status: "pending"))

    if @track.save
      AnalyzeTrackAudioJob.perform_later(@track.id) if @track.audio_file.attached?
      audit!("moderation.track.created", @track, name: @track.name, album_id: @track.album_id)
      redirect_to album_path(@album), notice: "Трек создан. Анализ waveform поставлен в очередь."
    else
      redirect_to album_path(@album), alert: @track.errors.full_messages.to_sentence
    end
  end

  def destroy
    @album = @track.album
    track_id = @track.id
    track_name = @track.name

    if @track.destroy
      audit!("moderation.track.deleted", nil, track_id: track_id, name: track_name)
      redirect_to album_path(@album), notice: "Трек удалён."
    else
      redirect_to album_path(@album), alert: @track.errors.full_messages.to_sentence
    end
  end

  def update
    audio_replaced = track_params[:audio_file].present?

    if @track.update(track_params)
      if audio_replaced
        @track.update_columns(
          audio_analysis_status: "pending",
          audio_analysis_error: nil,
          audio_peaks: nil,
          audio_peaks_version: nil,
          audio_analyzed_at: nil,
          updated_at: Time.current
        )
        AnalyzeTrackAudioJob.perform_later(@track.id) if @track.audio_file.attached?
      end

      audit!("moderation.track.updated", @track, name: @track.name, album_id: @track.album_id, audio_replaced: audio_replaced)
      redirect_to album_path(@track.album), notice: "Трек обновлён."
    else
      redirect_to album_path(@track.album), alert: @track.errors.full_messages.to_sentence
    end
  end

  # HTML5 audio endpoint. It supports Range requests, so the browser can request
  # only the next bytes it needs instead of downloading the whole track at once.
  def audio
    return head :not_found unless @track.audio_file.attached?

    blob = @track.audio_file.blob
    response.headers["Accept-Ranges"] = "bytes"
    response.headers["Cache-Control"] = "public, max-age=#{1.hour.to_i}"

    if request.headers["Range"].present?
      range = audio_byte_range(request.headers["Range"], blob.byte_size)
      return range_not_satisfiable(blob.byte_size) unless range

      response.headers["Content-Range"] = "bytes #{range.begin}-#{range.end}/#{blob.byte_size}"
      response.headers["Content-Length"] = range.size.to_s

      send_data blob.service.download_chunk(blob.key, range),
                status: :partial_content,
                type: blob.content_type || "audio/mpeg",
                disposition: :inline,
                filename: blob.filename.to_s
    else
      response.headers["Content-Length"] = blob.byte_size.to_s
      send_blob_stream blob, disposition: :inline
    end
  end

  def metadata
    enqueue_audio_analysis_if_needed

    peaks = current_audio_peaks
    cache_audio_metadata_response(peaks)

    render json: {
      id: @track.id.to_s,
      duration: analyzed_duration,
      peaks: peaks,
      analyzed: peaks.present?,
      status: @track.audio_analysis_status,
      error: @track.audio_analysis_error
    }
  end

  def stream
    @track.increment!(:streams) if @track.present?
    head :no_content
  end

  private

  def set_track
    @track = Track.find(params[:id])
  end

  def authorize_track_management!
    authorize Track, :manage?
  end

  def analyzed_duration
    return nil unless %w[ready metadata_ready].include?(@track.audio_analysis_status)

    duration = @track.duration.to_i
    duration.positive? ? duration : nil
  end

  def current_audio_peaks
    return nil unless @track.audio_peaks_version.to_i == AnalyzeTrackAudioJob::PEAKS_VERSION
    return nil unless @track.audio_peaks.present?

    @track.audio_peaks
  end

  def cache_audio_metadata_response(peaks)
    if peaks.present?
      response.headers["Cache-Control"] = "private, max-age=#{30.minutes.to_i}"
      response.headers["Vary"] = "Accept"
      response.headers["ETag"] = %Q(W/"track-#{@track.id}-peaks-#{@track.audio_peaks_version}-#{@track.audio_analyzed_at&.to_i}")
    else
      response.headers["Cache-Control"] = "no-store"
    end
  end

  def enqueue_audio_analysis_if_needed
    return unless @track.audio_file.attached?
    return if current_audio_peaks.present?
    return if %w[pending processing failed metadata_ready].include?(@track.audio_analysis_status)

    @track.update_columns(
      audio_analysis_status: "pending",
      audio_analysis_error: nil,
      updated_at: Time.current
    )
    AnalyzeTrackAudioJob.perform_later(@track.id)
  end

  def audio_byte_range(range_header, byte_size)
    match = range_header.to_s.match(/\Abytes=(\d*)-(\d*)/)
    return nil unless match

    start_value = match[1]
    end_value = match[2]

    if start_value.blank?
      suffix_length = end_value.to_i
      return nil if suffix_length <= 0

      start_byte = [byte_size - suffix_length, 0].max
      end_byte = byte_size - 1
    else
      start_byte = start_value.to_i
      return nil if start_byte >= byte_size

      requested_end = end_value.present? ? end_value.to_i : byte_size - 1
      end_byte = [requested_end, byte_size - 1].min
    end

    max_end_byte = [start_byte + AUDIO_CHUNK_SIZE - 1, byte_size - 1].min
    end_byte = [end_byte, max_end_byte].min

    return nil if end_byte < start_byte

    start_byte..end_byte
  end

  def range_not_satisfiable(byte_size)
    response.headers["Content-Range"] = "bytes */#{byte_size}"
    head :range_not_satisfiable
  end

  def track_params
    params.require(:track).permit(:name, :audio_file, :number_in_album, :album_id)
  end
end
