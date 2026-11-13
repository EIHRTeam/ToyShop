import english from './locales/en.json' with { type: 'json' };
import chinese from './locales/zh-CN.json' with { type: 'json' };

export const zhCN = chinese;
export const en: typeof zhCN = english;
