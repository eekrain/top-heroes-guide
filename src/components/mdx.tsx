import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { ShardCalculator } from '@/components/shard-calculator';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    ShardCalculator,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
