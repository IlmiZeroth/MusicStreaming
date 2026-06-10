module Admin
  class AuditLogsController < BaseController
    def index
      @q = params[:q].to_s.strip
      logs = AuditLog.includes(:actor).recent

      if @q.present?
        like = "%#{ActiveRecord::Base.sanitize_sql_like(@q)}%"
        logs = logs.where(
          <<~SQL.squish,
            audit_logs.action ILIKE :q OR
            audit_logs.ip_address ILIKE :q OR
            audit_logs.user_agent ILIKE :q OR
            audit_logs.auditable_type ILIKE :q OR
            CAST(audit_logs.auditable_id AS TEXT) ILIKE :q OR
            audit_logs.metadata::text ILIKE :q OR
            EXISTS (
              SELECT 1 FROM users
              WHERE users.id = audit_logs.actor_id
              AND (users.username ILIKE :q OR users.email ILIKE :q)
            )
          SQL
          q: like
        )
      end

      @logs, @pagination = paginate(logs)
    end
  end
end
