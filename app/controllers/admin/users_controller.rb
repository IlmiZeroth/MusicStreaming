module Admin
  class UsersController < BaseController
    before_action :set_user, only: :update

    def index
      @users = User.order(:username)
    end

    def update
      old_role = @user.user_role
      new_role = user_role_param.to_i

      if @user == current_user && old_role != new_role
        redirect_to admin_users_path, alert: "Нельзя изменить собственную роль через админ-панель."
        return
      end

      if removing_last_admin?(old_role, new_role)
        redirect_to admin_users_path, alert: "Нельзя забрать права у последнего администратора."
        return
      end

      if @user.update(user_role: new_role)
        audit!("admin.user.role_changed", @user, from: old_role, to: new_role)
        redirect_to admin_users_path, notice: "Роль пользователя #{@user.username} обновлена."
      else
        redirect_to admin_users_path, alert: @user.errors.full_messages.to_sentence
      end
    end

    private

    def set_user
      @user = User.find(params[:id])
    end

    def user_role_param
      params.require(:user).require(:user_role)
    end

    def removing_last_admin?(old_role, new_role)
      old_role.to_i == User::ROLES[:admin] &&
        new_role.to_i != User::ROLES[:admin] &&
        User.where(user_role: User::ROLES[:admin]).count <= 1
    end
  end
end
