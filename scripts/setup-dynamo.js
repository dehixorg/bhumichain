/**
 * Creates all BhumiChain DynamoDB tables in ap-south-1 (Mumbai).
 * Run once before deploying: node scripts/setup-dynamo.js
 *
 * Prerequisites:
 *   AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY set in environment
 *   or configured via ~/.aws/credentials
 */

const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({ region: 'ap-south-1' });

const TABLES = [
  {
    TableName: 'bhumichain-notifications',
    KeySchema: [{ AttributeName: 'aadhaarHash', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'aadhaarHash', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
    Tags: [{ Key: 'project', Value: 'bhumichain' }],
  },
  {
    TableName: 'bhumichain-tokens',
    // PK: "sha256:priya001#2026-06-30" — aadhaarHash + date for daily token counts
    KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'pk', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
    Tags: [{ Key: 'project', Value: 'bhumichain' }],
  },
  {
    TableName: 'bhumichain-ec-cache',
    KeySchema: [
      { AttributeName: 'dlpiId', KeyType: 'HASH' },
      { AttributeName: 'issuedAt', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'dlpiId', AttributeType: 'S' },
      { AttributeName: 'issuedAt', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
    Tags: [{ Key: 'project', Value: 'bhumichain' }],
  },
  {
    TableName: 'bhumichain-analytics',
    KeySchema: [
      { AttributeName: 'eventType', KeyType: 'HASH' },
      { AttributeName: 'timestamp', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'eventType', AttributeType: 'S' },
      { AttributeName: 'timestamp', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
    Tags: [{ Key: 'project', Value: 'bhumichain' }],
  },
];

async function tableExists(name) {
  try {
    await client.send(new DescribeTableCommand({ TableName: name }));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('BhumiChain — DynamoDB Table Setup (ap-south-1 Mumbai)\n');

  for (const table of TABLES) {
    const exists = await tableExists(table.TableName);
    if (exists) {
      console.log(`  ✓ ${table.TableName} — already exists, skipping`);
      continue;
    }
    try {
      await client.send(new CreateTableCommand(table));
      console.log(`  ✓ ${table.TableName} — created`);
    } catch (err) {
      console.error(`  ✗ ${table.TableName} — FAILED: ${err.message}`);
      process.exit(1);
    }
  }

  console.log('\nAll tables ready. Add these to your .env:');
  console.log('  DYNAMO_TABLE_NOTIFICATIONS=bhumichain-notifications');
  console.log('  DYNAMO_TABLE_TOKENS=bhumichain-tokens');
  console.log('  DYNAMO_TABLE_EC_CACHE=bhumichain-ec-cache');
  console.log('  DYNAMO_TABLE_ANALYTICS=bhumichain-analytics');
}

main();
