from pymongo import MongoClient #import MongoClient class to connect to MongoDB servers/clusters.
import queryable_encryption_helpers as helpers  # our helper functions
import os #For reading environment variables.
from dotenv import load_dotenv #Loads variables from a .env file into your environment

load_dotenv() #Loads the values in a .env file

# start-setup-application-variables
kms_provider_name = "azure"

# URIs for Atlas clusters  
key_vault_uri = os.environ['KEY_VAULT_MONGODB_URI']  # Key Vault Cluster!  
data_uri = os.environ['MONGODB_URI']                 # Application Data Cluster!  

key_vault_database_name = "queryable_encryption"
key_vault_collection_name = "queryable_keyVault"
key_vault_namespace = f"{key_vault_database_name}.{key_vault_collection_name}"
encrypted_database_name = "mongoMedicalRecords"
encrypted_collection_name = "mongoDBpatients"



kms_provider_credentials = helpers.get_kms_provider_credentials(kms_provider_name)
customer_master_key_credentials = helpers.get_customer_master_key_credentials(kms_provider_name)

#Drop old collections for a fresh setup   
data_client = MongoClient(data_uri)  
try:  
    data_client[encrypted_database_name][encrypted_collection_name].drop()  
except Exception:  
    pass  

key_vault_client = MongoClient(key_vault_uri)  
try:  
    key_vault_client[key_vault_database_name][key_vault_collection_name].drop()  
except Exception:  
    pass  

# ---- Ensure the key vault collection has a unique index on keyAltNames ----  
key_vault_client[key_vault_database_name][key_vault_collection_name].create_index(  
    "keyAltNames",  
    unique=True,  
    partialFilterExpression={"keyAltNames": {"$exists": True}}  #Creates a unique index only on documents that actually have keyAltNames (not all do).
)  
print("Created unique index on keyAltNames for key vault collection.") 

#  Set Up the ClientEncryption Object
#Initializes an object that lets you securely create and use data encryption keys (DEKs).
#Uses the key vault, KMS, credentials, and collection namespace.
client_encryption = helpers.get_client_encryption(
    key_vault_client,
    kms_provider_name,
    kms_provider_credentials,
    key_vault_namespace
)



# ---- Create DEKs with keyAltNames (one per field) ----  
ssn_altname = f"{encrypted_database_name}.ssn"  
billing_altname = f"{encrypted_database_name}.billing"  

#  create a DEK (only once), record its keyId: 
# key_id is a BSON Binary(UUID_subtype_4)  and Use the keyIds for both fields:   
ssn_key_id = client_encryption.create_data_key(  
    kms_provider_name,  
    master_key=customer_master_key_credentials,  
    key_alt_names=[ssn_altname]  
)  
billing_key_id = client_encryption.create_data_key(  
    kms_provider_name,  
    master_key=customer_master_key_credentials,  
    key_alt_names=[billing_altname]  
)   
print(f"Created SSN Key ID: {ssn_key_id}")  
print(f"Created Billing Key ID: {billing_key_id}")  

# Save the DEKs for use in insert_doc.py (write to file, print, etc.)
with open("ssn_key_id.bin", "wb") as f:  
    f.write(ssn_key_id)  
with open("billing_key_id.bin", "wb") as f:  
    f.write(billing_key_id)  


# start-encrypted-fields-map

encrypted_fields_map = {  
    "fields": [  
        {  
            "path": "patientRecord.ssn",  
            "bsonType": "string",  
            "queries": [{"queryType": "equality"}],  
            "keyId": ssn_key_id     
        },  
        {  
            "path": "patientRecord.billing",  
            "bsonType": "object",  
            "keyId": billing_key_id    
        }  
    ]  
}  


# creates a new collection in your MongoDB data cluster.

try:  
    client_encryption.create_encrypted_collection(  
        data_client[encrypted_database_name],  
        encrypted_collection_name,  
        encrypted_fields_map,  
        kms_provider_name,  
        customer_master_key_credentials,  
    )  
    print("Encrypted collection created successfully.")  
except Exception as e:  
    print("Unable to create encrypted collection due to the following error:", e)  
  
data_client.close()  
key_vault_client.close() 