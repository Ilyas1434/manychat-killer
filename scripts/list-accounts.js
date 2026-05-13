import 'dotenv/config';
import Zernio from '@zernio/node';

const zernio = new Zernio();

async function main() {
  const { data: profilesData } = await zernio.profiles.listProfiles();
  console.log('\n=== Profiles ===');
  for (const p of profilesData.profiles ?? []) {
    console.log(`  ${p.name} → ZERNIO_PROFILE_ID=${p._id}`);
  }

  const { data: accountsData } = await zernio.accounts.listAccounts();
  const igAccounts = (accountsData.accounts ?? []).filter(a => a.platform === 'instagram');

  console.log('\n=== Instagram Accounts ===');
  if (igAccounts.length === 0) {
    console.log('  No Instagram accounts found. Connect one at zernio.com/dashboard.');
  } else {
    for (const a of igAccounts) {
      console.log(`  @${a.username ?? a.displayName} → ZERNIO_ACCOUNT_ID=${a._id}`);
    }
  }

  console.log('\nCopy the values above into your .env file, then set INSTAGRAM_POST_ID and run:\n  npm run create\n');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
