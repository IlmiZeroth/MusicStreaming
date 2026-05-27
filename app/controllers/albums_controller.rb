class AlbumsController < PagesController
  before_action :set_user, only: [:update, :destroy]
  before_action :authorize_settings_access!, only: [:update, :destroy]

  def show
    @album = Album.find(params[:id])
    unless @album.present?
      redirect_to root_path, alert: "Альбом не найден"
    end
    @tracks = @album.tracks.order(number_in_album: :asc)
    @user = @album.user
    @show_actions = UserPolicy.new(current_user, @user).settings?
  end
  def create
    @album = current_user.albums.build(album_params)

    if @album.save
      redirect_to studio_path, notice: "Album was successfully created."
    else
      redirect_to studio_path, alert: "Album was not created."
    end
  end
  def destroy
    @album = Album.find(params[:id])

    if @album.destroy
      redirect_to studio_path, notice: "Album was successfully deleted."
    else
      redirect_to studio_path, alert: "Album was not deleted."
    end
  end
  def update

  end

  def set_user
    @album = Album.find(params[:id])
    @user = @album.user
    unless @user.present?
      redirect_to studio_path, alert: "Пользователь не найден"
    end
  end

  def authorize_settings_access!
    unless UserPolicy.new(current_user, @user).settings?
      flash[:alert] = "У вас нет доступа к альбомам этого пользователя!"
      redirect_to studio_path
    end
  end

  def album_params
    params.require(:album).permit(:name, :release_date, :cover_image)
  end
end