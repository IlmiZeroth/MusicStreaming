class CreateAlbumLikes < ActiveRecord::Migration[8.1]
  def change
    create_table :album_likes do |t|
      t.references :user, null: false, foreign_key: true
      t.references :album, null: false, foreign_key: true

      t.timestamps
    end
  end
end
