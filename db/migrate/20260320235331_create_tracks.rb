class CreateTracks < ActiveRecord::Migration[8.1]
  def change
    create_table :tracks do |t|
      t.string :name
      t.integer :duration
      t.integer :number_in_album
      t.references :album_id, null: false, foreign_key: true
      t.bigint :streams
      t.bigint :likes

      t.timestamps
    end
  end
end
