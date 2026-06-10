# frozen_string_literal: true

class LikesController < ApplicationController
  before_action :set_track, only: %i[like_track unlike_track]
  before_action :set_album, only: %i[like_album unlike_album]
  before_action :set_playlist, only: %i[like_playlist unlike_playlist]

  def like_track
    current_user.like_track(@track)
    respond_like(resource_type: 'track', resource: @track, liked: true, fallback_location: root_path)
  end

  def unlike_track
    current_user.unlike_track(@track)
    respond_like(resource_type: 'track', resource: @track, liked: false, fallback_location: collection_index_path)
  end

  def like_album
    current_user.like_album(@album)
    respond_like(resource_type: 'album', resource: @album, liked: true, fallback_location: root_path)
  end

  def unlike_album
    current_user.unlike_album(@album)
    respond_like(resource_type: 'album', resource: @album, liked: false, fallback_location: collection_index_path)
  end

  def like_playlist
    current_user.like_playlist(@playlist)
    respond_like(resource_type: 'playlist', resource: @playlist, liked: true, fallback_location: collection_index_path)
  end

  def unlike_playlist
    current_user.unlike_playlist(@playlist)
    respond_like(resource_type: 'playlist', resource: @playlist, liked: false, fallback_location: collection_index_path)
  end

  private

  def respond_like(resource_type:, resource:, liked:, fallback_location:)
    respond_to do |format|
      format.html { redirect_back fallback_location: fallback_location }
      format.json do
        render json: {
          resource_type: resource_type,
          resource_id: resource.id,
          liked: liked
        }
      end
    end
  end

  def set_track
    @track = Track.find(params[:id])
  end

  def set_album
    @album = Album.find(params[:id])
  end

  def set_playlist
    @playlist = Playlist.find(params[:id])
  end
end
