import * as v from 'valibot';
import { safeHttpsUrl } from '../../core/safe/url.ts';

const text = (max: number) => v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(max));

export const ResourceLinkSchema = v.strictObject({
  title: text(120),
  url: v.pipe(
    v.string(),
    v.check((u) => safeHttpsUrl(u) !== null, 'Links must be plain https:// URLs.'),
  ),
  description: v.optional(text(300)),
});

export const ResourceCategorySchema = v.strictObject({
  name: text(80),
  description: v.optional(text(300)),
  links: v.pipe(v.array(ResourceLinkSchema), v.maxLength(200)),
});

export const ResourcesFileSchema = v.strictObject({
  categories: v.pipe(v.array(ResourceCategorySchema), v.maxLength(50)),
});

export type ResourcesFile = v.InferOutput<typeof ResourcesFileSchema>;
