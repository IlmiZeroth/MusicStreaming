module Admin
  class AuditLogsController < BaseController
    def index
      @logs = AuditLog.includes(:actor).recent.limit(200)
    end
  end
end
