class UserPolicy < ApplicationPolicy
  def settings?
    user.present? && (user.id == record.id || admin?)
  end

  def update_settings?
    settings?
  end

  def update?
    user.present? && (user.id == record.id || admin?)
  end

  def manage_roles?
    admin?
  end
end
