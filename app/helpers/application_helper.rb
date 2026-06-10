module ApplicationHelper
  PLAYER_CONTROLLERS = %w[pages profile albums playlists collection search].freeze
  PLAYER_CONTROLLER_PATH_PREFIXES = %w[admin/ moderation/].freeze

  def player_track_payload(track)
    {
      id: track.id.to_s,
      url: track.audio_file.attached? ? audio_track_path(track) : "",
      metadataUrl: track.audio_file.attached? ? metadata_track_path(track) : "",
      duration: track.duration,
      name: track.name,
      artist: track.artist.name,
      image: track.album.cover_image.attached? ? url_for(track.album.cover_image) : asset_path("default-music.svg"),
      liked: current_user.liked_track?(track),
      likeUrl: like_track_path(track),
      unlikeUrl: unlike_track_path(track)
    }
  end

  def player_tracks_payload(tracks)
    tracks.map { |track| player_track_payload(track) }
  end

  def render_player?
    return false unless user_signed_in?

    PLAYER_CONTROLLERS.include?(controller_name) ||
      PLAYER_CONTROLLER_PATH_PREFIXES.any? { |prefix| controller_path.start_with?(prefix) }
  end

  def nav_link_class(active)
    base = "rounded-2xl px-3 py-2 text-sm font-medium transition-colors"
    active ? "#{base} bg-neutral-800 text-white" : "#{base} text-neutral-400 hover:bg-neutral-900 hover:text-white"
  end

  def panel_class
    "rounded-[1.75rem] border border-neutral-800 bg-neutral-900/70 shadow-xl shadow-black/20"
  end

  def primary_button_class
    "inline-flex items-center justify-center rounded-2xl bg-green-400 px-4 py-2 font-semibold text-black transition hover:bg-green-300 hover:text-neutral-800"
  end

  def secondary_button_class
    "inline-flex items-center justify-center rounded-2xl border border-neutral-700 bg-neutral-900/70 px-4 py-2 font-medium text-white transition hover:border-neutral-600 hover:bg-neutral-800"
  end

  def page_shell_class
    "mx-auto w-full max-w-7xl px-4 pb-8 pt-6 sm:px-6 lg:px-8"
  end

  def user_avatar_url(user)
    if user&.avatar&.attached?
      url_for(user.avatar)
    else
      asset_path("default-user.svg")
    end
  end

  def playlist_options_payload
    return [] unless current_user.present?

    current_user.playlists.order(:name).map do |playlist|
      { id: playlist.id.to_s, name: playlist.name }
    end
  end

  def playlist_cover_url(playlist)
    if playlist.cover_image.attached?
      url_for(playlist.cover_image)
    elsif (first_track = playlist.tracks.includes(album: { cover_image_attachment: :blob }).first)&.album&.cover_image&.attached?
      url_for(first_track.album.cover_image)
    else
      asset_path("default-music.svg")
    end
  end
end
