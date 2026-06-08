namespace :audio do
  desc "Enqueue waveform/metadata analysis for tracks that have no current-version peaks"
  task analyze_existing: :environment do
    Track.includes(audio_file_attachment: :blob).find_each do |track|
      next unless track.audio_file.attached?
      next if track.audio_analysis_status == "ready" &&
              track.audio_peaks.present? &&
              track.audio_peaks_version.to_i == AnalyzeTrackAudioJob::PEAKS_VERSION

      AnalyzeTrackAudioJob.perform_later(track.id)
      puts "Enqueued audio analysis for track ##{track.id}"
    end
  end

  desc "Force re-analyze waveform/metadata for every track with attached audio"
  task reanalyze_existing: :environment do
    Track.includes(audio_file_attachment: :blob).find_each do |track|
      next unless track.audio_file.attached?

      track.update_columns(
        audio_peaks: nil,
        audio_peaks_version: nil,
        audio_analysis_status: "pending",
        audio_analysis_error: nil,
        updated_at: Time.current
      )

      AnalyzeTrackAudioJob.perform_later(track.id)
      puts "Re-enqueued audio analysis for track ##{track.id}"
    end
  end
end
