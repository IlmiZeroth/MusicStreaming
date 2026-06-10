class ApplicationController < ActionController::Base
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern
  include Pundit::Authorization
  include Paginatable

  before_action :authenticate_user!
  before_action :configure_permitted_parameters, if: :devise_controller?

  rescue_from Pundit::NotAuthorizedError, with: :user_not_authorized

  def after_sign_in_path_for(_resource)
    pages_path
  end

  def after_sign_up_path_for(_resource)
    pages_path
  end

  def after_update_path_for(resource)
    profile_settings_path(resource)
  end

  def after_sign_out_path_for(_resource_or_scope)
    new_user_session_path
  end

  def user_not_authorized
    flash[:alert] = "У вас нет прав для выполнения этого действия"
    redirect_to(request.referer || root_path)
  end

  private

  def audit!(action, auditable = nil, metadata = {})
    AuditLog.create!(
      actor: current_user,
      action: action,
      auditable: auditable,
      metadata: metadata.presence || {},
      ip_address: request.remote_ip,
      user_agent: request.user_agent.to_s.truncate(500)
    )
  rescue StandardError => error
    Rails.logger.warn("AuditLog failed: #{error.class}: #{error.message}")
  end

  protected

  def configure_permitted_parameters
    devise_parameter_sanitizer.permit(:sign_in, keys: [:login])
    devise_parameter_sanitizer.permit(:sign_up, keys: [:username, :email, :avatar])
    devise_parameter_sanitizer.permit(:account_update, keys: [:username, :email, :password, :password_confirmation, :avatar])
  end
end
