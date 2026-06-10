class AlbumsController < PagesController
  before_action :set_album, only: [:show, :update, :destroy]
  before_action :authorize_album_management!, only: [:create, :update, :destroy]

  def show
    @tracks = @album.tracks.order(number_in_album: :asc)
    @artist = @album.artist
    @show_actions = AlbumPolicy.new(current_user, @album).manage?
  end

  def create
    @album = Album.new(album_params)

    if @album.save
      audit!("moderation.album.created", @album, name: @album.name, artist_id: @album.artist_id)
      redirect_to album_path(@album), notice: "Альбом создан."
    else
      redirect_to moderation_albums_path, alert: @album.errors.full_messages.to_sentence
    end
  end

  def destroy
    album_id = @album.id
    album_name = @album.name

    if @album.destroy
      audit!("moderation.album.deleted", nil, album_id: album_id, name: album_name)
      redirect_to moderation_albums_path, notice: "Альбом удалён."
    else
      redirect_to album_path(@album), alert: @album.errors.full_messages.to_sentence
    end
  end

  def update
    if @album.update(album_update_params)
      audit!("moderation.album.updated", @album, name: @album.name, artist_id: @album.artist_id)
      redirect_to album_path(@album), notice: "Альбом обновлён."
    else
      redirect_to album_path(@album), alert: @album.errors.full_messages.to_sentence
    end
  end

  private

  def set_album
    @album = Album.find_by(id: params[:id])
    redirect_to root_path, alert: "Альбом не найден" unless @album.present?
  end

  def authorize_album_management!
    authorize Album, :manage?
  end

  def album_params
    params.require(:album).permit(:name, :release_date, :cover_image, :artist_id)
  end

  def album_update_params
    params.require(:album).permit(:name, :release_date, :cover_image)
  end
end
