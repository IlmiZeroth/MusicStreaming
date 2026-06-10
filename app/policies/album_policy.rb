class AlbumPolicy < ApplicationPolicy
  def show?
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
