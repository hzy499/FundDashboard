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

  ],
  theme: {
    colors: {
      // 定义语义化颜色变量
      'up': '#ff4d4f',   // 涨
      'down': '#22c55e', // 跌
      'primary': '#2b6cb0',
    }
  },
  shortcuts: [
    {
      'flex-center': 'flex justify-center items-center',
      // 使用 theme 里的颜色，可以在 JS 逻辑中更通用
      'text-gain': 'text-up font-bold font-nums',
      'text-loss': 'text-down font-bold font-nums',
      'card-base': 'bg-white rounded-2xl shadow-sm mb-3 overflow-hidden border border-gray-50'
    },
  ],

});