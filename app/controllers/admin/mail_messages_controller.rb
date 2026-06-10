module Admin
  class MailMessagesController < BaseController
    before_action :set_message, only: [:show, :destroy]

    def index
      @q = params[:q].to_s.strip
      messages = AdminMailMessage.includes(:recipient).recent

      if @q.present?
        like = "%#{ActiveRecord::Base.sanitize_sql_like(@q)}%"
        messages = messages.where(
          <<~SQL.squish,
            admin_mail_messages.recipient_email ILIKE :q OR
            admin_mail_messages.subject ILIKE :q OR
            admin_mail_messages.message_type ILIKE :q OR
            admin_mail_messages.body ILIKE :q OR
            admin_mail_messages.metadata::text ILIKE :q OR
            EXISTS (
              SELECT 1 FROM users
              WHERE users.id = admin_mail_messages.recipient_id
              AND (users.username ILIKE :q OR users.email ILIKE :q)
            )
          SQL
          q: like
        )
      end

      @messages, @pagination = paginate(messages)
      @unread_count = AdminMailMessage.unread.count
    end

    def show
      @message.mark_as_read!
    end

    def destroy
      subject = @message.subject
      @message.destroy!
      audit!("admin.mail_message.deleted", nil, subject: subject, recipient_email: @message.recipient_email)
      redirect_to admin_mail_messages_path, notice: "Письмо удалено."
    end

    private

    def set_message
      @message = AdminMailMessage.find(params[:id])
    end
  end
end
