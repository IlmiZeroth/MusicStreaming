module Moderation
  class AlbumsController < BaseController
    before_action :set_album, only: [:edit, :update, :destroy]
    before_action :set_selected_artist, only: [:new, :edit, :create, :update]

    def index
      @q = params[:q].to_s.strip
      albums = Album.joins(:artist).includes(:artist, :tracks).order(created_at: :desc)

      if @q.present?
        like = "%#{ActiveRecord::Base.sanitize_sql_like(@q)}%"
        albums = albums.where(
          "albums.name ILIKE :q OR artists.name ILIKE :q OR CAST(albums.release_date AS TEXT) ILIKE :q",
          q: like
        )
      end

      @albums, @pagination = paginate(albums)
    end

    def search
      query = params[:q].to_s.strip
      albums = Album.joins(:artist).includes(:artist).order(Artist.arel_table[:name].asc, Album.arel_table[:name].asc)
      if query.present?
        like = "%#{ActiveRecord::Base.sanitize_sql_like(query)}%"
        albums = albums.where("albums.name ILIKE :q OR artists.name ILIKE :q", q: like)
      end

      render json: albums.limit(12).map { |album|
        {
          id: album.id,
          label: album.name,
          subtitle: "#{album.artist.name} · #{album.release_date || 'без даты'} · следующий №#{next_track_number_for(album)}",
          next_position: next_track_number_for(album)
        }
      }
    end

    def new
      @album = Album.new(artist_id: params[:artist_id])
      @selected_artist ||= @album.artist
    end

    def create
      @album = Album.new(album_create_params)
      @selected_artist = @album.artist

      if @album.save
        audit!("moderation.album.created", @album, name: @album.name, artist_id: @album.artist_id)
        redirect_to moderation_albums_path, notice: "Альбом создан."
      else
        render :new, status: :unprocessable_entity
      end
    end

    def edit
      @selected_artist = @album.artist
    end

    def update
      @selected_artist = @album.artist

      if @album.update(album_update_params)
        audit!("moderation.album.updated", @album, name: @album.name, artist_id: @album.artist_id)
        redirect_to moderation_albums_path, notice: "Альбом обновлён."
      else
        render :edit, status: :unprocessable_entity
      end
    end

    def destroy
      album_id = @album.id
      album_name = @album.name

      if @album.destroy
        audit!("moderation.album.deleted", nil, album_id: album_id, name: album_name)
        redirect_to moderation_albums_path, notice: "Альбом удалён."
      else
        redirect_to moderation_albums_path, alert: @album.errors.full_messages.to_sentence
      end
    end

    private

    def next_track_number_for(album)
      album.tracks.maximum(:number_in_album).to_i + 1
    end

    def set_album
      @album = Album.find(params[:id])
    end

    def set_selected_artist
      artist_id = params[:artist_id] || params.dig(:album, :artist_id)
      @selected_artist = Artist.find_by(id: artist_id) if artist_id.present?
    end

    def album_create_params
      params.require(:album).permit(:name, :release_date, :cover_image, :artist_id)
    end

    def album_update_params
      params.require(:album).permit(:name, :release_date, :cover_image)
    end
  end
end
