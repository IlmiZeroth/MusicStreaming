class CreateTrackLikes < ActiveRecord::Migration[8.1]
  def change
    create_table :track_likes do |t|
      t.references :user, null: false, foreign_key: true
      t.references :track, null: false, foreign_key: true

      t.timestamps
    end
  end
end
