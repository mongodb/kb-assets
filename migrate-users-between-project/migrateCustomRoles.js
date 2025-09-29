import config from './config.js';
import DigestFetchClient from 'digest-fetch';

// === SOURCE PROJECT ===
const SOURCE_PUBLIC_KEY = config.SOURCE_PUBLIC_KEY;
const SOURCE_PRIVATE_KEY = config.SOURCE_PRIVATE_KEY;
const SOURCE_GROUP_ID = config.SOURCE_GROUP_ID;

// === DESTINATION PROJECT ===
const DEST_PUBLIC_KEY = config.DEST_PUBLIC_KEY;
const DEST_PRIVATE_KEY = config.DEST_PRIVATE_KEY;
const DEST_GROUP_ID = config.DEST_GROUP_ID;

// === CONSTANTS ===
const BASE_URL = config.ATLAS_API;
const ACCEPT_HEADER = config.ACCEPT_HEADER;

// === AUTH CLIENTS ===
const sourceClient = new DigestFetchClient(SOURCE_PUBLIC_KEY, SOURCE_PRIVATE_KEY, { algorithm: 'MD5' });
const destClient = new DigestFetchClient(DEST_PUBLIC_KEY, DEST_PRIVATE_KEY, { algorithm: 'MD5' });

// === Fetch all custom roles from source ===
async function fetchCustomRoles() {
  const url = `${BASE_URL}/groups/${SOURCE_GROUP_ID}/customDBRoles/roles?envelope=false`;

  try {
    const res = await sourceClient.fetch(url, {
      method: 'GET',
      headers: { Accept: ACCEPT_HEADER },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`❌ Failed to fetch custom roles.`);
      console.error(`   ↳ URL: ${url}`);
      console.error(`   ↳ Status: ${res.status} ${res.statusText}`);
      console.error(`   ↳ Response: ${text}`);
      throw new Error(`Fetch custom roles failed with status ${res.status}`);
    }

    const json = await res.json();
    console.log(`🔍 Found ${json.length} custom roles in source project.`);
    json.forEach(r => console.log(`   • ${r.roleName}`));
    return json || [];
  } catch (err) {
    console.error(`❌ Network/API error while fetching custom roles:`, err);
    throw err;
  }
}

// === Create a role in the destination ===
async function createCustomRole(role) {
  const url = `${BASE_URL}/groups/${DEST_GROUP_ID}/customDBRoles/roles?envelope=false`;
  const payload = {
    roleName: role.roleName,
    actions: role.actions,
    inheritedRoles: role.inheritedRoles || [],
  };

  try {
    const res = await destClient.fetch(url, {
      method: 'POST',
      headers: {
        Accept: ACCEPT_HEADER,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      console.log(`✅ Created custom role: ${role.roleName}`);
    } else {
      const errText = await res.text();
      console.error(`❌ Failed to create role: ${role.roleName}`);
      console.error(`   ↳ URL: ${url}`);
      console.error(`   ↳ Status: ${res.status} ${res.statusText}`);
      console.error(`   ↳ Response: ${errText}`);
    }
  } catch (err) {
    console.error(`❌ Network/API error while creating role ${role.roleName}:`, err);
    throw err;
  }
}

// === MAIN ===
(async () => {
  try {
    const roles = await fetchCustomRoles();
    console.log(`🔍 Preparing to migrate ${roles.length} custom roles...\n`);

    for (const role of roles) {
      await createCustomRole(role);
    }

    console.log('\n🎉 All custom roles migrated successfully.');
  } catch (err) {
    console.error('❌ Migration failed with unexpected error:', err);
    process.exit(1); // fail CI/CD if running in pipeline
  }
})();
