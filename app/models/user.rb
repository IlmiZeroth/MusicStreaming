class User < ApplicationRecord
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  has_many :albums, dependent: :destroy
  has_many :tracks, through: :albums

  has_many :playlists, dependent: :destroy

  has_many :track_likes, dependent: :destroy
  has_many :liked_tracks, through: :track_likes, source: :track

  has_many :album_likes, dependent: :destroy
  has_many :liked_albums, through: :album_likes, source: :album

  has_many :playlist_likes, dependent: :destroy
  has_many :liked_playlists, through: :playlist_likes, source: :playlist

  # Люди, на которых пользователь подписан
  has_many :active_follows, class_name: 'Follow', foreign_key: :follower_id, dependent: :destroy
  has_many :following, through: :active_follows, source: :followed

  # Люди, которые подписались на пользователя
  has_many :passive_follows, class_name: 'Follow', foreign_key: :followed_id, dependent: :destroy
  has_many :followers, through: :passive_follows, source: :follower

  has_one_attached :avatar

  validates :username, presence: true, uniqueness: true, length: { minimum: 3, maximum: 50 }
  validates :description, length: { maximum: 500 }

  def admin?
    user_role == 2
  end

  def moderator?
    user_role == 1
  end

  def user?
    user_role == 0
  end

  def total_streams
    tracks.joins(:album).where(albums: { user_id: id }).sum(:streams)
  end

  def unfollow(other_user)
    return false if self == other_user

    active_follows.find_by(followed: other_user)&.destroy
  end

  def follow_to(other_user)
    return false if self == other_user || following?(other_user)

    active_follows.create(followed: other_user)
  end

  def following?(user)
    active_follows.exists?(followed: user)
  end

  def liked_track?(track)
    track_likes.exists?(track: track)
  end

  def liked_album?(album)
    album_likes.exists?(album: album)
  end

  def liked_playlist?(playlist)
    playlist_likes.exists?(playlist: playlist)
  end

  def like_track(track)
    track_likes.find_or_create_by(track: track)
  end

  def unlike_track(track)
    track_likes.find_by(track: track)&.destroy
  end

  def like_album(album)
    album_likes.find_or_create_by(album: album)
  end

  def unlike_album(album)
    album_likes.find_by(album: album)&.destroy
  end

  def like_playlist(playlist)
    playlist_likes.find_or_create_by(playlist: playlist)
  end

  def unlike_playlist(playlist)
    playlist_likes.find_by(playlist: playlist)&.destroy
  end

  def tracks_count
    tracks.count
  end

  def albums_count
    albums.count
  end
end
