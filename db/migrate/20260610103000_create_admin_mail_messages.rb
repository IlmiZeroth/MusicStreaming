class CreateAdminMailMessages < ActiveRecord::Migration[8.1]
  def change
    create_table :admin_mail_messages do |t|
      t.references :recipient, foreign_key: { to_table: :users }, null: true
      t.string :recipient_email, null: false
      t.string :subject, null: false
      t.string :message_type, null: false, default: "password_reset"
      t.text :body, null: false
      t.jsonb :metadata, null: false, default: {}
      t.datetime :read_at

      t.timestamps
    end

    add_index :admin_mail_messages, [:message_type, :created_at]
    add_index :admin_mail_messages, :read_at
  end
end
