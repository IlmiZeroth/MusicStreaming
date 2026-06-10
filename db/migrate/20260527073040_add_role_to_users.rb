class AddRoleToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :user_role, :integer, default: 0, null: false
  end
end
