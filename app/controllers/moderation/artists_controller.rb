module Moderation
  class ArtistsController < BaseController
    before_action :set_artist, only: [:edit, :update, :destroy]

    def index
      @q = params[:q].to_s.strip
      artists = Artist.with_attached_avatar.order(:name)

      if @q.present?
        like = "%#{ActiveRecord::Base.sanitize_sql_like(@q)}%"
        artists = artists.where("artists.name ILIKE :q OR artists.description ILIKE :q", q: like)
      end

      @artists, @pagination = paginate(artists)
    end

    def search
      query = params[:q].to_s.strip
      artists = Artist.order(:name)
      artists = artists.where("name ILIKE ?", "%#{ActiveRecord::Base.sanitize_sql_like(query)}%") if query.present?

      render json: artists.limit(12).map { |artist|
        {
          id: artist.id,
          label: artist.name,
          subtitle: "#{artist.albums_count} альбомов · #{artist.tracks_count} треков"
        }
      }
    end

    def new
      @artist = Artist.new
    end

    def create
      @artist = Artist.new(artist_params)
      @artist.created_by = current_user

      if @artist.save
        audit!("moderation.artist.created", @artist, name: @artist.name)
        redirect_to moderation_artists_path, notice: "Артист создан."
      else
        render :new, status: :unprocessable_entity
      end
    end

    def edit
    end

    def update
      if @artist.update(artist_params)
        audit!("moderation.artist.updated", @artist, name: @artist.name)
        redirect_to moderation_artists_path, notice: "Артист обновлён."
      else
        render :edit, status: :unprocessable_entity
      end
    end

    def destroy
      artist_id = @artist.id
      artist_name = @artist.name

      if @artist.destroy
        audit!("moderation.artist.deleted", nil, name: artist_name, artist_id: artist_id)
        redirect_to moderation_artists_path, notice: "Артист удалён."
      else
        redirect_to moderation_artists_path, alert: @artist.errors.full_messages.to_sentence
      end
    end

    private

    def set_artist
      @artist = Artist.find(params[:id])
    end

    def artist_params
      params.require(:artist).permit(:name, :description, :avatar)
    end
  end
end
