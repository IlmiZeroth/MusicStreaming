class LandingController < ApplicationController
  skip_before_action :authenticate_user!

  def index
    @tracks_count = Track.count
    @artists_count = Artist.count
    @albums_count = Album.count
    @featured_track = Track.joins(:audio_file_attachment).includes(album: [:artist, { cover_image_attachment: :blob }]).order(Arel.sql("RANDOM()")).first
  end
end
