class CreateTracks < ActiveRecord::Migration[8.1]
  def change
    create_table :tracks do |t|
      t.string :name, default: '', null: false
      t.integer :duration, default: 0, null: false
      t.integer :number_in_album, default: 1, null: false
      t.references :album, null: false, foreign_key: true
      t.bigint :streams, default: 0
      t.bigint :likes, default: 0

      t.timestamps
    end
  end
end
