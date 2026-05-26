class TracksController < PagesController
  def create
    @album = current_user.albums.find_by id: track_params[:album_id]
    if @album.present?
      @track = @album.tracks.build(track_params.merge(duration: 10))
      if @track.save
        redirect_to studio_path, notice: "Track was successfully created."
      else
        redirect_to studio_path, alert: "Track was not created."
      end
    else
      redirect_to studio_path, alert: "Album was not found."
    end
  end
  def destroy
    @track = Track.find(params[:id])
    if @track.destroy
      redirect_to studio_path, notice: "Track was successfully deleted."
    else
      redirect_to studio_path, alert: "Track was not deleted."
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

  def track_params
    params.require(:track).permit(:name, :audio_file, :number_in_album, :album_id)
  end
end