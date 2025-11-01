from pymongo import MongoClient  
from pymongo.encryption import ClientEncryption  
import queryable_encryption_helpers as helpers  
from dotenv import load_dotenv
import os
load_dotenv()  
  
#uri = os.environ["MONGODB_URI"]  
key_vault_uri = os.environ['KEY_VAULT_MONGODB_URI'] 
kms_provider_name = "azure"  
key_vault_namespace = "queryable_encryption.queryable_keyVault"  
  
encrypted_client = MongoClient(key_vault_uri)  
kms_provider_credentials = helpers.get_kms_provider_credentials(kms_provider_name)  
  

new_master_key = {  
    
    "keyVaultEndpoint": "https://mongodb-qe.vault.azure.net/",  
    "keyName": "demo-key",  
    "keyVersion": "df9902a7f7e84a69a6fb97746e12af5b"
}   
  
key_vault_client = MongoClient(key_vault_uri)  
client_encryption = helpers.get_client_encryption(
    encrypted_client,
    kms_provider_name,
    kms_provider_credentials,
    key_vault_namespace
) 
  
# rewrap!
rewrap_result = client_encryption.rewrap_many_data_key(  
    filter={},
    provider=kms_provider_name,  
    master_key=new_master_key  
)  
print("Rewrap result:", rewrap_result)  
client_encryption.close()  
