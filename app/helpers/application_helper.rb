module ApplicationHelper
  def auth_links
    if user_signed_in?
      button_to("Выйти", destroy_user_session_path, method: :delete)
    else
      link_to("Войти", new_user_session_path)
    end
  end

  def show_svg(path, width: nil, height: nil, fill: nil)
    svg_content = File.open("app/assets/images/#{path}", "rb") do |file|
      file.read
    end

    # Удаляем XML декларацию и комментарии
    svg_content = svg_content.gsub(/<\?xml.*?\?>/, '')
    svg_content = svg_content.gsub(/<!--.*?-->/, '')

    # Удаляем старые атрибуты и вставляем новые
    svg_content = svg_content.gsub(/width="[^"]*"/, '')
    svg_content = svg_content.gsub(/height="[^"]*"/, '')
    svg_content = svg_content.gsub(/fill="[^"]*"/, '')

    # Вставляем новые атрибуты
    attrs = []
    attrs << "width=\"#{width}\"" if width
    attrs << "height=\"#{height}\"" if height
    attrs << "fill=\"#{fill}\"" if fill

    if attrs.any?
      svg_content = svg_content.gsub(/<svg /, "<svg #{attrs.join(' ')} ")
    end

    raw svg_content
  end
end
