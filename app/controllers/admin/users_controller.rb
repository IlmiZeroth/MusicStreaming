module Admin
  class UsersController < BaseController
    before_action :set_user, only: [:edit, :update, :destroy]

    def index
      @q = params[:q].to_s.strip
      users = User.with_attached_avatar.order(:username)

      if @q.present?
        like = "%#{ActiveRecord::Base.sanitize_sql_like(@q)}%"
        users = users.where(
          "users.username ILIKE :q OR users.email ILIKE :q OR CAST(users.id AS TEXT) ILIKE :q",
          q: like
        )
      end

      @users, @pagination = paginate(users)
    end

    def edit
    end

    def update
      old_role = @user.user_role
      attrs = admin_user_params.to_h
      attrs.delete("password") if attrs["password"].blank?
      attrs.delete("password_confirmation") if attrs["password_confirmation"].blank?
      new_role = attrs["user_role"].presence&.to_i || old_role

      if @user == current_user && old_role.to_i != new_role.to_i
        redirect_to edit_admin_user_path(@user), alert: "Нельзя изменить собственную роль через админ-панель."
        return
      end

      if removing_last_admin?(old_role, new_role)
        redirect_to edit_admin_user_path(@user), alert: "Нельзя забрать права у последнего администратора."
        return
      end

      if @user.update(attrs)
        audit!("admin.user.updated", @user, changed_fields: attrs.keys - ["password", "password_confirmation"], role_from: old_role, role_to: @user.user_role)
        redirect_to admin_users_path, notice: "Пользователь #{@user.username} обновлён."
      else
        flash.now[:alert] = @user.errors.full_messages.to_sentence
        render :edit, status: :unprocessable_entity
      end
    end

    def destroy
      if @user == current_user
        redirect_to admin_users_path, alert: "Нельзя удалить собственный аккаунт из этой панели."
        return
      end

      if removing_last_admin?(@user.user_role, User::ROLES[:user])
        redirect_to admin_users_path, alert: "Нельзя удалить последнего администратора."
        return
      end

      username = @user.username
      user_id = @user.id
      @user.destroy!
      audit!("admin.user.deleted", nil, user_id: user_id, username: username)
      redirect_to admin_users_path, notice: "Пользователь #{username} удалён."
    rescue ActiveRecord::RecordNotDestroyed => error
      redirect_to admin_users_path, alert: error.record.errors.full_messages.to_sentence
    end

    private

    def set_user
      @user = User.find(params[:id])
    end

    def admin_user_params
      params.require(:user).permit(:username, :email, :user_role, :password, :password_confirmation, :avatar)
    end

    def removing_last_admin?(old_role, new_role)
      old_role.to_i == User::ROLES[:admin] &&
        new_role.to_i != User::ROLES[:admin] &&
        User.where(user_role: User::ROLES[:admin]).count <= 1
    end
  end
end
