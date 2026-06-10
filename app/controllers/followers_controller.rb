class FollowersController < ApplicationController
  def create
    @artist = Artist.find(params[:id])
    current_user.follow_to(@artist)

    respond_to do |format|
      format.json do
        render json: {
          following: current_user.following?(@artist),
          followed_id: @artist.id
        }
      end
      format.html { redirect_back fallback_location: profile_path(@artist) }
    end
  end

  def destroy
    @artist = Artist.find(params[:id])
    current_user.unfollow(@artist)

    respond_to do |format|
      format.json do
        render json: {
          following: false,
          followed_id: @artist.id,
          removed: true
        }
      end
      format.html do
        if request.referer&.include?("collection") || params[:from] == "collection"
          redirect_to collection_index_path, notice: "Артист удален из коллекции"
        else
          redirect_back fallback_location: profile_path(@artist), notice: "Вы отписались от артиста"
        end
      end
    end
  end
end
