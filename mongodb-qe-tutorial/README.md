# MongoDB Queryable Encryption Tutorial (Python)  
**Automatic Client-Side Field Level Encryption with Azure Key Vault – Including CMK Rotation in Atlas**

## Overview

This repository demonstrates how to set up [MongoDB Queryable Encryption (QE)](https://www.mongodb.com/docs/manual/core/queryable-encryption/#std-label-qe-manual-feature-qe) using Python and Azure Key Vault, including secure Data Encryption Key (DEK) management and rewrapping after Customer Master Key (CMK) rotation in MongoDB Atlas.

Queryable Encryption allows you to **encrypt sensitive data client side**, perform expressive queries on encrypted fields, and manage your encryption keys securely with cloud KMS providers such as Azure Key Vault.

## Features

- **Create encrypted MongoDB collections** with [automatic encryption](https://www.mongodb.com/docs/manual/core/queryable-encryption/install-library/#std-label-qe-csfle-install-library)
- **Encrypt and decrypt fields transparently** in application code
- Use [Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/general/overview) for secure key management (CMK)
- **Rewrap DEKs** (change key under which your encrypted keys are wrapped) after CMK rotation
- Full Python demo including helper functions, insertion, and querying

## Prerequisites

### Software

- **Python 3**  
- [MongoDB Atlas Cluster](https://www.mongodb.com/cloud/atlas/register)
- [PyMongo Driver](https://www.mongodb.com/docs/languages/python/pymongo-driver/current/) (`>=4.4`)
- [pymongocrypt](https://pypi.org/project/pymongocrypt/) (`>=1.6`)
- Automatic Encryption Shared Library ([crypt_shared](https://www.mongodb.com/docs/manual/core/queryable-encryption/install-library/#automatic-encryption-shared-library))

### Cloud Providers (Azure)

- [Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/general/overview) with your **CMK**  
- [Register your application in Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)  
- Assign the application the **Key Vault Administrator** role, or permissions to wrap/unwrap keys

### Other Supported KMS Providers
- AWS, GCP, KMIP, or local (see `.env` placeholders)

---

## Getting Started

### 1. Clone This Repository

```bash
git clone https://github.com/<your-org>/<your-repo>.git
cd /<your-repo>/mongodb-qe-tutorial
```

### 2. Populate Environment Variables

Edit the **.env** file and replace all placeholder values (`<Your ...>`) with your credentials.

```bash
# Azure Example:
export AZURE_TENANT_ID="<Your Azure tenant ID>"
export AZURE_CLIENT_ID="<Your Azure client ID>"
export AZURE_CLIENT_SECRET="<Your Azure client secret>"
export AZURE_KEY_NAME="<Your Azure Key Name>"
export AZURE_KEY_VERSION="<Your Azure Key Version>"
export AZURE_KEY_VAULT_ENDPOINT="<Your Azure Key Vault Endpoint>"
export KEY_VAULT_MONGODB_URI="<Your Atlas Connection String>"
export MONGODB_URI="<Your Atlas Connection String>"
export SHARED_LIB_PATH="/full/path/to/mongo_crypt_v1.so"
...
```

See `.env` in repo for a full example including other KMS providers.

### 3. Install Python Dependencies

```bash
python -m pip install -r requirements.txt
```

### 4. Download Automatic Encryption Shared Library

Follow [these instructions](https://www.mongodb.com/docs/manual/core/queryable-encryption/install-library/#automatic-encryption-shared-library) to download the correct `mongo_crypt_v1.so` (or `.dylib` for Mac) for your system, and record its full path in your `.env`.

---

## Usage

### Step 1: Create Key Vault and Encrypted Collection

This script creates the **key vault collection** (to hold your DEKs) and sets up an **encrypted collection** for your data.

```bash
python create_encrypted_collections.py
```

### Step 2: Insert Encrypted Document

This script uses automatic encryption to insert a document with encrypted fields.

```bash
python insert_encrypted_doc.py
```

**Sample output:**
```plaintext
Successfully inserted another patient with ssn: 123-45-6789
{...decrypted document...}
```

### Step 3: Rotate Your CMK in Azure Key Vault

- Use the Azure Portal to [rotate your root key](https://learn.microsoft.com/en-us/azure/key-vault/keys/change-key-version).
- Record the new version in your `.env` if needed.

### Step 4: Rewrap Data Encryption Keys (DEKs)

After CMK rotation, rewrap all the DEKs in MongoDB – they’ll be wrapped under the new version of your master key and remain usable.

Edit `rewrap_deks.py` with your new CMK details if needed:

```bash
python rewrap_deks.py
```

---

## Troubleshooting

### Common Issues

- **"Not all keys were satisfied":**  
  If demo code is run multiple times without dropping collections, documents may be encrypted under keys that are lost or missing. Drop your vault and collection, restart, and generate keys once.

- **Shared library load errors:**  
  Example:  
  ```
  Error while opening candidate for crypt_shared dynamic library [/path/mongo_crypt_v1.so]
  ```
  - Ensure your library matches your OS and CPU arch (`file mongo_crypt_v1.so`, `uname -a`)
  - Path must be correct and the file must be present

---

## File Reference

- `requirements.txt` – Python package requirements
- `.env` – Environment variables for all supported KMS providers
- `queryable_encryption_helpers.py` – Helper functions for KMS credentials and encryption setup
- `create_encrypted_collections.py` – Create vault, DEKs, and encrypted collection
- `insert_encrypted_doc.py` – Insert and query encrypted documents
- `rewrap_deks.py` – Rewrap DEKs after master key rotation

---

## References & Documentation

- [Queryable Encryption Tutorials](https://www.mongodb.com/docs/manual/core/queryable-encryption/tutorials/#queryable-encryption-tutorials)
- [Queryable Encryption Quick Start](https://www.mongodb.com/docs/manual/core/queryable-encryption/quick-start/#queryable-encryption-quick-start)
- [MongoDB Atlas](https://www.mongodb.com/docs/atlas/)
- [Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/general/overview)
