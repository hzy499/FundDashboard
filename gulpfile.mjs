import gulp from 'gulp';
import postcss from 'gulp-postcss';
import UnoCSS from 'unocss/postcss';
import presetWeapp from 'unocss-preset-weapp';
import { transformerAttributify, transformerClass } from 'unocss-preset-weapp/transformer';

const { series, src, dest, watch } = gulp;

// 1. UnoCSS 配置
const unoConfig = {
  // 核心修复：显式告诉 UnoCSS 去扫描哪些文件来生成 CSS
  content: {
    filesystem: [
      'miniprogram/**/*.wxml' 
    ]
  },
  presets: [
    presetWeapp(),
  ],
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
};

// 2. 编译任务
export function style() {
  // 核心修复：输入源改为 uno.wxss（或者一个虚拟 CSS），而不是 wxml
  // 我们这里通过 allowEmpty 防止文件不存在报错
  return src('./miniprogram/uno.wxss', { allowEmpty: true }) 
    .pipe(postcss([
      UnoCSS(unoConfig) // UnoCSS 会读取 content 配置中的 wxml，生成样式注入到这里
    ]))
    .pipe(dest('./miniprogram/')); // 输出回 miniprogram 目录覆盖 uno.wxss
}

// 3. 监听任务
export function watchTask() {
  // 监听所有 WXML 文件的变化，一旦变化，就重新运行 style 任务生成 CSS
  watch('./miniprogram/**/*.wxml', style);
}

// 4. 导出默认任务
export default series(style, watchTask);