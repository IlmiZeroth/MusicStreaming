FROM ruby:3.4-bookworm

ENV LANG=C.UTF-8 \
    BUNDLE_PATH=/usr/local/bundle \
    BUNDLE_JOBS=4 \
    BUNDLE_RETRY=3 \
    PATH=/rails/bin:/usr/local/bundle/bin:$PATH

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
      build-essential \
      git \
      curl \
      pkg-config \
      libvips \
      libpq-dev \
      postgresql-client \
      ffmpeg \
      sqlite3 \
      libsqlite3-dev \
      nodejs \
      npm && \
    npm install -g yarn@1.22.22 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /rails
COPY . .

RUN bundle install && \
    if [ -f package.json ]; then yarn install --check-files || yarn install; fi && \
    cp bin/docker-entrypoint /usr/bin/docker-entrypoint && \
    chmod +x /usr/bin/docker-entrypoint

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint"]
CMD ["bash", "-lc", "bundle exec rails server -b 0.0.0.0 -p 3000"]
