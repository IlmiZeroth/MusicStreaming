module ApplicationHelper
  def auth_links
    if user_signed_in?
      button_to("Выйти", destroy_user_session_path, method: :delete)
    else
      link_to("Войти", new_user_session_path)
    end
  end
end
