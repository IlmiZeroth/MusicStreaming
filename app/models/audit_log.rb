class AuditLog < ApplicationRecord
  belongs_to :actor, class_name: "User", optional: true
  belongs_to :auditable, polymorphic: true, optional: true

  validates :action, presence: true

  scope :recent, -> { order(created_at: :desc) }

  def actor_name
    actor&.username || "Система"
  end

  def auditable_name
    return "—" unless auditable

    if auditable.respond_to?(:name) && auditable.name.present?
      "#{auditable.class.model_name.human}: #{auditable.name}"
    elsif auditable.respond_to?(:username) && auditable.username.present?
      "#{auditable.class.model_name.human}: #{auditable.username}"
    else
      "#{auditable.class.name} ##{auditable.id}"
    end
  end
end
