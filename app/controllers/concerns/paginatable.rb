# frozen_string_literal: true

module Paginatable
  extend ActiveSupport::Concern

  DEFAULT_PER_PAGE = 20

  private

  def paginate(scope, per_page: DEFAULT_PER_PAGE)
    per_page = per_page.to_i
    per_page = DEFAULT_PER_PAGE if per_page <= 0

    total_count = scope.count
    total_pages = (total_count.to_f / per_page).ceil
    total_pages = 1 if total_pages < 1

    current_page = params[:page].to_i
    current_page = 1 if current_page < 1
    current_page = total_pages if current_page > total_pages

    offset = (current_page - 1) * per_page
    records = scope.offset(offset).limit(per_page)

    pagination = {
      page: current_page,
      per_page: per_page,
      total_count: total_count,
      total_pages: total_pages,
      from: total_count.zero? ? 0 : offset + 1,
      to: [offset + records.size, total_count].min
    }

    [records, pagination]
  end
end
