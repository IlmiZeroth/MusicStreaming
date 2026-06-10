class StudioController < PagesController
  def index
    authorize :moderation, :access?
    redirect_to moderation_root_path
  end
end
