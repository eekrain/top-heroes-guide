import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { DailySpecialCalculator } from '@/components/daily-special-calculator';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    DailySpecialCalculator,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
