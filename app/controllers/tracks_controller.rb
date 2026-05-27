class TracksController < PagesController
  before_action :set_user, only: [:update, :destroy]
  before_action :authorize_settings_access!, only: [:update, :destroy]
  def create
    @album = current_user.albums.find_by id: track_params[:album_id]
    if @album.present?
      @track = @album.tracks.build(track_params.merge(duration: 10))
      if @track.save
        redirect_to album_path(@album), notice: "Track was successfully created."
      else
        redirect_to album_path(@album), alert: "Track was not created."
      end
    else
      redirect_to studio_path, alert: "Album was not found."
    end
  end
  def destroy
    @track = Track.find(params[:id])
    @album = @track.album
    if @track.destroy
      redirect_to album_path(@album), notice: "Track was successfully deleted."
    else
      redirect_to album_path(@album), alert: "Track was not deleted."
    end
  end
  def update

  end

  def stream
    @track = Track.find(params[:id])
    if @track.present?
      @track.increment!(:streams)
    end
  end

  def set_user
    @track = Track.find(params[:id])
    @album = @track.album
    @user = @track.user
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

  def track_params
    params.require(:track).permit(:name, :audio_file, :number_in_album, :album_id)
  end
end