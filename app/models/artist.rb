class Artist < ApplicationRecord
  belongs_to :created_by, class_name: "User", optional: true

  has_many :albums, dependent: :destroy
  has_many :tracks, through: :albums

  has_many :passive_follows, class_name: "Follow", foreign_key: :followed_id, dependent: :destroy
  has_many :followers, through: :passive_follows, source: :follower

  has_one_attached :avatar

  validates :name, presence: true, uniqueness: { case_sensitive: false }, length: { minimum: 1, maximum: 80 }
  validates :description, length: { maximum: 1_000 }

  def total_streams
    tracks.sum(:streams)
  end

  def tracks_count
    tracks.count
  end

  def albums_count
    albums.count
  end

  def username
    name
  end

  def moderation_label
    name
  end
end
