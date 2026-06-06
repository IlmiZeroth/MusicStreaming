class TrackLike < ApplicationRecord
  belongs_to :user
  belongs_to :track

  validates :user_id, uniqueness: { scope: :track_id }

  after_create :increment_track_likes_count
  after_destroy :decrement_track_likes_count

  private

  def increment_track_likes_count
    track.increment!(:likes)
  end

  def decrement_track_likes_count
    track.decrement!(:likes) if track.likes.to_i.positive?
  end
end
