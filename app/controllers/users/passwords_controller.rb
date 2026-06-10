# frozen_string_literal: true

class Users::PasswordsController < Devise::PasswordsController
  # POST /users/password
  # В проекте нет внешнего SMTP: вместо настоящей отправки письма создаём
  # внутреннее сообщение, которое администратор видит в /admin/mail_messages.
  def create
    email = resource_params[:email].to_s.downcase.strip
    user = resource_class.find_by(email: email)

    create_internal_reset_message!(user, email) if user.present?

    flash[:notice] = "Если аккаунт с таким email существует, письмо придет к вам на почту в течении 30 минут."
    redirect_to new_user_session_path
  end

  private

  def create_internal_reset_message!(user, email)
    raw_token = user.send(:set_reset_password_token)
    reset_url = edit_user_password_url(reset_password_token: raw_token)

    AdminMailMessage.create!(
      recipient: user,
      recipient_email: email,
      subject: "Восстановление пароля для #{user.username}",
      message_type: "password_reset",
      body: internal_reset_body(user, reset_url),
      metadata: {
        reset_url: reset_url,
        user_id: user.id,
        username: user.username,
        requested_ip: request.remote_ip,
        user_agent: request.user_agent.to_s.truncate(500)
      }
    )
  end

  def internal_reset_body(user, reset_url)
    <<~TEXT.strip
      Пользователь запросил восстановление пароля.

      Аккаунт: #{user.username}
      Email: #{user.email}

      Ссылка для восстановления пароля:
      #{reset_url}

      Эту ссылку может использовать владелец аккаунта для установки нового пароля.
    TEXT
  end
end
