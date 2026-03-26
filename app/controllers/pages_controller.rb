class PagesController < ApplicationController
  def index
    @popular_tracks = Track.left_joins(:track_likes)
                           .group(:id)
                           .order('COUNT(track_likes.id) DESC')
                           .limit(10)
    @new_releases = Track.order(created_at: :desc).limit(10)

    # Может быть пустым
    @user_playlists = current_user&.playlists || []
  end
end