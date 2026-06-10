class AddAudioAnalysisToTracks < ActiveRecord::Migration[8.1]
  def change
    add_column :tracks, :audio_peaks, :jsonb
    add_column :tracks, :audio_analysis_status, :string, null: false, default: "pending"
    add_column :tracks, :audio_analysis_error, :text
    add_column :tracks, :audio_analyzed_at, :datetime
  end
end
