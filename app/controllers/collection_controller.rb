# frozen_string_literal: true

class CollectionController < ApplicationController
  def index
    @playlist = current_user.playlists.build
    @artists = current_user.following.with_attached_avatar.order(:username)
    @liked_tracks = current_user.liked_tracks.includes(album: :user).order('track_likes.created_at DESC')
    @liked_albums = current_user.liked_albums.includes(:user).order('album_likes.created_at DESC')
    @created_playlists = current_user.playlists.order(created_at: :desc)
    @liked_playlists = current_user.liked_playlists.includes(:user).order('playlist_likes.created_at DESC')
  end
end
