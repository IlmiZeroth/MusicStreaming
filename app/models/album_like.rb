class AlbumLike < ApplicationRecord
  belongs_to :user
  belongs_to :album

  validates :user_id, uniqueness: { scope: :album_id }

  after_create :increment_album_likes_count
  after_destroy :decrement_album_likes_count

  private

  def increment_album_likes_count
    album.increment!(:likes)
  end

  def decrement_album_likes_count
    album.decrement!(:likes) if album.likes.to_i.positive?
  end
end
