module Moderation
  class BaseController < ApplicationController
    before_action :authorize_moderation!

    private

    def authorize_moderation!
      authorize :moderation, :access?
    end
  end
end
