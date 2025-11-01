from pymongo import MongoClient  
import queryable_encryption_helpers as helpers  
import os  
from dotenv import load_dotenv  
from random import randint  
load_dotenv()  
  
kms_provider_name = "azure"  
uri = os.environ['MONGODB_URI']  
  
key_vault_database_name = "queryable_encryption"  
key_vault_collection_name = "queryable_keyVault"  
key_vault_namespace = f"{key_vault_database_name}.{key_vault_collection_name}"  
encrypted_database_name = "mongoMedicalRecords"  
encrypted_collection_name = "mongoDBpatients"  
  
kms_provider_credentials = helpers.get_kms_provider_credentials(kms_provider_name)  

# --- Connect to key vault and retrieve DEKs by keyAltName ---  
key_vault_client = MongoClient(os.environ['KEY_VAULT_MONGODB_URI'])  
key_vault_coll = key_vault_client[key_vault_database_name][key_vault_collection_name]  

ssn_key_id = key_vault_coll.find_one({"keyAltNames": "mongoMedicalRecords.ssn"})["_id"]  
billing_key_id = key_vault_coll.find_one({"keyAltNames": "mongoMedicalRecords.billing"})["_id"]  

encrypted_fields_map = {  
    f"{encrypted_database_name}.{encrypted_collection_name}": {  
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
}  

# specify the key vault client (recommended for Atlas multi-region) 
key_vault_client = MongoClient(os.environ['KEY_VAULT_MONGODB_URI'])  
 
auto_encryption_options = helpers.get_auto_encryption_options(  
    kms_provider_name,  
    key_vault_namespace,  
    kms_provider_credentials,  
    encrypted_fields_map=encrypted_fields_map,
    key_vault_client=key_vault_client
)  

# Set up the encrypted client  
encrypted_client = MongoClient(uri, auto_encryption_opts=auto_encryption_options)  
  
# Get the encrypted collection reference  
encrypted_collection = encrypted_client[encrypted_database_name][encrypted_collection_name]  

ssn = f"{randint(100, 999)}-{randint(10,99)}-{randint(1000,9999)}"
new_patient = {      
    "patientName": f"Alice Charles {randint(1, 1000)}",  #  Randomize  
    "patientId": randint(10000000, 99999999),             # random patientId
    "patientRecord": {      
        "ssn": ssn,  # random SSN  
        "billing": {      
            "type": "Amex",      
            "number": "340000000000009"      
        },      
        "billAmount": randint(1000, 5000),  # Optional: random bill amount  
    },      
}  
  
result = encrypted_collection.insert_one(new_patient)  
if result.acknowledged:    
    print(f"Successfully inserted another patient with ssn: {ssn}")  

# start-find-document
find_result = encrypted_collection.find_one({
    "patientRecord.ssn": ssn
})

print(find_result)
# end-find-document
  
encrypted_client.close()  
key_vault_client.close()

'''
print("Listing all DEKs and their keyAltNames in key vault:")  
for doc in key_vault_coll.find():  
    print("DEK _id:", doc.get("_id"), "keyAltNames:", doc.get("keyAltNames"))  
print("ssn_key_id:", ssn_key_id, type(ssn_key_id))  
print("billing_key_id:", billing_key_id, type(billing_key_id))  
'''