// Validates src/content/resources.json before every build.
import { readFile } from 'node:fs/promises';
import * as v from 'valibot';
import { ResourcesFileSchema } from '../src/modules/resources/schema.ts';

const raw: unknown = JSON.parse(await readFile('src/content/resources.json', 'utf8'));
const result = v.safeParse(ResourcesFileSchema, raw);

if (!result.success) {
  console.error('check-resources: src/content/resources.json is invalid:');
  for (const issue of result.issues) {
    const path = issue.path?.map((p) => String(p.key)).join('.') ?? '(root)';
    console.error(`  - ${path}: ${issue.message}`);
  }
  process.exit(1);
}
const count = result.output.categories.reduce((n, c) => n + c.links.length, 0);
console.log(`check-resources: ${result.output.categories.length} categories, ${count} links OK.`);
