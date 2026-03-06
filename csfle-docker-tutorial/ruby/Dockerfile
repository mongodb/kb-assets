FROM ruby:3.3.6-bookworm
# Create and define the working directory.
RUN mkdir -p /usr/local/app/mongodbcsfle
WORKDIR /usr/local/app/mongodbcsfle
# install coreutils, cmakde, etc 
RUN apt-get update && apt-get install -y coreutils libmongocrypt-dev cmake  gnupg curl build-essential vim
# Install the application's dependencies (ruby mongodb driver and ruby wrapper for libmongocrypt)
RUN gem install mongo ffi  
RUN gem install libmongocrypt-helper --pre
# Copy the following two files to the working directory
COPY make_data_key.rb ./
COPY example.rb ./
# Install mongodb package repos
RUN curl -sL https://pgp.mongodb.com/libmongocrypt.asc | gpg --dearmor >/etc/apt/trusted.gpg.d/libmongocrypt.gpg
RUN echo "deb https://libmongocrypt.s3.amazonaws.com/apt/debian bookworm/libmongocrypt/1.12 main" | tee /etc/apt/sources.list.d/libmongocrypt.list
RUN apt-get update && apt-get install -y libmongocrypt-dev
RUN curl -sL https://pgp.mongodb.com/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
RUN echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.com/apt/debian bookworm/mongodb-enterprise/7.0 main" | tee /etc/apt/sources.list.d/mongodb-enterprise.list
# Set up architecture-specific variables and install crypt_shared
ARG TARGETARCH
ENV MONGO_ARCH=${TARGETARCH}
RUN set -e && \
         mkdir -p /tmp/crypt_shared && cd /tmp/crypt_shared && \
         if [ "$MONGO_ARCH" = "arm64" ]; then \
            echo "Installing ARM64 version" && \
             curl -fsSL -o crypt_shared.tgz https://downloads.mongodb.com/linux/mongo_crypt_shared_v1-linux-aarch64-enterprise-ubuntu2204-7.0.21.tgz; \
  else \
             echo "Installing AMD64 version" && \
             curl -fsSL -o crypt_shared.tgz https://downloads.mongodb.com/linux/mongo_crypt_shared_v1-linux-x86_64-enterprise-ubuntu2204-7.0.21.tgz; \
        fi && \
        tar xzf crypt_shared.tgz && \
        mkdir -p /usr/local/lib && \
        find . -name "mongo_crypt_v1.so" -type f -exec cp {} /usr/local/lib/ \; && \
        ls -la /usr/local/lib/mongo_crypt_v1.so && \
        rm -rf /tmp/crypt_shared
