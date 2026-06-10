class ModerationPolicy < ApplicationPolicy
  def access?
    staff?
  end
end
