# frozen_string_literal: true

class PlaylistsController < ApplicationController
  def create
    @playlist = current_user.playlists.build(playlist_params)

    if @playlist.save
      redirect_to collection_index_path, notice: 'Плейлист создан'
    else
      redirect_to collection_index_path, alert: @playlist.errors.full_messages.to_sentence.presence || 'Не удалось создать плейлист'
    end
  end

  private

  def playlist_params
    params.require(:playlist).permit(:name, :description)
  end
end
