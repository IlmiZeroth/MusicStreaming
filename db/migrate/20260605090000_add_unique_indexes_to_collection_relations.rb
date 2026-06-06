class AddUniqueIndexesToCollectionRelations < ActiveRecord::Migration[8.1]
  def up
    remove_duplicate_rows(:track_likes, %i[user_id track_id])
    remove_duplicate_rows(:album_likes, %i[user_id album_id])
    remove_duplicate_rows(:playlist_likes, %i[user_id playlist_id])
    remove_duplicate_rows(:follows, %i[follower_id followed_id])

    add_index :track_likes, %i[user_id track_id], unique: true unless index_exists?(:track_likes, %i[user_id track_id], unique: true)
    add_index :album_likes, %i[user_id album_id], unique: true unless index_exists?(:album_likes, %i[user_id album_id], unique: true)
    add_index :playlist_likes, %i[user_id playlist_id], unique: true unless index_exists?(:playlist_likes, %i[user_id playlist_id], unique: true)
    add_index :follows, %i[follower_id followed_id], unique: true unless index_exists?(:follows, %i[follower_id followed_id], unique: true)
  end

  def down
    remove_index :track_likes, column: %i[user_id track_id], if_exists: true
    remove_index :album_likes, column: %i[user_id album_id], if_exists: true
    remove_index :playlist_likes, column: %i[user_id playlist_id], if_exists: true
    remove_index :follows, column: %i[follower_id followed_id], if_exists: true
  end

  private

  def remove_duplicate_rows(table_name, columns)
    partition = columns.join(', ')

    execute <<~SQL.squish
      DELETE FROM #{table_name}
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY #{partition} ORDER BY id) AS row_number
          FROM #{table_name}
        ) duplicates
        WHERE duplicates.row_number > 1
      )
    SQL
  end
end
