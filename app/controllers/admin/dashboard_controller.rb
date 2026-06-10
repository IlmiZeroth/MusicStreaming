module Admin
  class DashboardController < BaseController
    def index
      @users_count = User.count
      @moderators_count = User.where(user_role: User::ROLES[:moderator]).count
      @admins_count = User.where(user_role: User::ROLES[:admin]).count
      @artists_count = Artist.count
      @albums_count = Album.count
      @tracks_count = Track.count
      @recent_logs = AuditLog.includes(:actor).recent.limit(10)
    end
  end
end
