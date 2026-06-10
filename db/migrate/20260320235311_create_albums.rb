class CreateAlbums < ActiveRecord::Migration[8.1]
  def change
    create_table :albums do |t|
      t.string :name, default: '', null: false
      t.date :release_date, null: false
      t.references :user, null: false, foreign_key: true
      t.bigint :likes, default: 0

      t.timestamps
    end
  end
end
