class Playlist < ApplicationRecord
  belongs_to :user

  has_many :playlist_tracks, dependent: :destroy
  has_many :tracks, through: :playlist_tracks
  has_many :playlist_likes, dependent: :destroy
  has_many :liked_by_users, through: :playlist_likes, source: :user

  validates :name, presence: true, length: { maximum: 80 }
  validates :description, length: { maximum: 500 }
end
