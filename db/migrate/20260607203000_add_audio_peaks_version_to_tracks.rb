class AddAudioPeaksVersionToTracks < ActiveRecord::Migration[8.1]
  def change
    add_column :tracks, :audio_peaks_version, :integer
  end
end
