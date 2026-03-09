#example.rb

require "mongo"
require "base64"

Mongo::Logger.logger.level = ::Logger::INFO

# Database and Collection variables
db = "medicalRecords"
coll = "patients"
namespace = "#{db}.#{coll}"

# ---- Load Local KMS provider ----
provider = 'local'
local_master_key = File.binread('./master-key.txt')
kms_providers = {
local: { key: local_master_key }
}

# ---- Key Vault ----
key_vault_namespace = 'encryption.__keyVault'

# ---- Load Data Key (DEK) ----
data_key = File.read('./localDataEncryption.key').strip
decoded_data_key = BSON::Binary.new(Base64.decode64(data_key), :uuid)

# ---- Encryption Schema ----
schema = {
bsonType: "object",
encryptMetadata: {
  keyId: [decoded_data_key],
},
properties: {
  insurance: {
    bsonType: "object",
    properties: {
      policyNumber: {
        encrypt: {
          bsonType: "int",
          algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic",
        }
      }
    }
  },
  medicalRecords: {
    encrypt: {
      bsonType: "array",
      algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Random"
    }
  },
  bloodType: {
    encrypt: {
      bsonType: "string",
      algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Random"
    }
  },
  ssn: {
    encrypt: {
      bsonType: "int",
      algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic",
    }
  }
}
}
patient_schema = { namespace => schema }

# ---- Extra options (for shared crypt library, update path as needed) ----
extra_options = {
crypt_shared_lib_path: '/usr/local/lib/mongo_crypt_v1.so'
}

# ---- Connections ----
connection_string = "mongodb+srv://<placeholderForYourOwnConnectionURL>.mongodb.net/#{db}?retryWrites=true&w=majority&appName=RubyCSFLE"

# Secure (auto-encrypted) Client
encrypted_client = Mongo::Client.new(connection_string,
auto_encryption_options: {
  key_vault_namespace: key_vault_namespace,
  kms_providers: kms_providers,
  schema_map: patient_schema,
  extra_options: extra_options
}
)

# Regular (non-encrypted) Client
regular_client = Mongo::Client.new(connection_string)

begin
puts "Connected to MongoDB. Inserting and fetching test document..."

# Insert document with encrypted client
begin
  write_result = encrypted_client[coll].insert_one({
    name: "Jon Doe",
    ssn: 241014209,
    bloodType: "AB+",
    medicalRecords: [{ weight: 180, bloodPressure: "120/80" }],
    insurance: {
      policyNumber: 123142,
      provider: "MaestCare"
    }
  })
  puts "Encrypted insert result id: #{write_result.inserted_id}"
rescue => write_error
  puts "writeError occurred: #{write_error}"
end

# Query with regular client
puts "\nFinding document with regular (non-encrypted) client:"
p regular_client[coll].find({ name: /Jon/ }).first

# Query with encrypted client
puts "\nFinding document with encrypted client:"
p encrypted_client[coll].find({ name: /Jon/ }).first
ensure
encrypted_client&.close
regular_client&.close
end
