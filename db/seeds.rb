# This file should ensure the existence of records required to run the application in every environment.

admin = User.find_by(username: "admin") || User.find_by(email: "admin@example.com") || User.new
admin.username = "admin" if admin.username.blank?
admin.email = "admin@example.com" if admin.email.blank?

if admin.new_record?
  admin.password = "admin123"
  admin.password_confirmation = "admin123"
end

admin.user_role = User::ROLES[:admin]
admin.save!

puts "Default admin is available as login admin / password admin123 / email admin@example.com" if admin.previously_new_record?
