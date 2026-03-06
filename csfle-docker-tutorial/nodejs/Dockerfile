FROM node:22-bookworm

# Create and define the working directory.
RUN mkdir -p /usr/local/app/mongodbcsfle
WORKDIR /usr/local/app/mongodbcsfle

# Install the application's dependencies (node mongodb driver and the Node.js wrapper for libmongocrypt)

RUN npm install mongodb mongodb-client-encryption

# Copy the following two files to the working directory
COPY make_data_key.js ./
COPY example.js ./

# Install mongodb package repos

RUN curl -sL https://pgp.mongodb.com/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
RUN echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.com/apt/debian bookworm/mongodb-enterprise/7.0 main" | tee /etc/apt/sources.list.d/mongodb-enterprise.list

# install coreutils vim
RUN apt-get update && apt-get install -y coreutils vim

# Set up architecture-specific variables and install crypt_shared
ARG TARGETARCH
ENV MONGO_ARCH=${TARGETARCH}
RUN set -e && \
   mkdir -p /tmp/crypt_shared && cd /tmp/crypt_shared && \
   if [ "$MONGO_ARCH" = "arm64" ]; then \
       echo "Installing ARM64 version" && \
       curl -fsSL -o crypt_shared.tgz https://downloads.mongodb.com/linux/mongo_crypt_shared_v1-linux-aarch64-enterprise-ubuntu2204-7.0.16.tgz; \
   else \
       echo "Installing AMD64 version" && \
       curl -fsSL -o crypt_shared.tgz https://downloads.mongodb.com/linux/mongo_crypt_shared_v1-linux-x86_64-enterprise-ubuntu2204-7.0.16.tgz; \
   fi && \
   tar xzf crypt_shared.tgz && \
   mkdir -p /usr/local/lib && \
   find . -name "mongo_crypt_v1.so" -type f -exec cp {} /usr/local/lib/ \; && \
   ls -la /usr/local/lib/mongo_crypt_v1.so && \
   rm -rf /tmp/crypt_shared
