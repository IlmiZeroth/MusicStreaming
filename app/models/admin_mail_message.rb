class AdminMailMessage < ApplicationRecord
  belongs_to :recipient, class_name: "User", optional: true

  validates :recipient_email, presence: true
  validates :subject, presence: true
  validates :message_type, presence: true
  validates :body, presence: true

  scope :recent, -> { order(created_at: :desc) }
  scope :unread, -> { where(read_at: nil) }

  def read?
    read_at.present?
  end

  def mark_as_read!
    update!(read_at: Time.current) unless read?
  end

  def recipient_name
    recipient&.username.presence || recipient_email
  end

  def reset_url
    metadata.to_h["reset_url"].presence
  end
end
