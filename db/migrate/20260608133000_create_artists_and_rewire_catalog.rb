class CreateArtistsAndRewireCatalog < ActiveRecord::Migration[8.1]
  def up
    create_table :artists do |t|
      t.string :name, null: false
      t.text :description, default: "", null: false
      t.bigint :legacy_user_id
      t.references :created_by, foreign_key: { to_table: :users }
      t.timestamps
    end

    add_index :artists, :name, unique: true
    add_index :artists, :legacy_user_id, unique: true

    execute <<~SQL.squish
      INSERT INTO artists (name, description, legacy_user_id, created_at, updated_at)
      SELECT username, COALESCE(description, ''), id, created_at, updated_at
      FROM users
    SQL

    execute <<~SQL.squish
      INSERT INTO active_storage_attachments (name, record_type, record_id, blob_id, created_at)
      SELECT 'avatar', 'Artist', artists.id, active_storage_attachments.blob_id, active_storage_attachments.created_at
      FROM active_storage_attachments
      INNER JOIN artists ON artists.legacy_user_id = active_storage_attachments.record_id
      WHERE active_storage_attachments.record_type = 'User'
        AND active_storage_attachments.name = 'avatar'
    SQL

    add_reference :albums, :artist, foreign_key: true

    execute <<~SQL.squish
      UPDATE albums
      SET artist_id = artists.id
      FROM artists
      WHERE albums.user_id = artists.legacy_user_id
    SQL

    execute <<~SQL.squish
      DELETE FROM albums WHERE artist_id IS NULL
    SQL

    change_column_null :albums, :artist_id, false

    if foreign_key_exists?(:albums, :users)
      remove_foreign_key :albums, :users
    end
    remove_index :albums, :user_id if index_exists?(:albums, :user_id)
    remove_column :albums, :user_id

    change_column :follows, :follower_id, :bigint
    change_column :follows, :followed_id, :bigint

    execute <<~SQL.squish
      UPDATE follows
      SET followed_id = artists.id
      FROM artists
      WHERE follows.followed_id = artists.legacy_user_id
    SQL

    execute <<~SQL.squish
      DELETE FROM follows
      WHERE followed_id NOT IN (SELECT id FROM artists)
    SQL
  end

  def down
    execute <<~SQL.squish
      UPDATE follows
      SET followed_id = artists.legacy_user_id
      FROM artists
      WHERE follows.followed_id = artists.id
        AND artists.legacy_user_id IS NOT NULL
    SQL

    change_column :follows, :follower_id, :integer
    change_column :follows, :followed_id, :integer

    add_reference :albums, :user, foreign_key: true

    execute <<~SQL.squish
      UPDATE albums
      SET user_id = artists.legacy_user_id
      FROM artists
      WHERE albums.artist_id = artists.id
    SQL

    execute <<~SQL.squish
      DELETE FROM albums WHERE user_id IS NULL
    SQL

    change_column_null :albums, :user_id, false
    remove_reference :albums, :artist, foreign_key: true
    drop_table :artists
  end
end
