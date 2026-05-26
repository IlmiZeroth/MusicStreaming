class FollowersController < ApplicationController
  def create
    @user_to_follow = User.find(params[:id])

    puts "=== FOLLOW DEBUG ==="
    puts "Current user: #{current_user.id}"
    puts "Target user: #{@user_to_follow.id}"
    puts "Already following? #{current_user.following?(@user_to_follow)}"

    result = current_user.follow_to(@user_to_follow)
    puts "Follow result: #{result.inspect}"
    puts "Follow errors: #{result.errors.full_messages if result.respond_to?(:errors)}"

    # Проверьте после создания
    puts "Now following? #{current_user.following?(@user_to_follow)}"

    redirect_to profile_path(@user_to_follow)
  end
  def destroy
    @user_to_follow = User.find(params[:id])
    current_user.unfollow(@user_to_follow)
    redirect_to profile_path(@user_to_follow)
  end
end