# app/policies/user_policy.rb
class UserPolicy < ApplicationPolicy
  def settings?
    user.present? && (user.id == record.id || user.admin?)
  end

  def update_settings?
    user.present? && (user.id == record.id || user.admin?)
  end

  def show?
    true
  end

  def update?
    user.present? && (user.id == record.id || user.admin?)
  end

  private

  def admin?
    user.admin?
  end
end