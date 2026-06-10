class TrackPolicy < ApplicationPolicy
  def audio?
    true
  end

  def metadata?
    true
  end

  def stream?
    true
  end

  def create?
    staff?
  end

  def update?
    staff?
  end

  def destroy?
    staff?
  end

  def manage?
    staff?
  end
end
