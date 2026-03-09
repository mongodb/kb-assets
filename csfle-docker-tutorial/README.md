# CSFLE Docker Tutorial

Dockerfiles and scripts for running MongoDB Client-Side Field Level Encryption (CSFLE) with automatic encryption inside Docker containers.

## Contents

### Node.js (`nodejs/`)

- `Dockerfile` - Builds a Debian-based Node.js container with the MongoDB driver, `mongodb-client-encryption`, and the `crypt_shared` library.
- `make_data_key.js` - Generates a local master key and creates a Data Encryption Key (DEK) in the key vault collection.
- `example.js` - Inserts an encrypted document and queries it with both an encrypted and non-encrypted client.

### Ruby (`ruby/`)

- `Dockerfile` - Builds a Debian-based Ruby container with the MongoDB Ruby driver, `libmongocrypt`, and the `crypt_shared` library.
- `make_data_key.rb` - Generates a local master key and creates a Data Encryption Key (DEK) in the key vault collection.
- `example.rb` - Inserts an encrypted document and queries it with both an encrypted and non-encrypted client.

## Prerequisites

- [Docker](https://docs.docker.com/get-started/get-docker/)
- A MongoDB Atlas cluster connection string

## Usage

1. Update the connection string placeholder in `make_data_key` and `example` files with your Atlas connection string.
2. From the `nodejs/` or `ruby/` directory, build the Docker image with a tag name:

   - **Node.js:**

     ```bash
     docker build . -t mdb-csfle-example
     ```

   - **Ruby:**

     ```bash
     docker build . -t mdb-csfle-example_ruby
     ```

3. Run the container interactively:

   - **Node.js:**

     ```bash
     docker run -ti mdb-csfle-example:latest /bin/bash
     ```

   - **Ruby:**

     ```bash
     docker run -ti mdb-csfle-example_ruby:latest /bin/bash
     ```

4. Inside the container, generate a Data Encryption Key:

   - **Node.js:**

     ```bash
     node make_data_key.js
     ```

   - **Ruby:**

     ```bash
     ruby make_data_key.rb
     ```

5. Insert an encrypted document by executing **example** files:

   - **Node.js:**

     ```bash
     node example.js
     ```

   - **Ruby:**

     ```bash
     ruby example.rb
     ```
