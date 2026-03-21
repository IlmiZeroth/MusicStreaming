class CreateAlbums < ActiveRecord::Migration[8.1]
  def change
    create_table :albums do |t|
      t.string :name
      t.date :release_date
      t.references :user_id, null: false, foreign_key: true
      t.bigint :likes

      t.timestamps
    end
  end
end
