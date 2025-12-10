// uno.config.js
import { defineConfig } from 'unocss';
import presetWeapp from 'unocss-preset-weapp';
import { transformerAttributify, transformerClass } from 'unocss-preset-weapp/transformer';

export default defineConfig({
  // 1. 扫描路径：在这里定义，CLI 会自动读取
  content: {
    filesystem: [
      'miniprogram/**/*.wxml',
      'miniprogram/pages/**/*.wxml',
      'miniprogram/components/**/*.wxml'
    ]
  },
  presets: [
    presetWeapp(),
  ],
  // 2. 强制生成的样式（测试用）
  safelist: ['text-red-500', 'bg-blue-500', 'm-10'],
  shortcuts: [
    {
      'flex-center': 'flex justify-center items-center',
      'text-gain': 'text-red-500 font-bold',
      'text-loss': 'text-green-500 font-bold',
    },
  ],
  transformers: [
    transformerClass(),
    transformerAttributify(),
  ]
});