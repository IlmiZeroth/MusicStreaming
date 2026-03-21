class Album < ApplicationRecord
  belongs_to :user

  has_many :tracks, -> { order(number_in_album: :asc) }, dependent: :destroy
  has_many :album_likes, dependent: :destroy
  has_many :liked_by_users, through: :album_likes, source: :user

  has_one_attached :cover_image

  validates :name, presence: true
  validates :release_date, presence: true
end
