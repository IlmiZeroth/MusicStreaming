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

  # Люди, которые подписались на пользователя (устал путать уже просто)
  has_many :passive_follows, class_name: 'Follow', foreign_key: :followed_id, dependent: :destroy
  has_many :followers, through: :passive_follows, source: :follower

  has_one_attached :avatar
  validates :username, presence: true, uniqueness: true, length: { minimum: 3, maximum: 50 }
  validates :description, length: { maximum: 500 }

  def total_streams
    tracks.joins(:album).where(albums: { user_id: id }).sum(:streams)
  end
  def unfollow(other_user)
    return false if self == other_user

    follow = active_follows.find_by(followed: other_user)
    follow&.destroy
  end

  def follow_to(other_user)
    return false if self == other_user || following?(other_user)

    active_follows.create(followed: other_user)
  end
  def following?(user)
    following.include?(user)
  end
  def tracks_count
    tracks.count
  end
  def albums_count
    albums.count
  end
end
