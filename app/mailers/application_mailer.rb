class ApplicationMailer < ActionMailer::Base
  default from: -> {
    ENV["MAILER_SENDER"].presence ||
      ENV["SMTP_USERNAME"].presence ||
      "MusicStreaming <no-reply@localhost>"
  }
  layout "mailer"
end
