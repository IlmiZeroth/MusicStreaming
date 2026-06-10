class Track < ApplicationRecord
  belongs_to :album
  has_one :artist, through: :album

  has_many :playlist_tracks, dependent: :destroy
  has_many :playlists, through: :playlist_tracks

  has_many :track_likes, dependent: :destroy
  has_many :liked_by_users, through: :track_likes, source: :user

  has_one_attached :audio_file

  validates :name, presence: true
  validates :streams, presence: true
  validates :duration, presence: true, numericality: { greater_than: 0, less_than: 1800 }, allow_nil: true
  validates :number_in_album, numericality: { greater_than_or_equal_to: 1 }, allow_nil: true

  def audio_analyzed?
    audio_analysis_status == "ready" &&
      audio_peaks.present? &&
      audio_peaks_version.to_i == AnalyzeTrackAudioJob::PEAKS_VERSION
  end
end
