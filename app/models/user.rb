class User < ApplicationRecord
  ROLES = {
    user: 0,
    moderator: 1,
    admin: 2
  }.freeze

  ROLE_LABELS = {
    "user" => "Пользователь",
    "moderator" => "Модератор",
    "admin" => "Администратор"
  }.freeze

  attr_writer :login

  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable,
         authentication_keys: [:login]

  has_many :created_artists, class_name: "Artist", foreign_key: :created_by_id, dependent: :nullify

  has_one_attached :avatar

  has_many :playlists, dependent: :destroy

  has_many :track_likes, dependent: :destroy
  has_many :liked_tracks, through: :track_likes, source: :track

  has_many :album_likes, dependent: :destroy
  has_many :liked_albums, through: :album_likes, source: :album

  has_many :playlist_likes, dependent: :destroy
  has_many :liked_playlists, through: :playlist_likes, source: :playlist

  has_many :audit_logs, foreign_key: :actor_id, dependent: :nullify

  # Артисты, на которых пользователь подписан.
  has_many :active_follows, class_name: "Follow", foreign_key: :follower_id, dependent: :destroy
  has_many :following, through: :active_follows, source: :followed

  validates :username, presence: true, uniqueness: true, length: { minimum: 3, maximum: 50 }
  validates :user_role, inclusion: { in: ROLES.values }

  def self.find_for_database_authentication(warden_conditions)
    conditions = warden_conditions.dup
    login = (conditions.delete(:login) || conditions.delete("login")).to_s.downcase.strip

    if login.present?
      where(conditions.to_h).where("LOWER(username) = :login OR LOWER(email) = :login", login: login).first
    else
      super
    end
  end

  def login
    @login || username || email
  end

  def admin?
    user_role.to_i == ROLES[:admin]
  end

  def moderator?
    user_role.to_i == ROLES[:moderator]
  end

  def staff?
    admin? || moderator?
  end

  def user?
    user_role.to_i == ROLES[:user]
  end

  def role_name
    ROLES.key(user_role.to_i).to_s.presence || "user"
  end

  def role_label
    ROLE_LABELS.fetch(role_name, "Пользователь")
  end

  def self.role_options
    ROLE_LABELS.map { |role, label| [label, ROLES.fetch(role.to_sym)] }
  end

  def unfollow(artist)
    active_follows.find_by(followed: artist)&.destroy
  end

  def follow_to(artist)
    return false if following?(artist)

    active_follows.create(followed: artist)
  end

  def following?(artist)
    return false unless artist.present?

    active_follows.exists?(followed: artist)
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
end
