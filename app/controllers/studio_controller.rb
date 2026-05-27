class StudioController < PagesController
  def index
    @user = current_user
    @albums = @user.albums
  end
end