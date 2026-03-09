#make_data_key.rb

require 'mongo'
require 'base64'
require 'securerandom'

Mongo::Logger.logger.level = ::Logger::INFO

def main
# ----- start-local-cmk -----
begin
  cmk = SecureRandom.random_bytes(96)
  File.binwrite('master-key.txt', cmk)
rescue => err
   puts "Error writing master-key.txt: #{err}"
end
# ----- end-local-cmk -----

# ----- start-kmsproviders -----
provider = 'local'
local_master_key = File.binread('./master-key.txt')
kms_providers = { local: { key: local_master_key } }
# ----- end-kmsproviders -----

# ----- start-create-encyption_keyVault-collection -----
uri = 'yourAtlasSRVconnectionString'
key_vault_database = 'encryption'
key_vault_collection = '__keyVault'
key_vault_namespace = "#{key_vault_database}.#{key_vault_collection}"
key_vault_client = Mongo::Client.new(uri, database: key_vault_database)
key_vault_client.database.drop
regular_client = Mongo::Client.new(uri, database: 'medicalRecords')
regular_client.database.drop

key_vault_coll = key_vault_client[key_vault_collection]
key_vault_coll.indexes.create_one(
  { keyAltNames: 1 },
  unique: true,
  partial_filter_expression: { keyAltNames: { '$exists': true } }
)
# ----- end -----

# ----- start-create-dek -----
encryption = Mongo::ClientEncryption.new(
  regular_client,
  key_vault_namespace: key_vault_namespace,
  kms_providers: kms_providers
)
 key_id = encryption.create_data_key(provider)
 puts "DataKeyId [base64]: #{Base64.strict_encode64(key_id.data)}"

File.write('localDataEncryption.key', Base64.strict_encode64(key_id.data))

key_vault_client.close
regular_client.close
# ----- end-create-dek -----
end

main
