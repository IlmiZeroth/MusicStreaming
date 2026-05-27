class AlbumsController < PagesController
  def show
    @album = Album.find(params[:id])
    unless @album.present?
      redirect_to root_path, alert: "Альбом не найден"
    end
    @tracks = @album.tracks.order(number_in_album: :asc)
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

  def album_params
    params.require(:album).permit(:name, :release_date, :cover_image)
  end
end