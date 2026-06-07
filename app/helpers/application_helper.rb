module ApplicationHelper
  def player_track_payload(track)
    {
      id: track.id.to_s,
      url: track.audio_file.attached? ? url_for(track.audio_file) : '',
      name: track.name,
      artist: track.user.username,
      image: track.album.cover_image.attached? ? url_for(track.album.cover_image) : asset_path('default-music.svg'),
      liked: current_user.liked_track?(track),
      likeUrl: like_track_path(track),
      unlikeUrl: unlike_track_path(track)
    }
  end

  def player_tracks_payload(tracks)
    tracks.map { |track| player_track_payload(track) }
  end
end
