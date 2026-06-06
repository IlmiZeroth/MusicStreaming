class FollowersController < ApplicationController
  def create
    @user_to_follow = User.find(params[:id])
    current_user.follow_to(@user_to_follow)

    respond_to do |format|
      format.json do
        render json: {
          following: current_user.following?(@user_to_follow),
          followed_id: @user_to_follow.id
        }
      end
      format.html { redirect_back fallback_location: profile_path(@user_to_follow) }
    end
  end

  def destroy
    @user_to_follow = User.find(params[:id])
    current_user.unfollow(@user_to_follow)

    respond_to do |format|
      format.json do
        render json: {
          following: false,
          followed_id: @user_to_follow.id,
          removed: true
        }
      end
      format.html do
        if request.referer&.include?('collection') || params[:from] == 'collection'
          redirect_to collection_index_path, notice: 'Артист удален из коллекции'
        else
          redirect_back fallback_location: profile_path(@user_to_follow), notice: 'Вы отписались от артиста'
        end
      end
    end
  end
end
