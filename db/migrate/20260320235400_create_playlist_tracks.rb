class CreatePlaylistTracks < ActiveRecord::Migration[8.1]
  def change
    create_table :playlist_tracks do |t|
      t.references :playlist_id, null: false, foreign_key: true
      t.references :track_id, null: false, foreign_key: true
      t.integer :position

      t.timestamps
    end
  end
end
