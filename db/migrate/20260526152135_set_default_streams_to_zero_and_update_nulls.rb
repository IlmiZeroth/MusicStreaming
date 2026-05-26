class SetDefaultStreamsToZeroAndUpdateNulls < ActiveRecord::Migration[8.1]
  def up
    change_column_default :albums, :likes, from: nil, to: 0
    Album.where(likes: nil).update_all(likes: 0)
    change_column_null :albums, :likes, false

    change_column_default :tracks, :streams, from: nil, to: 0
    Track.where(streams: nil).update_all(streams: 0)
    change_column_null :tracks, :streams, false

    change_column_default :tracks, :likes, from: nil, to: 0
    Track.where(likes: nil).update_all(likes: 0)
    change_column_null :tracks, :likes, false
  end

  def down
    change_column_null :albums, :likes, true
    change_column_default :albums, :likes, from: 0, to: nil
    change_column_null :tracks, :streams, true
    change_column_default :tracks, :streams, from: 0, to: nil
    change_column_null :tracks, :likes, true
    change_column_default :tracks, :likes, from: 0, to: nil
  end
end
