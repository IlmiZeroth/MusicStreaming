module Moderation
  class DashboardController < BaseController
    def index
      @artists_count = Artist.count
      @albums_count = Album.count
      @tracks_count = Track.count
      @failed_tracks_count = Track.where(audio_analysis_status: "failed").count
      @recent_albums = Album.includes(:artist).order(created_at: :desc).limit(8)
      @recent_tracks = Track.includes(album: [:artist, { cover_image_attachment: :blob }]).with_attached_audio_file.order(created_at: :desc).limit(8)
    end
  end
end
