import 'dotenv/config';
import Zernio from '@zernio/node';

const required = ['ZERNIO_PROFILE_ID', 'ZERNIO_ACCOUNT_ID', 'INSTAGRAM_POST_ID', 'DM_MESSAGE'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  console.error('Run `npm run list` first to find your profile and account IDs.');
  process.exit(1);
}

const zernio = new Zernio();

const keywords = process.env.KEYWORDS
  ? process.env.KEYWORDS.split(',').map(k => k.trim()).filter(Boolean)
  : [];

const body = {
  profileId: process.env.ZERNIO_PROFILE_ID,
  accountId: process.env.ZERNIO_ACCOUNT_ID,
  platformPostId: process.env.INSTAGRAM_POST_ID,
  name: process.env.AUTOMATION_NAME ?? 'Reel DM Test',
  dmMessage: process.env.DM_MESSAGE,
  ...(keywords.length && { keywords, matchMode: 'contains' }),
  ...(process.env.COMMENT_REPLY && { commentReply: process.env.COMMENT_REPLY }),
};

async function main() {
  console.log('\nCreating automation...');
  console.log(`  Name:     ${body.name}`);
  console.log(`  Post ID:  ${body.platformPostId}`);
  console.log(`  Keywords: ${keywords.length ? keywords.join(', ') : '(all comments)'}`);
  console.log(`  DM:       ${body.dmMessage}`);
  if (body.commentReply) console.log(`  Reply:    ${body.commentReply}`);

  const { data, error } = await zernio.commentautomations.createCommentAutomation({ body });

  if (error) {
    console.error('\nAPI error:', JSON.stringify(error, null, 2));
    process.exit(1);
  }

  const automation = data?.automation;
  console.log(`\n✓ Automation created! ID: ${automation?.id}`);
  console.log(`  Active: ${automation?.isActive}`);
  console.log('\nNow comment on your reel (or have someone else do it) to test the trigger.');
  console.log('Check logs with: npx zernio automations:logs', automation?.id, '--pretty\n');
}

main().catch(err => {
  console.error('\nError:', err.message);
  process.exit(1);
});
