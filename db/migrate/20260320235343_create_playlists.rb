class CreatePlaylists < ActiveRecord::Migration[8.1]
  def change
    create_table :playlists do |t|
      t.string :name
      t.text :description
      t.references :user_id, null: false, foreign_key: true

      t.timestamps
    end
  end
end
