import gulp from 'gulp';
const { series } = gulp;

// 一个空任务，什么都不做，防止 gulp 报错
function emptyTask(cb) {
  cb();
}

export default series(emptyTask);